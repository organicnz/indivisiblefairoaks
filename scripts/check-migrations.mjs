#!/usr/bin/env node
/**
 * Pre-merge migration history check. Read-only; writes nothing, anywhere.
 *
 *   node scripts/check-migrations.mjs
 *
 * ## Why this exists separately from `supabase.yml`'s dry-run
 *
 * `supabase.yml` triggers on `push` to `main` **with a `supabase/**` path
 * filter**, so on a pull request it does not run at all. That is fine for its
 * purpose — it is delivery — and it makes `migrate` unusable as a *required
 * status check*: a required check that never reports blocks every PR that does
 * not touch that path, so enabling it would wedge the repository.
 *
 * This job has no path filter, so it always reports, which is the only property
 * a required check needs. It validates *history consistency* against the hosted
 * project's recorded versions, using the same Management API read that
 * `scripts/apply-migrations.mjs` already proves works over IPv4 on this fleet.
 * No CLI, no database connection, no writes.
 *
 * ## What this catches
 *
 *   - a local migration whose version is already applied but whose file changed
 *     (history divergence — `db push` will refuse, and the refusal is opaque)
 *   - an applied version with no local file (a deleted migration)
 *   - a new migration numbered *behind* the highest applied version, which
 *     makes the ordering non-monotonic
 *   - duplicate versions, malformed filenames, empty migration files
 *
 * ## What this deliberately does NOT catch — read this before trusting a green
 *
 *   - **SQL that is wrong.** Nothing here executes a statement. A migration that
 *     references a non-existent column passes this check and fails on push.
 *   - **The app/schema race.** The application and its migrations ship in the
 *     same commit, so nothing in CI can distinguish "app deployed, schema
 *     behind" from "both deployed". Ordering them is a merge-order discipline,
 *     documented in `docs/branch-hardening-plan.md` §0.7, not something a check
 *     can observe. Closing it properly would mean applying migrations on the PR,
 *     which is a policy change (unreviewed schema reaching production before
 *     merge) and deliberately not done here.
 *
 * So a green result means "history is coherent", not "this migration is safe".
 * That distinction is the whole reason this file documents its limits rather
 * than claiming coverage.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REF = process.env.SUPABASE_PROJECT_REF ?? '';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const DIR = process.env.MIGRATIONS_DIR ?? 'supabase/migrations';
const API = 'https://api.supabase.com';

const notice = (m) => console.log(`::notice::${m}`);
const error = (m) => console.log(`::error::${m}`);

async function api(query) {
  const res = await fetch(`${API}/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API HTTP ${res.status}: ${text.slice(0, 300)}`);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Management API returned non-JSON');
  }
  if (Array.isArray(parsed)) return parsed;
  for (const key of ['result', 'data', 'rows', 'results']) {
    if (Array.isArray(parsed?.[key])) return parsed[key];
  }
  throw new Error(`Unrecognized API response shape (keys: ${Object.keys(parsed ?? {}).join(',')})`);
}

function localMigrations() {
  let files;
  try {
    files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    return null;
  }
  return files.map((file) => ({ version: file.split('_')[0], file }));
}

async function main() {
  // Local invariants run FIRST and need no credentials and no network. A
  // malformed filename or a duplicate version is a fact about the checkout, so
  // reporting it must not depend on a token being present — otherwise the check
  // answers "cannot check" for a repository it could have diagnosed locally.
  const local = localMigrations();
  const problems = [];

  if (!local) {
    error(`No migrations directory at ${DIR}.`);
    return 1;
  }

  const seen = new Map();
  for (const m of local) {
    if (!/^\d+_[a-z0-9_-]+\.sql$/.test(m.file)) {
      problems.push(`Malformed migration filename: ${m.file} (expected <version>_<snake_name>.sql)`);
    }
    if (seen.has(m.version)) {
      problems.push(`Duplicate version ${m.version}: ${seen.get(m.version)} and ${m.file}`);
    } else {
      seen.set(m.version, m.file);
    }
    if (readFileSync(join(DIR, m.file), 'utf8').trim() === '') {
      problems.push(`Empty migration file: ${m.file}`);
    }
  }
  if (local.length === 0) problems.push('No migration files found.');

  if (problems.length > 0) {
    for (const p of problems) error(p);
    error('Local migration files are inconsistent — no need to consult the hosted project.');
    return 1;
  }

  // Remote read, for the cross-checks that need history.
  if (!REF || !TOKEN) {
    notice(`${local.length} migration file(s) are locally well-formed.`);
    error('SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN are not set — history cross-check skipped.');
    error('This is a configuration fault on our side, not a migration fault.');
    return 1;
  }

  let applied = new Set();
  let historyReadable = true;
  try {
    const rows = await api('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;');
    applied = new Set(rows.map((r) => String(r.version ?? r[0])));
  } catch (e) {
    const msg = String(e?.message ?? e);
    // A project without the history table has applied nothing. That is a real
    // state, not a fault — but it must be stated, because "no history" and "we
    // could not read history" are different and only one of them means the
    // migrations are unapplied.
    if (msg.includes('does not exist')) {
      historyReadable = false;
      notice('Hosted project has no supabase_migrations.schema_migrations — treating as nothing applied.');
    } else {
      error(`Could not read migration history: ${msg}`);
      error('Our check failed. This is NOT evidence about the migrations.');
      return 1;
    }
  }

  if (historyReadable) {
    const highest = [...applied].sort().at(-1);

    for (const version of applied) {
      if (!seen.has(version)) {
        problems.push(
          `Version ${version} is recorded as applied on the hosted project but has no file in ${DIR}. ` +
            `A migration was deleted or renamed after it shipped.`
        );
      }
    }

    for (const m of local) {
      // The ordering trap: a NEW migration numbered below the highest applied
      // one. `db push` compares histories and the divergence surfaces as an
      // error that names a version rather than the file you added.
      if (highest && m.version < highest && !applied.has(m.version)) {
        problems.push(
          `${m.file} is numbered below ${highest}, the highest version already applied. ` +
            `Migration versions must increase monotonically — renumber this one above ${highest}.`
        );
      }
    }

    const pending = local.filter((m) => !applied.has(m.version)).map((m) => m.version);
    notice(
      `${local.length} migration file(s), ${applied.size} applied on the hosted project` +
        (pending.length ? `, ${pending.length} pending: ${pending.join(', ')}` : ', nothing pending')
    );
  } else {
    notice(`${local.length} migration file(s); nothing applied yet.`);
  }

  if (problems.length > 0) {
    for (const p of problems) error(p);
    return 1;
  }

  notice('Migration history is coherent.');
  return 0;
}

process.exit(await main());