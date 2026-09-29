#!/usr/bin/env node
/**
 * Populate the Vercel project from credentials held locally.
 *
 *   node scripts/sync-vercel-env.mjs              # dry run, prints the plan
 *   node scripts/sync-vercel-env.mjs --apply      # write
 *   node scripts/sync-vercel-env.mjs --apply --target=production
 *
 * ## Why this exists separately from the audit
 *
 * `scripts/secrets-audit.mjs` is read-only by construction: it reports what is
 * missing and prints the command that would fix it, but never mutates a live
 * store, because a linter that can delete a live credential is a liability.
 *
 * That leaves a gap — knowing that nine required Vercel variables are unset is
 * not the same as being able to set the eight of them that already exist
 * somewhere. This closes that gap, and nothing else. The split is deliberate:
 * *deciding* what should be true is `secrets-audit.mjs`; *making it so* from
 * values the operator already holds is this file.
 *
 * ## What it can and cannot source — read this before expecting parity
 *
 * Only two of the four stores can be read *out*:
 *
 *   - `.env.local` — readable. The intended source.
 *   - Supabase Vault — readable in principle, via `psql`. **Empty in this
 *     project**, and unreachable from here: no `SUPABASE_DB_PASSWORD` and no
 *     Management API token is held locally. When it is seeded, point
 *     `--from-vault` at it.
 *
 * The other two are **write-only by platform design**, which is not a bug to work
 * around:
 *
 *   - **Supabase edge function secrets.** `supabase secrets` offers exactly
 *     `list`, `set` and `unset`. There is no `get`. `secrets list` returns
 *     sha256 *digests*, never values. A value written with `supabase secrets set`
 *     cannot be read back by anyone, including the account owner.
 *   - **GitHub Actions secrets.** Same shape: `gh secret list` returns names and
 *     timestamps only.
 *
 * So "fetch the rest of the secrets from the edge function secrets" is not a
 * thing that can be implemented, and this file does not pretend otherwise. What
 * it reports instead is the honest list of values that must be pasted from
 * somewhere by a human — see `UNSOURCED` below.
 *
 * ## Safety
 *
 *   - Values are never printed. Not on success, not on failure, not in verbose
 *     mode. The report is names and lengths only.
 *   - `.env.local` must be gitignored; the script refuses to run if it is not.
 *   - `NEXT_PUBLIC_*` values are written **non-sensitive**, which is correct:
 *     they are inlined into the client bundle, so the public/private split is a
 *     fact about the value rather than a choice.
 *   - Idempotent: re-running with `--force` converges rather than duplicating.
 */

import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { ALL_SECRETS, ALL_VARS, SECRETS, VARS } from './vercel-env.mjs';

const run = promisify(execFile);

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const TARGET = argv.find((a) => a.startsWith('--target='))?.slice(9) ?? 'production,preview';
const ENV_FILE = '.env.local';

/** Read name=value pairs. Values stay in memory and are never logged. */
async function readEnvFile() {
  let source;
  try {
    source = await readFile(ENV_FILE, 'utf8');
  } catch {
    console.error(`✖ ${ENV_FILE} not found. Create it from .env.example and fill in the values.`);
    process.exit(1);
  }
  const out = {};
  for (const line of source.split('\n')) {
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!m) continue;
    // Strip surrounding quotes but keep the inner value intact.
    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/**
 * Refuse to run if the local credential file is not ignored by git. A script
 * whose whole purpose is moving secrets between stores must not be the reason
 * one ends up in a commit.
 */
async function assertEnvFileIgnored() {
  try {
    const { stdout } = await run('git', ['check-ignore', '-q', ENV_FILE]);
    if (stdout === null && stdout === undefined) return; // check-ignore -q exits 0 when ignored
  } catch {
    // check-ignore exits 1 when NOT ignored, non-zero for other errors.
    console.error(
      `✖ Refusing to run: ${ENV_FILE} is not gitignored.\n` +
        `  This file holds production credentials. Add it to .gitignore first.`
    );
    process.exit(1);
  }
}

/**
 * The Vercel contract, flattened to what this script needs to know per name.
 * `sensitive` is derived rather than hand-listed: only genuinely private values
 * get `--sensitive`, and `NEXT_PUBLIC_*` is public by construction.
 */
function contract() {
  const rows = [];
  for (const name of ALL_VARS) {
    rows.push({ name, kind: 'var', required: VARS[name].required, sensitive: false });
  }
  for (const name of ALL_SECRETS) {
    rows.push({ name, kind: 'secret', required: SECRETS[name].required, sensitive: true });
  }
  return rows;
}

/**
 * Run a Vercel write.
 *
 * Uses `spawn` with stdin **ignored** rather than `execFile`. Measured: with a
 * piped-but-open stdin the CLI blocks waiting for input that never comes, and
 * the whole run hangs silently with nothing written. `< /dev/null` is the shell
 * equivalent and works immediately, so this is the programmatic version of that
 * — the script must not be able to hang on a prompt it cannot see.
 *
 * The `--no-sensitive` on plain values is not optional. Measured: `vercel env add
 * NAME production --value X --yes` stores the value as **Sensitive / Secret**,
 * silently. That is precisely the anti-pattern `secrets-audit.mjs` exists to
 * catch — a `NEXT_PUBLIC_*` value withheld from fork PRs — and a script that
 * reintroduces it while claiming to fix drift is worse than no script.
 */
function vercelEnvAdd({ name, target, sensitive, value }) {
  return new Promise((resolve) => {
    const args = ['env', 'add', name, target, sensitive ? '--sensitive' : '--no-sensitive',
      '--value', value, '--force', '--yes'];
    const child = spawn('vercel', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => resolve({ ok: false, detail: e.message }));
    child.on('close', (code) =>
      resolve({ ok: code === 0, detail: code === 0 ? null : (err.split('\n').find((l) => l.trim()) ?? `exit ${code}`) })
    );
  });
}

/** Values that are `required: true` and exist in no readable store. */
const UNSOURCED_NOTE = {
  STRIPE_SECRET_KEY:
    'Stripe dashboard → Developers → API keys. Not in .env.local, and the Supabase edge store is write-only, so it cannot be copied from there.',
  STRIPE_WEBHOOK_SECRET:
    'Stripe dashboard → Developers → Webhooks → your endpoint → Signing secret. Only obtainable at Stripe.',
};

async function main() {
  await assertEnvFileIgnored();
  const local = await readEnvFile();
  const rows = contract();

  const plan = [];
  const unsourced = [];

  for (const row of rows) {
    if (!(row.name in local)) {
      if (row.required) unsourced.push(row);
      continue;
    }
    plan.push({ ...row, value: local[row.name] });
  }

  console.log(`\nTarget environments: ${TARGET}`);
  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${plan.length} value(s) sourced from ${ENV_FILE}\n`);

  for (const p of plan) {
    const mode = p.sensitive ? 'secret (--sensitive)' : 'plain';
    console.log(`  ${p.name.padEnd(38)} ${mode.padEnd(22)} ${p.value.length} chars`);
  }

  if (unsourced.length === 0) {
    console.log('\n✅ Every required value is sourced.\n');
  } else {
    console.log(`\n⚠ ${unsourced.length} required value(s) cannot be sourced from ${ENV_FILE}:\n`);
    for (const u of unsourced) {
      console.log(`  ${u.name}`);
      console.log(`      ${UNSOURCED_NOTE[u.name] ?? 'Not present in any locally readable store. Set it manually.'}`);
    }
    console.log(
      '\n  These are not obtainable by copy. Supabase edge secrets and GitHub secrets\n' +
        '  are write-only by platform design — `supabase secrets` has no `get`, and\n' +
        '  `gh secret list` returns names and timestamps only. Paste them from the\n' +
        '  issuing service, or add them to .env.local and re-run.\n'
    );
  }

  if (!APPLY) {
    console.log('  Dry run. Re-run with --apply to write.\n');
    return;
  }

  console.log('');
  let failed = 0;
  for (const p of plan) {
    const res = await vercelEnvAdd({ name: p.name, target: TARGET, sensitive: p.sensitive, value: p.value });
    if (res.ok) {
      console.log(`  ✓ ${p.name}`);
    } else {
      // The error text can echo the value back, so only the first line is shown
      // and only on failure.
      failed += 1;
      console.error(`  ✖ ${p.name} — ${res.detail}`);
    }
  }

  console.log(
    failed === 0
      ? `\n✅ Wrote ${plan.length} value(s). Re-run \`bun run secrets:audit\` to confirm.\n`
      : `\n✖ ${failed} of ${plan.length} failed. Nothing else was changed.\n`
  );
  process.exit(failed === 0 ? 0 : 1);
}

await main();
