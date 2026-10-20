#!/usr/bin/env bun
/**
 * Authoritative live audit of all four secret stores.
 *
 *   bun scripts/secrets-audit.mjs             # live reconcile (needs CLIs + auth)
 *   bun scripts/secrets-audit.mjs --offline   # contract-only, no network
 *   bun scripts/secrets-audit.mjs --json      # machine-readable
 *   bun scripts/secrets-audit.mjs --store=edge-secret
 *
 * ## The gap this closes
 *
 * Three offline checkers already guard the declared contracts:
 * `check-vercel-env.mjs`, `check-ci-env.mjs`, `check-edge-secrets.mjs`. Each is
 * good at one thing — proving the manifest agrees with the source. None of them
 * can see a dashboard, so none of them can answer the question that actually
 * bites: *is the value there, in the right store, classified correctly, owned by
 * someone?*
 *
 * That is not a theoretical gap. A live audit on 2026-09-27 found production
 * drift in every category the offline gates claim to cover, and not one of them
 * could see it: three `verify: true` edge secrets unset (commerce returning
 * 503), all three `NEXT_PUBLIC_*` values held as GitHub *secrets* (so fork PRs
 * build against empty config), a `required: true` variable that was never set,
 * and twelve secrets in the hosted edge project that no manifest declares and no
 * function reads — including a `GITHUB_TOKEN`, in a store shared with four
 * publicly-callable functions.
 *
 * ## Design rules
 *
 * 1. **A failed read is not an empty store.** Every probe returns a status, and
 *    `unreachable` is reported as its own finding class, never as "0 secrets".
 *    This is the single most important property here. The bug that produced the
 *    existing `supabase.yml` guard's own comment — a `grep '"name": "X"'` that
 *    silently matched nothing because the CLI emits compact JSON — is the same
 *    class of error as treating an expired token as "no secrets configured".
 *    Both produce a confident, wrong, and quiet answer. `--strict` turns an
 *    unreachable store into a hard failure.
 *
 * 2. **Read-only. There is no mutation path in this file.** Where reality is
 *    wrong it prints the exact command that would fix it and exits non-zero.
 *    Deleting or moving a live credential is an outage, and a linter that can
 *    do that is a liability, not a tool.
 *
 * 3. **Values are never read or printed.** The Supabase CLI returns digests, not
 *    values. This tool collects *names* only, and parses `.env.local` for names
 *    while discarding everything after the first `=`.
 *
 * 4. **One source of truth per fact.** Names and required/optional status come
 *    from the three existing manifests. `secrets-registry.mjs` contributes only
 *    the axes they cannot express — exposure, owner, expected store. There is no
 *    fourth list of names to drift.
 *
 * ## Baseline
 *
 * A gate that is red on arrival is a gate people learn to ignore, and this
 * project is not clean on arrival: the audit that found the drift also *found*
 * it, so a hard-failing check would be permanently red from its first run and
 * would train everyone to dismiss it. That is how the original three
 * `verify: true` edge secrets stayed missing for so long.
 *
 * So findings are fingerprinted (`code:store:name` — stable across runs,
 * insensitive to rewording) and compared against a committed baseline. Accepted
 * findings are reported as KNOWN rather than hidden, and only a *new* finding
 * fails. That converts an unshippable wall of red into a ratchet: the baseline
 * can only get smaller, and every fix removes a line from it.
 *
 *   bun scripts/secrets-audit.mjs --update-baseline   # accept current state
 *
 * The baseline is an acceptance list, not a suppression file: it records that a
 * human looked at a finding and decided to live with it for now, alongside the
 * date they did.
 */

import { resolve } from 'node:path';
import { runOrThrow } from './bun-exec.mjs';
import { STORES } from './secrets-registry.mjs';
import { probeEnv as readVercelEnv } from './vercel-api.mjs';
import {
  buildDeclared,
  reconcile,
  auditRegistryConsistency,
  parseVercelTable,
  fingerprint,
  summarize,
  SEVERITY_ORDER,
} from './secrets-reconciler.mjs';

/**
 * The Vercel CLI is a Node program: its bin carries a `#!/usr/bin/env node`
 * shebang, and this project has no Node runtime. Spawning `vercel` directly
 * therefore fails with ENOENT — the bare name resolves to the lockfile's
 * `node_modules/.bin/vercel` shim, whose interpreter does not exist.
 *
 * Bun ignores shebangs when it is handed a file, so the same CLI runs on
 * Bun's runtime unchanged (verified: `bun node_modules/vercel/dist/vc.js
 * --version` reports the pinned version). The path is resolved from the
 * local install rather than from PATH, so the CLI that answers the audit is
 * the version the lockfile pins — and a missing install is reported as
 * UNKNOWN, never as a clean store.
 */
async function runVercelCli(args) {
  const cli = resolve('node_modules/vercel/dist/vc.js');
  if (!(await Bun.file(cli).exists())) {
    throw new Error('vercel CLI is not installed locally (run `bun install`) and the REST API path was unavailable');
  }
  return runOrThrow(['bun', cli, ...args]);
}
const argv = process.argv.slice(2);
const OFFLINE = argv.includes('--offline');
const JSON_OUT = argv.includes('--json');
const STRICT = argv.includes('--strict');
let STORE_FILTER = argv.find((a) => a.startsWith('--store='))?.slice(8);
const UPDATE_BASELINE = argv.includes('--update-baseline');
const VERIFY = argv.find((a) => a.startsWith('--verify='))?.slice(9);
const BASELINE_PATH = 'scripts/secrets-baseline.json';

const findings = [];

async function probeGithub(kind) {
  const store = kind === 'secret' ? 'github-secret' : 'github-var';
  const cmd = kind === 'secret' ? ['secret', 'list'] : ['variable', 'list'];
  try {
    const { stdout } = await runOrThrow(['gh', ...cmd]);
    const names = stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('Vercel CLI'))
      .map((l) => l.split(/\s+/)[0])
      .filter((n) => /^[A-Z0-9_]+$/.test(n));
    return { store, status: 'ok', names };
  } catch (err) {
    return {
      store,
      status: 'unreachable',
      names: null,
      detail: firstLine(err.stderr) || firstLine(err.message) || 'gh failed',
    };
  }
}

async function probeEdge() {
  try {
    // Address the project explicitly on CI, where there is no `supabase link`
    // state and should not be — link state is interactive, machine-local, and
    // has no place in a runner image. Falls back to link state when the ref is
    // absent so a linked local checkout keeps working.
    //
    // This reads a *public* project ref, not a credential. Auth is unchanged:
    // whatever `SUPABASE_ACCESS_TOKEN` the caller provides.
    const args =
      typeof process.env.SUPABASE_PROJECT_REF === 'string' &&
      process.env.SUPABASE_PROJECT_REF.length > 0
        ? ['secrets', 'list', '--project-ref', process.env.SUPABASE_PROJECT_REF, '-o', 'json']
        : ['secrets', 'list', '-o', 'json'];
    const { stdout } = await runOrThrow(['supabase', ...args]);
    const parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed)) throw new Error('unexpected shape');
    return {
      store: 'edge-secret',
      status: 'ok',
      names: parsed.map((s) => s.name),
    };
  } catch (err) {
    return {
      store: 'edge-secret',
      status: 'unreachable',
      names: null,
      detail:
        firstLine(err.stderr) ||
        (err instanceof SyntaxError ? 'could not parse `secrets list -o json` output' : firstLine(err.message)) ||
        'supabase CLI failed',
    };
  }
}

async function probeVercelApi(projectId, teamId, token) {
  // Moved to scripts/vercel-api.mjs so every Vercel read in the repository
  // shares one client and one explanation of why the CLI is not an option.
  // Behaviour is unchanged: same endpoint, same classification.
  return await readVercelEnv(projectId, teamId, token);
}

async function probeVercel() {
  const results = [];
  // Prefer the API when the project is addressed explicitly. Fall back to the
  // CLI — and its link state — for a local checkout that never sets these.
  const api =
    typeof process.env.VERCEL_PROJECT_ID === 'string' &&
    process.env.VERCEL_PROJECT_ID.length > 0 &&
    typeof process.env.VERCEL_TOKEN === 'string' &&
    process.env.VERCEL_TOKEN.length > 0
      ? {
          projectId: process.env.VERCEL_PROJECT_ID,
          teamId:
            typeof process.env.VERCEL_ORG_ID === 'string' &&
            process.env.VERCEL_ORG_ID.length > 0
              ? process.env.VERCEL_ORG_ID
              : '',
          token: process.env.VERCEL_TOKEN,
        }
      : null;
  for (const [store, expected] of [
    ['vercel-var', 'plain'],
    ['vercel-secret', 'secret'],
  ]) {
    try {
      const names = api
        ? await probeVercelApi(api.projectId, api.teamId, api.token)
        : parseVercelTable((await runVercelCli(['env', 'ls'])).stdout);
      results.push({ store, status: 'ok', names: names[expected] ?? [], all: names });
    } catch (err) {
      results.push({
        store,
        status: 'unreachable',
        names: null,
        detail: firstLine(err.stderr) || firstLine(err.message) || 'vercel read failed',
      });
    }
  }
  return results;
}

async function probeLocal() {
  let source;
  try {
    source = await Bun.file('.env.local').text();
  } catch {
    return { store: 'local', status: 'skipped', names: null, detail: '.env.local not present' };
  }
  const names = [...source.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);
  return { store: 'local', status: 'ok', names };
}

function firstLine(v) {
  if (!v) return null;
  const line = String(v)
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !/^(Vercel CLI|Supabase CLI|Authenticated to|Logged in)/i.test(l));
  return line ?? null;
}

async function audit() {
  const declared = buildDeclared();
  const live = new Map();

  if (OFFLINE) {
    const registryFindings = auditRegistryConsistency(declared);
    for (const f of registryFindings) findings.push(f);
    if (STORE_FILTER) add('info', 'offline-filter', `--store=${STORE_FILTER} ignored in --offline mode`);
    return;
  }
  if (!STORE_FILTER) STORE_FILTER = null;

  const probes = [await probeGithub('secret'), await probeGithub('var'), await probeEdge()];
  if (!STORE_FILTER || STORE_FILTER.startsWith('vercel')) {
    probes.push(...(await probeVercel()));
  }
  probes.push(await probeLocal());

  return Promise.all(probes).then((results) => {
    for (const r of results.flat()) {
      live.set(r.store, {
        ...r,
        names: r.status === 'ok' && r.names ? new Set(r.names) : null,
      });
    }
    const reconcileFindings = reconcile(declared, live, { strict: STRICT, storeFilter: STORE_FILTER });
    for (const f of reconcileFindings) findings.push(f);
    return live;
  });
}

// ── Reporting ───────────────────────────────────────────────────────────────

function report(live, { updateBaseline = false } = {}) {
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          mode: OFFLINE ? 'offline' : 'live',
          findings,
          // A Map serialises to {} — flatten it so consumers get real data.
          stores: live ? Object.fromEntries(live) : null,
        },
        null,
        2
      )
    );
  } else {
    if (live) {
      console.log('\nStore reachability');
      for (const [store, r] of live) {
        const mark = r.status === 'ok' ? '✓' : r.status === 'skipped' ? '–' : '✖';
        const count = r.status === 'ok' ? `${r.names.size} value(s)` : 'UNKNOWN';
        console.log(`  ${mark} ${STORES[store]?.label ?? store.padEnd(30)} ${count}` +
          (r.detail ? `  — ${r.detail}` : ''));
      }
    }

    if (findings.length === 0) {
      console.log('\n✅ Secret audit clean — every store readable, no drift found.\n');
      return;
    }

    if (updateBaseline) {
      console.log(`\nBaseline update: ${findings.filter((f) => f.severity !== 'info').length} finding(s) accepted.\n`);
      return;
    }

    const fresh = findings.filter((f) => f.state !== 'known');
    const known = findings.filter((f) => f.state === 'known');

    const bySeverity = {};
    for (const f of fresh) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    const freshSummary = Object.entries(bySeverity)
      .sort((a, b) => SEVERITY_ORDER[a[0]] - SEVERITY_ORDER[b[0]])
      .map(([s, n]) => `${n} ${s}`)
      .join(', ');

    if (fresh.length === 0) {
      console.log(
        `\n✅ No new secret drift — ${known.length} finding(s) match the accepted baseline.\n` +
          `   Re-accept after fixing with: bun scripts/secrets-audit.mjs --update-baseline\n`
      );
      return;
    }

    console.log(`\n✖ ${fresh.length} NEW secret finding(s): ${freshSummary}\n`);

    for (const f of fresh) {
      console.log(`  [${f.severity.toUpperCase()}] ${f.code}: ${f.message}`);
      if (f.remediation) console.log(`      → ${f.remediation}`);
      console.log('');
    }
    if (known.length > 0) {
      console.log(`  ${known.length} further finding(s) match the accepted baseline and are not shown.`);
      console.log('  They are still real — see scripts/secrets-baseline.json.\n');
    }
    console.log('  Read-only audit. Nothing above was changed.\n');
  }
}

async function loadBaseline() {
  if (UPDATE_BASELINE) return { accepted: new Map(), path: BASELINE_PATH };
  try {
    const parsed = JSON.parse(await Bun.file(BASELINE_PATH).text());
    return { accepted: new Map(Object.entries(parsed.accepted ?? {})), path: BASELINE_PATH };
  } catch {
    return { accepted: new Map(), path: BASELINE_PATH };
  }
}

// Reconcile reality first. The baseline is applied to the resulting findings, so
// it must be loaded after the audit — reading it first would accept an empty set.
const live = await audit();
const { accepted } = await loadBaseline();

// Tag each finding as known or new. `new` is what the exit code is computed
// from, so accepting today's drift never hides tomorrow's.
for (const f of findings) f.state = accepted.has(fingerprint(f)) ? 'known' : 'new';

if (VERIFY) {
  const stillPresent = findings.filter((f) => fingerprint(f) === VERIFY);
  if (stillPresent.length > 0) {
    console.log(`\n✖ Finding ${VERIFY} is still present:\n`);
    for (const f of stillPresent) {
      console.log(`  [${f.severity.toUpperCase()}] ${f.message}`);
      if (f.remediation) console.log(`      → ${f.remediation}`);
    }
    console.log('');
    process.exit(1);
  }
  const wasAccepted = accepted.has(VERIFY);
  console.log(`\n✅ Finding ${VERIFY} is ${wasAccepted ? 'resolved (was in baseline)' : 'not present — remediated'}.\n`);
  process.exit(0);
}

if (UPDATE_BASELINE) {
  const out = {
    $comment:
      'Accepted secret findings. Each entry records that a human reviewed it and ' +
      'chose to defer the fix. Regenerate with: bun scripts/secrets-audit.mjs --update-baseline',
    updated: new Date().toISOString().slice(0, 10),
    accepted: Object.fromEntries(
      findings
        .filter((f) => f.severity !== 'info')
        .map((f) => [fingerprint(f), { severity: f.severity, summary: summarize(f.message) }])
    ),
  };
  await Bun.write(BASELINE_PATH, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Baseline written: ${Object.keys(out.accepted).length} accepted finding(s) → ${BASELINE_PATH}`);
}

report(live, { updateBaseline: UPDATE_BASELINE });

// Only a *new* finding fails. In --offline mode (the pre-commit hook) only a
// new critical fails, so a deferral cannot be quietly committed through a hook.
const newFindings = findings.filter((f) => f.state !== 'known' && f.severity !== 'info');
const fatal = OFFLINE
  ? newFindings.filter((f) => f.severity === 'critical')
  : newFindings;
if (fatal.length > 0) process.exit(1);

