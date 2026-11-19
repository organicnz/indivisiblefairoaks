// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source-level guards on the durable audit outbox.
 *
 * The app tests exercise the writer through a fake client. These checks guard
 * the database properties the fake cannot prove: the outbox is service-role
 * only, delivery is idempotent, failed deliveries stay queued with a backoff,
 * and pg_cron actually calls the delivery function.
 */
const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261119210000_admin_audit_outbox.sql'
);
const SQL = await Bun.file(MIGRATION).text();
const CODE = SQL.replace(/--[^\n]*/g, '');

describe('admin audit outbox migration', () => {
  it('retains the complete audit payload and retry state', () => {
    expect(CODE).toMatch(/create table if not exists public\.admin_audit_outbox/i);
    for (const column of [
      'id',
      'payload',
      'created_at',
      'attempts',
      'next_attempt_at',
      'last_error',
    ]) {
      expect(CODE).toMatch(new RegExp(`\\b${column}\\b`, 'i'));
    }
    expect(CODE).toMatch(
      /constraint admin_audit_outbox_payload_id[\s\S]*?\(payload ->> 'id'\)::uuid = id/i
    );
  });

  it('is service-role only, with no client policy', () => {
    expect(CODE).toMatch(/alter table public\.admin_audit_outbox enable row level security;/i);
    expect(CODE).not.toMatch(/create policy/i);
    expect(CODE).toMatch(
      /revoke all on table public\.admin_audit_outbox from anon, authenticated;/i
    );
    expect(CODE).toMatch(
      /grant select, insert, update, delete on table public\.admin_audit_outbox to service_role;/i
    );
  });

  it('delivers idempotently and only removes the row after the audit insert', () => {
    expect(CODE).toMatch(
      /create or replace function public\.deliver_admin_audit_outbox\(batch_size integer default 100\)/i
    );
    expect(CODE).toMatch(/security definer/i);
    expect(CODE).toMatch(/insert into public\.admin_audit_log/i);
    expect(CODE).toMatch(/on conflict \(id\) do nothing/i);
    expect(CODE).toMatch(/delete from public\.admin_audit_outbox where id = item\.id/i);
    expect(CODE).toMatch(/where next_attempt_at <= now\(\)/i);
    expect(CODE).toMatch(/for update skip locked/i);
  });

  it('keeps failed deliveries queued with a bounded backoff', () => {
    expect(CODE).toMatch(/exception when others then/i);
    expect(CODE).toMatch(/attempts = attempts \+ 1/i);
    expect(CODE).toMatch(/last_error = left\(sqlerrm, 2000\)/i);
    expect(CODE).toMatch(/next_attempt_at = now\(\) \+ make_interval/i);
    expect(CODE).toMatch(/least\(\s*3600,\s*30 \* power\(2, least\(item\.attempts, 6\)\)/i);
  });

  it('schedules the drain every minute and grants execution only to service_role', () => {
    expect(CODE).toMatch(/create extension if not exists pg_cron;/i);
    expect(CODE).toMatch(
      /cron\.schedule\(\s*'deliver-admin-audit-outbox',\s*'\* \* \* \* \*',\s*\$job\$select public\.deliver_admin_audit_outbox\(100\);/i
    );
    expect(CODE).toMatch(
      /revoke all on function public\.deliver_admin_audit_outbox\(integer\)\s+from public, anon, authenticated;/i
    );
    expect(CODE).toMatch(
      /grant execute on function public\.deliver_admin_audit_outbox\(integer\)\s+to service_role;/i
    );
  });
});
