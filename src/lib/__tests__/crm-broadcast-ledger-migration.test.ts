// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source-level guards on the broadcast recipient ledger.
 *
 * The behavior lives in Postgres and the Deno sender, neither of which the unit
 * runner executes. The migration dry-run applies the SQL; these assertions pin
 * the rules a later edit must not quietly change: a per-recipient row, three
 * terminal outcomes (plus a transient pending), SQL aggregates rather than
 * JavaScript counting, and an unchanged `.eq('do_not_email', false)` audience.
 */
const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261119180000_crm_broadcast_recipient_ledger.sql'
);
const SQL = await Bun.file(MIGRATION).text();
const ACTION_SOURCE = await Bun.file(
  resolve(process.cwd(), 'src/lib/actions/crm/broadcasts.ts')
).text();
const EDGE_SOURCE = await Bun.file(
  resolve(process.cwd(), 'supabase/functions/crm-broadcast-send/index.ts')
).text();

describe('broadcast recipient ledger migration', () => {
  it('creates one durable row per broadcast and address', () => {
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.crm_broadcast_recipients/);
    expect(SQL).toMatch(/broadcast_id\s+uuid\s+NOT NULL REFERENCES public\.crm_broadcasts/);
    expect(SQL).toMatch(
      /CONSTRAINT crm_broadcast_recipients_broadcast_email_key\s+UNIQUE \(broadcast_id, email\)/
    );
    // A deleted contact must not delete the campaign's record of contacting the
    // address; the email snapshot is the durable identity.
    expect(SQL).toMatch(
      /contact_id\s+uuid\s+REFERENCES public\.crm_contacts\(id\) ON DELETE SET NULL/
    );
    expect(SQL).toMatch(/email\s+text\s+NOT NULL/);
  });

  it('records the requested terminal outcomes and the transient sender state', () => {
    expect(SQL).toMatch(/CHECK \(status IN \('pending', 'accepted', 'failed', 'suppressed'\)\)/);
    expect(SQL).toMatch(/accepted_at\s+timestamptz/);
    expect(SQL).toMatch(/failed_at\s+timestamptz/);
    expect(SQL).toMatch(/suppressed_at\s+timestamptz/);
  });

  it('is admin-only under RLS and writable by the service role', () => {
    expect(SQL).toMatch(/ALTER TABLE public\.crm_broadcast_recipients ENABLE ROW LEVEL SECURITY/);
    expect(SQL).toMatch(/REVOKE ALL ON public\.crm_broadcast_recipients FROM anon/);
    expect(SQL).toMatch(/USING \(public\.is_admin\(\)\)/);
    expect(SQL).toMatch(/WITH CHECK \(public\.is_admin\(\)\)/);
  });

  it('computes campaign metrics in one SQL aggregate, not by counting in JS', () => {
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.crm_broadcast_metrics/);
    expect(SQL).toMatch(/count\(r\.id\) FILTER \(WHERE r\.status = 'accepted'\)/);
    expect(SQL).toMatch(/count\(r\.id\) FILTER \(WHERE r\.status = 'failed'\)/);
    expect(SQL).toMatch(/count\(r\.id\) FILTER \(WHERE r\.status = 'suppressed'\)/);
    expect(SQL).toMatch(/unresolved_count/);
    expect(SQL).toMatch(/GROUP BY b\.id, b\.recipient_count/);
    expect(SQL).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.crm_broadcast_metrics\(uuid\[\]\) FROM PUBLIC, anon, authenticated/
    );
  });

  it('reads only failed and suppressed recipients as follow-ups, with a full total', () => {
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.crm_broadcast_followups/);
    expect(SQL).toMatch(/AND r\.status IN \('failed', 'suppressed'\)/);
    expect(SQL).toMatch(/count\(\*\) OVER \(\) AS total_count/);
    expect(SQL).toMatch(/LIMIT least\(greatest\(coalesce\(p_limit, 100\), 1\), 500\)/);
  });

  it('settles provider results only from pending, so suppression cannot be erased', () => {
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.crm_broadcast_settle_recipients/);
    expect(SQL).toMatch(/AND r\.status = 'pending'/);
    expect(SQL).toMatch(/AND e\.status IN \('accepted', 'failed'\)/);
    expect(SQL).toMatch(/p_results jsonb/);
  });

  it('promotes a ledger row on suppression events but not on opens or temporary bounces', () => {
    expect(SQL).toMatch(/AFTER INSERT ON public\.crm_email_events/);
    expect(SQL).toMatch(/NEW\.event_type = 'suppressed'/);
    expect(SQL).toMatch(/NEW\.event_type = 'complained'/);
    expect(SQL).toMatch(/NEW\.event_type = 'bounced'/);
    expect(SQL).toMatch(/NEW\.metadata -> 'bounce' ->> 'type' = 'Permanent'/);
    expect(SQL).toMatch(/SET status = 'suppressed'/);
  });

  it('leaves audience semantics untouched in both resolvers', () => {
    // The ledger records the send outcome; it does not widen who is mailed.
    expect(ACTION_SOURCE).toMatch(/\.eq\('do_not_email', false\)/);
    expect(EDGE_SOURCE).toMatch(/\.eq\('do_not_email', false\)/);
    const actionAudience = ACTION_SOURCE.slice(
      ACTION_SOURCE.indexOf('async function resolveBroadcastRecipients'),
      ACTION_SOURCE.indexOf('export async function previewCRMBroadcast')
    );
    expect(actionAudience).toContain(".eq('do_not_email', false)");
    expect(actionAudience).not.toMatch(/do_not_email', true/);
  });

  it('seeds the ledger before the first provider call and settles after the batch', () => {
    const seed = EDGE_SOURCE.indexOf(
      'seedRecipientLedger(supabase, broadcastId, recipients, isSelfTest)'
    );
    const provider = EDGE_SOURCE.indexOf('const res = await fetch(RESEND_API_URL');
    const settle = EDGE_SOURCE.indexOf(
      'settleRecipientLedger(supabase, broadcastId, ledgerResults)'
    );
    expect(seed).toBeGreaterThan(-1);
    expect(provider).toBeGreaterThan(-1);
    expect(settle).toBeGreaterThan(-1);
    expect(seed).toBeLessThan(provider);
    expect(provider).toBeLessThan(settle);
    expect(EDGE_SOURCE).toMatch(/status: 'pending'/);
  });

  it('writes terminal failed rows when dispatch never reaches the sender', () => {
    expect(ACTION_SOURCE).toMatch(/recordBroadcastDispatchFailure\(adminClient, broadcast\.id/);
    expect(ACTION_SOURCE).toMatch(/recordBroadcastDispatchFailure\(\s*adminClient,\s*data\.id/s);
    expect(ACTION_SOURCE).toMatch(/status: 'failed' as const/);
  });

  it('reads the follow-up list through the bounded SQL function', () => {
    expect(ACTION_SOURCE).toMatch(/rpc\('crm_broadcast_metrics'/);
    expect(ACTION_SOURCE).toMatch(/rpc\('crm_broadcast_followups'/);
    expect(ACTION_SOURCE).toMatch(/p_broadcast_ids: ids/);
    expect(ACTION_SOURCE).toMatch(/p_limit: safeLimit/);
  });
});
