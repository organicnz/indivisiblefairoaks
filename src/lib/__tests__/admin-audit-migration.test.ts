// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source-level guards on the append-only audit schema.
 *
 * The table is exercised through the recorder with a fake client; these checks
 * guard the properties a fake client cannot prove: RLS, service-role-only
 * grants, and the trigger that rejects UPDATE/DELETE in Postgres.
 */
const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261117140000_admin_audit_log.sql'
);
const SQL = await Bun.file(MIGRATION).text();
const CODE = SQL.replace(/--[^\n]*/g, '');

describe('admin audit log migration', () => {
  it('captures actor, target, before/after, MFA level and outcome', () => {
    expect(CODE).toMatch(/create table if not exists public\.admin_audit_log/i);
    for (const column of [
      'actor_user_id',
      'actor_email',
      'action',
      'target_type',
      'target_id',
      'target_label',
      'before',
      'after',
      'mfa_level',
      'outcome',
      'error',
      'metadata',
    ]) {
      expect(CODE).toMatch(new RegExp(`\\b${column}\\b`, 'i'));
    }
    expect(CODE).toMatch(/mfa_level[\s\S]*?check \(mfa_level in \('aal1', 'aal2', 'unknown'\)\)/i);
    expect(CODE).toMatch(/outcome[\s\S]*?check \(outcome in \('success', 'failure', 'denied'\)\)/i);
  });

  it('enables RLS with no client policy', () => {
    expect(CODE).toMatch(
      /alter table public\.admin_audit_log enable row level security;/i
    );
    expect(CODE).not.toMatch(/create policy/i);
    expect(CODE).toMatch(
      /revoke all on table public\.admin_audit_log from anon, authenticated;/i
    );
  });

  it('gives the service role SELECT and INSERT, but never UPDATE or DELETE', () => {
    expect(CODE).toMatch(
      /revoke all on table public\.admin_audit_log from service_role;/i
    );
    expect(CODE).toMatch(
      /grant select, insert on table public\.admin_audit_log to service_role;/i
    );
    expect(CODE).not.toMatch(/grant\s+(all|update|delete|truncate)\b/i);
  });

  it('rejects UPDATE, DELETE and TRUNCATE at the database boundary', () => {
    expect(CODE).toMatch(
      /create trigger admin_audit_log_append_only\s+before update or delete on public\.admin_audit_log/i
    );
    expect(CODE).toMatch(
      /create trigger admin_audit_log_no_truncate\s+before truncate on public\.admin_audit_log/i
    );
    expect(CODE).toMatch(/raise exception 'admin_audit_log is append-only/i);
  });
});
