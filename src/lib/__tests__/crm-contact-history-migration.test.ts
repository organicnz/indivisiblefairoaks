// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source-level guards on the split contact-history dates.
 *
 * The behavior is in Postgres, so a row-based action test cannot execute it:
 * the action suite mocks `crm_activities`, and the mock has no trigger. These
 * assertions make the intended rules fail loudly when the migration is edited —
 * the generated engaged date, the outbound/inbound split, the backfill, and the
 * merge wrapper. The migration dry-run is what actually applies the SQL.
 */
const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261119170000_crm_contact_history_dates.sql'
);
const SQL = await Bun.file(MIGRATION).text();
const BROADCAST_SENDER = resolve(process.cwd(), 'supabase/functions/crm-broadcast-send/index.ts');
const BROADCAST_SOURCE = await Bun.file(BROADCAST_SENDER).text();

describe('contact history dates migration', () => {
  it('adds separate outbound and inbound dates, with engaged generated from both', () => {
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz/);
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz/);
    expect(SQL).toMatch(
      /ADD COLUMN IF NOT EXISTS last_engaged_at timestamptz GENERATED ALWAYS AS \(\s*greatest\(last_outbound_at, last_inbound_at\)\s*\) STORED/
    );
  });

  it('backfills outbound from email_sent and legacy last_contacted_at', () => {
    expect(SQL).toMatch(/FILTER \(WHERE type = 'email_sent'\)/);
    expect(SQL).toMatch(/greatest\(c\.last_contacted_at, a\.outbound\)/);
  });

  it('backfills inbound from form, RSVP, and order activities', () => {
    expect(SQL).toMatch(/type IN \('contact_form', 'event_rsvp', 'order'\)/);
  });

  it('stamps dates from activity inserts rather than each writer remembering to', () => {
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_crm_stamp_contact_history/);
    expect(SQL).toMatch(/AFTER INSERT ON public\.crm_activities/);
    expect(SQL).toMatch(/trg_crm_activity_stamps_contact_history/);
    expect(SQL).toMatch(/NEW\.type = 'email_sent'/);
    expect(SQL).toMatch(/last_outbound_at = greatest\(/);
    expect(SQL).toMatch(/last_inbound_at = greatest\(/);
    // Notes and organizer records are deliberately not engagement.
    expect(SQL).not.toMatch(/NEW\.type = 'note'/);
  });

  it('gives the broadcast sender an idempotent delivery stamp that cannot move backwards', () => {
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.crm_stamp_outbound_contacts/);
    expect(SQL).toMatch(/last_outbound_at = greatest\(coalesce\(last_outbound_at, p_at\), p_at\)/);
    expect(SQL).toMatch(
      /last_contacted_at = greatest\(coalesce\(last_contacted_at, p_at\), p_at\)/
    );
    expect(SQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.crm_stamp_outbound_contacts\(uuid\[\], timestamptz\)\s+TO service_role/
    );
  });

  it('has the broadcast sender stamp successful, non-preview deliveries', () => {
    expect(BROADCAST_SOURCE).toMatch(/deliveredIds\.push\(recipient\.id\)/);
    expect(BROADCAST_SOURCE).toMatch(/if \(!isSelfTest\) deliveredIds\.push/);
    expect(BROADCAST_SOURCE).toMatch(/rpc\('crm_stamp_outbound_contacts'/);
    expect(BROADCAST_SOURCE).toMatch(/p_contact_ids: deliveredIds/);
  });

  it('preserves both contacts dates across a merge', () => {
    expect(SQL).toMatch(/RENAME TO merge_crm_contacts_legacy/);
    expect(SQL).toMatch(/last_outbound_at = greatest\(v_keep_outbound, v_remove_outbound\)/);
    expect(SQL).toMatch(/last_inbound_at = greatest\(v_keep_inbound, v_remove_inbound\)/);
    expect(SQL).toMatch(/v_contact := public\.merge_crm_contacts_legacy/);
  });
});
