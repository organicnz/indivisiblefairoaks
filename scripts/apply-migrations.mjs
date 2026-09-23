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
const fail = (msg) => {
  console.log(`::error::${msg}`);
  process.exit(1);
};

async function api(query) {
  const res = await fetch(`${API}/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
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

function localMigrations() {
  const files = readdirSync(DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
  return files.map((f) => ({ version: f.split('_')[0], file: f }));
}

async function appliedVersions() {
  try {
    const rows = await api('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;');
    return versionsOf(rows);
  } catch (e) {
    // Fresh project without a history table: everything local is pending.
    if (String(e?.message ?? e).includes('does not exist')) return new Set();
    throw e;
  }
}

async function historyColumns() {
  const rows = await api(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='supabase_migrations' AND table_name='schema_migrations';`,
  );
  return new Set(rows.map((r) => String(r.column_name ?? r[0])));
}

const esc = (s) => s.replace(/'/g, "''");

async function main() {
  if (!REF || !TOKEN) fail('SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN env must be set');
  // Boot check: proves auth + reveals response shape handling.
  const boot = await api('SELECT 1 AS ok;');
  notice(`management API reachable (boot rows: ${boot.length})`);

  const local = localMigrations();
  const applied = await appliedVersions();
  const pending = local.filter((m) => !applied.has(m.version));
  notice(`local=${local.length} applied=${applied.size} pending=[${pending.map((m) => m.version).join(',') || 'none'}]`);
  if (pending.length === 0) {
    notice('schema already converged — nothing to do');
    return;
  }

  const cols = await historyColumns();
  const hasName = cols.has('name');
  for (const m of pending) {
    const sql = readFileSync(join(DIR, m.file), 'utf8');
    if (!sql.trim()) fail(`migration file empty: ${m.file}`);
    await api(sql); // whole file as one script (SQL-editor parity)
    const namePart = hasName ? `, name` : ``;
    const nameVal = hasName ? `, '${esc(m.file)}'` : ``;
    await api(
      `INSERT INTO supabase_migrations.schema_migrations(version${namePart}) VALUES ('${esc(m.version)}'${nameVal}) ON CONFLICT (version) DO NOTHING;`,
    );
    notice(`applied ${m.version} (${m.file})`);
  }

  const reapplied = await appliedVersions();
  const missing = pending.filter((m) => !reapplied.has(m.version));
  if (missing.length > 0) fail(`verify failed, still missing: ${missing.map((m) => m.version).join(',')}`);
  notice(`verify passed — all ${pending.length} pending migration(s) now recorded`);
}

main().catch((e) => fail(`apply-migrations crashed: ${String(e?.message ?? e).slice(0, 400)}`));
