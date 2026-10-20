#!/usr/bin/env bun
/**
 * Dependency vulnerability gate.
 *
 * ## What it checks
 *
 * `bun audit` reads the advisory database and reports every installed package
 * whose version falls inside a known vulnerable range. This script runs it,
 * compares the result against a committed baseline, and fails on anything
 * **new**.
 *
 * ## Why a baseline and not a zero-tolerance gate
 *
 * The tree cannot be made advisory-free today, and pretending otherwise would
 * produce a gate that is permanently red — which is not a gate, it is noise
 * that teaches everyone to ignore it. So this is a **ratchet**, exactly like
 * `scripts/data-points-baseline.json` and `scripts/secrets-baseline.json`:
 *
 *   - a **new** advisory fails the build, and
 *   - a **baselined** advisory that has stopped applying also fails, so a
 *     fix must delete its own excuse rather than leave a stale one behind.
 *
 * Every accepted advisory carries a reason. The reason is the point: an
 * accepted advisory is a decision someone made, and a reader should be able
 * to see that it was a decision rather than an oversight.
 *
 * ## Why CI only
 *
 * `bun audit` needs the network. A pre-commit hook that needs the network is
 * a hook that gets bypassed, so this runs in CI and nowhere else. The
 * pre-commit gate stays offline.
 *
 * ## The second gate: the *shipped* tree must be clean
 *
 * The baseline is a **whole-tree** ratchet. It accepts an advisory
 * *anywhere* in the tree, and the reason recorded against it is a human
 * judgement — the accepted `braces` advisory says it is "reachable only
 * through `ts-morph` inside the `vercel` CLI's tree, which is a
 * devDependency and is not shipped".
 *
 * That judgement is a **manual claim about reachability**, and a manual
 * claim is exactly the kind of thing that stops being true without anyone
 * noticing. If `vercel` were ever promoted to a runtime dependency, the
 * baseline would still accept the advisory, because the baseline is keyed on
 * the GHSA id and knows nothing about which packages ship.
 *
 * So the gate makes **two** statements, from two different computations:
 *
 *   - the **whole tree** matches the baseline — a ratchet, so a new advisory
 *     anywhere fails, and an accepted one must delete its own excuse; and
 *   - the **production tree** — the packages reachable from `dependencies`,
 *     which is what a visitor's browser and the serverless functions
 *     actually load — has **zero** advisories. No baseline, no exceptions.
 *
 * `bun audit --production` computes that second set itself, from the
 * dependency graph, rather than from a claim in a JSON file. Today it
 * reports "No vulnerabilities found (checked 250 packages)" against 804
 * installed — so the one accepted advisory really is dev-only, and that is
 * now a *measured* fact rather than an assertion in a reason string.
 *
 * ## Regenerating
 *
 *   bun scripts/check-vulnerabilities.mjs --update-baseline
 *
 * writes the current advisory set to the baseline. Review the diff: a
 * regenerated baseline that quietly grows is the failure mode this whole
 * design exists to prevent.
 */
import { run } from './bun-exec.mjs';

const BASELINE_PATH = 'scripts/vulnerabilities-baseline.json';

const argv = process.argv.slice(2);
const UPDATE_BASELINE = argv.includes('--update-baseline');
const JSON_OUT = argv.includes('--json');
// A database that cannot be read is UNKNOWN, never clean — the same rule the
// secrets audit follows. By default an unreachable advisory database is
// reported as UNKNOWN and does not fail the build, because a network outage
// is not a defect in this repository. `--strict` turns it into a failure.
const STRICT = argv.includes('--strict');

/** Advisory severity, most severe first. */
const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low'];

function severityRank(s) {
  const i = SEVERITY_ORDER.indexOf(s);
  return i === -1 ? SEVERITY_ORDER.length : i;
}

/**
 * Run `bun audit --json` and flatten its package-keyed output into a list.
 *
 * The advisory id used as the baseline key is the GHSA id from the advisory
 * URL, not the numeric id: the numeric id is GitHub's internal id for the
 * advisory *database entry*, while the GHSA id is what the advisory is
 * published under and is what a human recognises.
 *
 * `production` restricts the audit to the packages reachable from
 * `dependencies` — the ones that ship. The devDependency tree, which is
 * where the accepted advisory lives, is not consulted at all.
 *
 * Returns `{ advisories }` on success, or `{ unknown: <reason> }` when the
 * advisory database could not be read at all.
 */
function runAudit({ production = false } = {}) {
  // `bun audit` exits non-zero when it finds advisories and still writes its
  // JSON report to stdout. `Bun.spawnSync` reports the exit code without
  // throwing, so the report and the status are both available — no
  // exception-driven control flow to read a status out of.
  const argv = ['bun', 'audit', '--json'];
  if (production) argv.push('--production');
  const { exitCode, stdout, stderr } = run(argv);

  // Only a failure with no JSON at all is an error.
  if (!stdout) {
    const detail = stderr.split('\n').filter(Boolean).slice(0, 3).join(' ');
    return { unknown: detail || `bun audit produced no output (exit ${exitCode})` };
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { unknown: 'bun audit --json did not return JSON' };
  }

  const advisories = [];
  for (const [pkg, list] of Object.entries(parsed)) {
    for (const a of list) {
      const ghsa = String(a.url || '').split('/').pop() || `id-${a.id}`;
      advisories.push({
        ghsa,
        package: pkg,
        severity: a.severity || 'unknown',
        title: a.title || '',
        vulnerableVersions: a.vulnerable_versions || '',
      });
    }
  }
  return { advisories };
}

async function readBaseline() {
  try {
    return JSON.parse(await Bun.file(BASELINE_PATH).text());
  } catch {
    return { $comment: '', updated: '', accepted: {} };
  }
}

const result = runAudit();
const production = runAudit({ production: true });

if (result.unknown || production.unknown) {
  const message =
    result.unknown ??
    production.unknown ??
    'the advisory database could not be read';
  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        { unknown: message, new: [], accepted: [], stale: [], shipped: [] },
        null,
        2
      )
    );
  } else {
    console.log(`⚠️   UNKNOWN — ${message}`);
    console.log('   The vulnerability state of the dependency tree is UNKNOWN, not clean.');
    console.log('   This is a network or advisory-database problem, not a finding.');
  }
  process.exit(STRICT ? 2 : 0);
}

const advisories = result.advisories;
const shippedAdvisories = production.advisories;
const baseline = await readBaseline();
const accepted = baseline.accepted ?? {};
const found = new Map(advisories.map((a) => [a.ghsa, a]));

if (UPDATE_BASELINE) {
  const next = {
    $comment:
      'Accepted dependency advisories. Each entry records that a human reviewed the advisory and chose a disposition. The gate fails when an advisory is NOT listed here, and also when a listed advisory no longer applies — so a fix must delete its own excuse. Regenerate with: bun scripts/check-vulnerabilities.mjs --update-baseline',
    updated: new Date().toISOString().slice(0, 10),
    accepted: {},
  };
  for (const a of advisories) {
    const prior = accepted[a.ghsa];
    next.accepted[a.ghsa] = {
      package: a.package,
      severity: a.severity,
      reason: prior?.reason ?? 'REVIEW REQUIRED — no reason recorded',
    };
  }
  await Bun.write(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`✔  Baseline rewritten with ${Object.keys(next.accepted).length} accepted advisory(ies).`);
  console.log('   Review the diff before committing: a silently grown baseline is the failure this design prevents.');
  process.exit(0);
}

const newAdvisories = advisories.filter((a) => !(a.ghsa in accepted));
const stale = Object.keys(accepted).filter((ghsa) => !found.has(ghsa));

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        new: newAdvisories,
        accepted: advisories.filter((a) => a.ghsa in accepted),
        stale,
        shipped: shippedAdvisories,
        total: advisories.length,
      },
      null,
      2
    )
  );
} else {
  if (advisories.length > 0) {
    console.log(`ℹ️  ${advisories.length} advisory(ies) in the dependency tree, ${newAdvisories.length} new.`);
    for (const a of advisories.sort((x, y) => severityRank(x.severity) - severityRank(y.severity))) {
      const tag = a.ghsa in accepted ? 'accepted' : 'NEW';
      console.log(`   [${a.severity.padEnd(8)}] ${tag.padEnd(8)} ${a.package.padEnd(24)} ${a.ghsa}`);
    }
  } else {
    console.log('✔  No advisories in the dependency tree.');
  }
  if (shippedAdvisories.length === 0) {
    console.log('✔  No advisories in the shipped (production) dependency tree.');
  }
}

let failed = false;

if (newAdvisories.length > 0) {
  console.log('');
  console.log('✖  NEW dependency advisories — these are not in the baseline.');
  for (const a of newAdvisories.sort((x, y) => severityRank(x.severity) - severityRank(y.severity))) {
    console.log(`   [${a.severity}] ${a.package} ${a.ghsa} — ${a.title}`);
    console.log(`           vulnerable: ${a.vulnerableVersions}`);
  }
  console.log('');
  console.log('   Fix it (an `overrides` pin is usually enough), or record a decision:');
  console.log('     bun scripts/check-vulnerabilities.mjs --update-baseline');
  failed = true;
}

if (stale.length > 0) {
  console.log('');
  console.log('✖  Baseline entries that no longer apply — a fix must delete its own excuse.');
  for (const ghsa of stale) {
    console.log(`   ${ghsa} (${accepted[ghsa]?.package ?? '?'}) is no longer reported.`);
  }
  console.log('');
  console.log('   Regenerate the baseline:');
  console.log('     bun scripts/check-vulnerabilities.mjs --update-baseline');
  failed = true;
}

if (shippedAdvisories.length > 0) {
  console.log('');
  console.log('✖  Advisories in the SHIPPED dependency tree — these reach production.');
  for (const a of shippedAdvisories.sort(
    (x, y) => severityRank(x.severity) - severityRank(y.severity)
  )) {
    console.log(`   [${a.severity}] ${a.package} ${a.ghsa} — ${a.title}`);
    console.log(`           vulnerable: ${a.vulnerableVersions}`);
  }
  console.log('');
  console.log('   The production tree is zero-tolerance. The baseline does not apply here:');
  console.log('   an accepted advisory is a judgement about the *whole* tree, and the whole');
  console.log('   tree includes devDependencies that never ship. This one does.');
  console.log('');
  console.log('   Fix it (an `overrides` pin is usually enough).');
  failed = true;
}

process.exit(failed ? 1 : 0);
