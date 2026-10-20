#!/usr/bin/env bun
/**
 * Lock file sync check (pre-push).
 *
 * ## What it protects
 *
 * A `package.json` change that alters the **dependency graph** must be
 * accompanied by a regenerated `bun.lock`. A CI step then runs
 * `bun install --frozen-lockfile`, which fails when the lockfile and the
 * manifest disagree — so the failure surfaces at the runner rather than at
 * the commit, and the message names Bun's lockfile rather than the change
 * that caused it.
 *
 * ## Why it compares the dependency graph and not the file name
 *
 * The obvious implementation is a filename comparison: "did `package.json`
 * change without `bun.lock` changing?" That is what this file used to do, and
 * it produced a false positive on any change to `scripts` — the `prepare`
 * script moving to `bun scripts/install-hooks.mjs`, a `--bun` flag added to a
 * command. Those changes do not touch a single dependency, `bun install`
 * correctly writes no lockfile change, and the guard then told the developer
 * to run `bun install` again, which would again change nothing.
 *
 * That is a gate that is red for a reason that cannot be fixed, which is the
 * same failure mode as a gate that is sometimes red for no reason: people
 * reach for the bypass, and the next genuine drift goes with it.
 *
 * So the guard compares what the lockfile actually depends on: the dependency
 * sections of `package.json`, at the current revision and in the working
 * tree. If those are identical, the lockfile cannot have changed, and its
 * absence is not a finding.
 */
import { tryRunText } from '../bun-exec.mjs';

/**
 * The `package.json` fields the lockfile is derived from.
 *
 * `scripts`, `engines` and everything else are excluded: none of them change
 * the resolved graph, and `bun install` writes no lockfile change for them.
 */
const LOCKFILE_RELEVANT_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'overrides',
  'resolutions',
  'trustedDependencies',
  'workspaces',
  'catalog',
];

/**
 * The dependency-relevant part of a `package.json`, as a stable string.
 *
 * The keys of each section are sorted, so a reordering — which changes
 * nothing about resolution — does not read as a change.
 */
function lockfileRelevantFields(manifest) {
  const selected = {};
  for (const field of LOCKFILE_RELEVANT_FIELDS) {
    const value = manifest?.[field];
    if (value === undefined) continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      selected[field] = Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)));
    } else {
      selected[field] = value;
    }
  }
  return JSON.stringify(selected);
}

/** The `package.json` at a git revision, or `null` when there is not one. */
function manifestAt(ref) {
  const text = tryRunText(['git', 'show', `${ref}:package.json`]);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The `package.json` in the working tree, or `null` when it cannot be read. */
async function workingManifest() {
  try {
    return JSON.parse(await Bun.file('package.json').text());
  } catch {
    return null;
  }
}

/**
 * The files that differ between two git revisions.
 *
 * `null` when the comparison could not be made at all — an upstream branch
 * that does not exist yet, most often. `null` is not the same as an empty
 * list: an empty list means "nothing changed", and `null` means "the
 * question could not be asked".
 */
function diffNames(refs) {
  const out = tryRunText(['git', 'diff', '--name-only', ...refs]);
  if (out === null) return null;
  return out.split('\n').filter(Boolean);
}

/**
 * Whether the dependency graph differs between two `package.json` documents.
 *
 * `null` when the comparison could not be made — a missing manifest at one
 * of the two ends. `null` is deliberately not `false`: an unanswerable
 * question is not a clean bill of health, and this guard's whole purpose is
 * to notice a lockfile that was not regenerated.
 */
function graphChanged(before, after) {
  if (!before || !after) return null;
  return lockfileRelevantFields(before) !== lockfileRelevantFields(after);
}

/**
 * The check, for one direction.
 *
 * `direction` names what is being compared, because the two messages are
 * read by different people: the first is about commits that are about to be
 * published, the second about work that is not committed yet.
 */
async function check(differingFiles, before, after, direction) {  if (differingFiles === null) return; // The comparison could not be made.
  if (!differingFiles.includes('package.json')) return;
  if (differingFiles.includes('bun.lock')) return;

  const changed = graphChanged(before, after);
  if (changed === false) return; // Only the scripts moved. The lockfile is correct.
  if (changed === null) {
    console.log(
      `✖  package.json changed but the dependency graph could not be compared (${direction}).`
    );
    console.log('   Run: bun install');
    process.exit(1);
  }

  console.log(
    `✖  package.json's dependencies changed but bun.lock was not updated (${direction}).`
  );
  console.log('   Run: bun install');
  process.exit(1);
}

// Pushed commits: the upstream branch's manifest against HEAD's.
await check(
  diffNames(['HEAD..@{u}']),
  manifestAt('@{u}'),
  manifestAt('HEAD'),
  'pushed commits'
);

// Uncommitted work: HEAD's manifest against the working tree.
await check(
  diffNames(['HEAD']),
  manifestAt('HEAD'),
  await workingManifest(),
  'uncommitted changes'
);
