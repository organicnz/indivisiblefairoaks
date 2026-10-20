// @vitest-environment node
//
// This suite exercises node-side code: it reads files off disk, and it calls
// scripts that use Bun's file APIs. It has no DOM to work with.
//
// The environment is load-bearing, and not for the reason it looks. Vitest's
// `jsdom` environment replaces the worker's global with the jsdom window's,
// and the `Bun` global does not survive that swap everywhere. This suite
// passed on macOS and failed on the Linux runner with
// `ReferenceError: Bun is not defined` — every test in it, at the first
// `Bun.file`.
//
// In a `node` environment the global is the worker's own, so `Bun` is there
// because the worker *is* a Bun process: Vitest spawns its workers with
// `process.execPath`, and this suite runs under `bun vitest`.
//
// `scripts/hooks/vitest-environment.mjs` enforces this for every test file
// that reaches for `Bun.*`, directly or through an imported script.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source-level guards on the CRM sync triggers' `search_path`.
 *
 * These functions run with the table owner's privileges, RLS bypassed, on rows
 * written from anon-reachable paths — the contact-form submission lands
 * through the `SECURITY DEFINER` RPC, whose owner-privileged insert fires the
 * trigger. So the function that runs on every contact-form submission had
 * elevated privileges and a search_path starting at `public`, and the pin
 * matters regardless of which policy or RPC admitted the row. (An earlier
 * version of this comment named a `WITH CHECK (true)` INSERT policy for `anon`
 * as the mechanism; that policy was dropped in 20260922050000 and never
 * recreated. The conclusion — pin the path — was right; the stated mechanism
 * was stale, and a stale mechanism in a guard comment is what the next reader
 * treats as fact.)
 *
 * Nothing in the test suite could see it: `sql-security-definer-guard.mjs`
 * only checked that *a* `SET search_path` was nearby, and `public` satisfies
 * that check while leaving the attack open. So the guard asserts the specific
 * value, per function, and asserts the bodies are qualified — which is what
 * makes an empty path work at all.
 *
 * A test that reads SQL is not a test that runs it. This is a guard against
 * editing the SQL, and `migration-dryrun.mjs` is what actually applies it.
 */
const SEARCH_PATH_MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261005010000_crm_sync_trigger_search_path.sql'
);
const CONSENT_MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261005020000_contact_consent_tri_state.sql'
);
const SEARCH_PATH_SQL = await Bun.file(SEARCH_PATH_MIGRATION).text();
const CONSENT_SQL = await Bun.file(CONSENT_MIGRATION).text();

/*
 * `fn_sync_contact_submission_to_crm()` is declared in 20261005020000, not
 * here: that version also writes `do_not_email`, and declaring the
 * pre-consent body in the earlier file would leave a dead intermediate
 * declaration on a partial apply. The other two live in 20261005010000.
 */
const FUNCTION_SOURCES = {
  fn_sync_contact_submission_to_crm: CONSENT_SQL,
  fn_sync_profile_to_crm: SEARCH_PATH_SQL,
  fn_sync_order_to_crm: SEARCH_PATH_SQL,
} as const;

const FUNCTIONS = Object.keys(FUNCTION_SOURCES) as (keyof typeof FUNCTION_SOURCES)[];

function bodyOf(name: keyof typeof FUNCTION_SOURCES): string {
  const SQL = FUNCTION_SOURCES[name];
  const start = SQL.indexOf(`FUNCTION public.${name}(`);
  expect(start, `${name} is not defined in its migration`).toBeGreaterThan(-1);
  const end = SQL.indexOf('$$;', start);
  expect(end, `${name} has no terminating $$`).toBeGreaterThan(start);
  return SQL.slice(start, end);
}

const SQL = SEARCH_PATH_SQL;

describe('CRM sync trigger privilege boundary', () => {
  it.each(FUNCTIONS)('%s pins search_path to the empty string', (name) => {
    // Not `public`. The pre-existing guard accepts any `SET search_path`, and
    // `SET search_path = public` is exactly the value that leaves a
    // writable-first schema on the path.
    expect(bodyOf(name)).toMatch(/SET search_path = ''/);
    expect(bodyOf(name)).not.toMatch(/SET search_path = public/);
  });

  it.each(FUNCTIONS)('%s qualifies its relation references', (name) => {
    // With the path pinned to '', a bare `crm_contacts` inside an
    // `ON CONFLICT DO UPDATE` resolves to nothing and the trigger raises on every
    // contact-form submission. The qualified names are what make the empty path
    // safe to adopt.
    const code = bodyOf(name).replace(/--[^\n]*/g, '');
    const bare = code.match(/(?<!public\.)\b(crm_contacts|crm_activities|profiles|orders)\b/g);
    expect(bare ?? []).toEqual([]);
  });

  it('keeps all three functions SECURITY DEFINER', () => {
    // The privilege escalation is the point of these triggers: they write CRM
    // rows from an anon-insertable table, which RLS would otherwise refuse.
    for (const name of FUNCTIONS) {
      expect(bodyOf(name)).toMatch(/SECURITY DEFINER/);
    }
  });

  it('leaves the triggers attached, so recreating the functions does not detach them', () => {
    // `CREATE OR REPLACE` preserves an existing trigger's binding. A dropped
    // trigger leaves a table silently unsynced, which is the failure mode this
    // whole migration exists to prevent — so the migration asserts the three
    // names are present rather than assuming it.
    for (const name of [
      'trg_sync_contact_submission_to_crm',
      'trg_sync_profile_to_crm',
      'trg_sync_order_to_crm',
    ]) {
      expect(SQL).toContain(name);
    }
    expect(SQL).toMatch(/pg_trigger/);
  });
});
