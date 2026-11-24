// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source-level guards on the durable direct-email ledger.
 *
 * The action tests use a row-backed fake, so they can prove the writer settles
 * a row, but not that Postgres enforces the idempotency boundary or that the
 * table is admin-only. These assertions guard the properties the fake cannot
 * execute: one row per key, the exact retry payload, the pending lease index,
 * and the same RLS shape as the other CRM ledgers.
 */
const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261120120000_crm_direct_email_sends.sql'
);
const SQL = await Bun.file(MIGRATION).text();
const CODE = SQL.replace(/--[^\n]*/g, '');

describe('direct-email send ledger migration', () => {
  it('keys the ledger by a unique idempotency key and retains the exact send', () => {
    expect(CODE).toMatch(/create table if not exists public\.crm_direct_email_sends/i);
    for (const column of [
      'idempotency_key',
      'contact_id',
      'actor_user_id',
      'recipient_email',
      'subject',
      'message',
      'status',
      'provider_id',
      'provider_status',
      'error',
      'attempts',
      'started_at',
      'accepted_at',
    ]) {
      expect(CODE).toMatch(new RegExp(`\\b${column}\\b`, 'i'));
    }
    // The unique constraint is the idempotency boundary: a retry finds the
    // existing row instead of inserting a second attempt.
    expect(CODE).toMatch(/unique \(idempotency_key\)/i);
    // Normalized addresses keep the snapshot from becoming a second identity
    // for the same inbox.
    expect(CODE).toMatch(
      /recipient_email = lower\(btrim\(recipient_email\)\) and btrim\(recipient_email\) <> ''/i
    );
    // A retry must resend the message that was recorded, so the body is part of
    // the durable row rather than re-read from the current form.
    expect(CODE).toMatch(/message\s+text\s+not null/i);
  });

  it('allows only the three settled states', () => {
    expect(CODE).toMatch(
      /status\s+text\s+not null default 'pending'\s+check \(status in \('pending', 'accepted', 'failed'\)\)/i
    );
  });

  it('is admin-only, with no anonymous access', () => {
    expect(CODE).toMatch(/alter table public\.crm_direct_email_sends enable row level security;/i);
    expect(CODE).toMatch(/revoke all on public\.crm_direct_email_sends from anon;/i);
    expect(CODE).toMatch(
      /grant all on public\.crm_direct_email_sends to authenticated, service_role;/i
    );
    expect(CODE).toMatch(
      /create policy "Admins can manage CRM direct email sends"[\s\S]*?using \(public\.is_admin\(\)\)[\s\S]*?with check \(public\.is_admin\(\)\)/i
    );
  });

  it('indexes stale pending attempts and touches updated_at', () => {
    expect(CODE).toMatch(
      /create index if not exists idx_crm_direct_email_sends_pending[\s\S]*?where status = 'pending'/i
    );
    expect(CODE).toMatch(
      /create trigger crm_direct_email_sends_touch_updated_at[\s\S]*?before update on public\.crm_direct_email_sends/i
    );
    expect(CODE).toMatch(/execute function public\.touch_updated_at\(\)/i);
  });
});
