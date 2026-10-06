#!/usr/bin/env bun
/**
 * Apply pending Supabase migrations via the Management API.
 *
 * Fallback delivery path for CI when the `supabase db push` route is
 * unavailable (e.g. runner without IPv6 egress to the direct DB host).
 * Uses only the repo's existing SUPABASE_ACCESS_TOKEN over IPv4 HTTPS.
 *
 * Idempotent: re-reads remote history, applies only missing files in
 * filename order, records each in supabase_migrations.schema_migrations
 * exactly as `db push` would (version-keyed), then re-verifies.
 *
 * Exit 0 = local files ⊆ remote history (converged, incl. nothing-pending).
 * Exit 1 = discrepancy or API failure. All phases emit ::notice::/::error::
 * annotations (CI log retrieval is unreliable; annotations are readable).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REF = process.env.SUPABASE_PROJECT_REF ?? '';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const DIR = process.env.MIGRATIONS_DIR ?? 'supabase/migrations';
const API = 'https://api.supabase.com';

const notice = (msg) => console.log(`::notice::${msg}`);

class MigrationError extends Error {}

/**
 * @param {string} query
 * @param {{ref: string, token: string}} creds
 */
async function api(query, { ref, token }) {
  const res = await fetch(`${API}/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API HTTP ${res.status}: ${text.slice(0, 400)}`);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Management API returned non-JSON: ${text.slice(0, 200)}`);
  }
  // Shape varies by endpoint version — normalize to rows array.
  if (Array.isArray(parsed)) return parsed;
  for (const key of ['result', 'data', 'rows', 'results']) {
    if (Array.isArray(parsed?.[key])) return parsed[key];
  }
  throw new Error(`Unrecognized API response shape (keys: ${Object.keys(parsed ?? {}).join(',')})`);
}

const versionsOf = (rows) => new Set(rows.map((r) => String(r.version ?? r[0])));

/**
 * @param {string} dir
 * @returns {{version: string, file: string}[]}
 */
function localMigrations(dir) {
  const files = readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
  return files.map((f) => ({ version: f.split('_')[0], file: f }));
}

/**
 * @param {{ref: string, token: string}} creds
 * @returns {Promise<Set<string>>}
 */
async function appliedVersions(creds) {
  try {
    const rows = await api('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;', creds);
    return versionsOf(rows);
  } catch (e) {
    // Fresh project without a history table: everything local is pending.
    if (String(e?.message ?? e).includes('does not exist')) return new Set();
    throw e;
  }
}

/**
 * @param {{ref: string, token: string}} creds
 * @returns {Promise<Set<string>>}
 */
async function historyColumns(creds) {
  const rows = await api(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='supabase_migrations' AND table_name='schema_migrations';`,
    creds
  );
  return new Set(rows.map((r) => String(r.column_name ?? r[0])));
}

const esc = (s) => s.replace(/'/g, "''");

/**
 * Apply every local migration the remote history does not already record.
 *
 * Exported, and taking its environment as an object, so the delivery path can
 * be exercised without a Supabase project and without mutating `process.env`.
 * Two reasons that matters beyond convenience:
 *
 *  - The failure this file has to get right — a migration applied but not
 *    recorded — cannot be observed by a read-only check, or by a test that does
 *    not drive the writes.
 *  - A parameter defaulted to `process.env` without a type annotation infers
 *    `ProcessEnv`, which requires `NODE_ENV` and so rejects any caller passing
 *    only the three keys actually read.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<void>}
 * @throws {MigrationError} on any discrepancy or API failure
 */
export async function main(env = process.env) {
  const ref = env.SUPABASE_PROJECT_REF ?? '';
  const token = env.SUPABASE_ACCESS_TOKEN ?? '';
  const dir = env.MIGRATIONS_DIR ?? 'supabase/migrations';
  const creds = { ref, token };
  const fail = (msg) => {
    throw new MigrationError(msg);
  };

  if (!ref || !token) fail('SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN env must be set');
  // Boot check: proves auth + reveals response shape handling.
  const boot = await api('SELECT 1 AS ok;', creds);
  notice(`management API reachable (boot rows: ${boot.length})`);

  const local = localMigrations(dir);
  const applied = await appliedVersions(creds);
  const pending = local.filter((m) => !applied.has(m.version));
  notice(`local=${local.length} applied=${applied.size} pending=[${pending.map((m) => m.version).join(',') || 'none'}]`);
  if (pending.length === 0) {
    notice('schema already converged — nothing to do');
    return;
  }

  const cols = await historyColumns(creds);
  const hasName = cols.has('name');
  for (const m of pending) {
    const sql = readFileSync(join(dir, m.file), 'utf8');
    if (!sql.trim()) fail(`migration file empty: ${m.file}`);
    // The schema change and the history row go in ONE request, wrapped in an
    // explicit transaction.
    //
    // Sending them as two requests is the failure this fixes. If the second
    // call fails, the schema is applied but unrecorded, so the next run treats
    // the migration as pending again and re-applies it — and any migration not
    // written to be re-runnable (`ALTER TABLE … ADD COLUMN` without
    // `IF NOT EXISTS`, `CREATE INDEX` without `IF NOT EXISTS`) then fails
    // forever. The schema is already correct, so the operator is stuck retrying
    // a migration that cannot succeed twice, blocking every later migration
    // behind it. The contact form has exactly this shape: 020000 replaces
    // `submit_contact_submission`'s arity via DROP/CREATE.
    //
    // `BEGIN` inside a transaction the endpoint already opened is a WARNING,
    // not an error, and the trailing `COMMIT` still commits — so this is correct
    // whether or not the endpoint wraps the batch itself, which is precisely the
    // thing nobody had verified.
    const namePart = hasName ? `, name` : ``;
    const nameVal = hasName ? `, '${esc(m.file)}'` : ``;
    await api(
      `BEGIN;\n${sql}\nINSERT INTO supabase_migrations.schema_migrations(version${namePart}) VALUES ('${esc(m.version)}'${nameVal}) ON CONFLICT (version) DO NOTHING;\nCOMMIT;`,
      creds
    );
    notice(`applied ${m.version} (${m.file})`);
  }

  const reapplied = await appliedVersions(creds);
  const missing = pending.filter((m) => !reapplied.has(m.version));
  if (missing.length > 0)
    fail(`verify failed, still missing: ${missing.map((m) => m.version).join(',')}`);
  notice(`verify passed — all ${pending.length} pending migration(s) now recorded`);
}

// Direct invocation only. Importing this module must not deliver a migration.
if (process.argv[1]?.endsWith('apply-migrations.mjs')) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.log(`::error::apply-migrations failed: ${String(e?.message ?? e).slice(0, 400)}`);
      process.exit(1);
    });
}
