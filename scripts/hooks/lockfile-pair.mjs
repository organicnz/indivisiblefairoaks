#!/usr/bin/env bun
/**
 * Lockfile pairing.
 *
 * A package.json change without a bun.lock change ships a frozen-lockfile
 * CI failure (or worse, drift). Require them to move together on commit.
 *
 * Only DEPENDENCY changes affect `bun install --frozen-lockfile`, which is
 * the failure this hook exists to prevent. Adding a script leaves the
 * resolved graph identical, and `git add bun.lock` then stages nothing — so
 * the naive "both files present" check could never pass for a script-only
 * commit.
 *
 * Compared by parsing both versions rather than grepping the diff: the diff
 * contains the changed version line, not the `"dependencies": {` header, so
 * a line-based check matches nothing and silently passes a real bump.
 */
import { lines, runText } from '../bun-exec.mjs';

const staged = lines(runText(['git', 'diff', '--cached', '--name-only']));

if (!staged.includes('package.json')) process.exit(0);
if (staged.includes('bun.lock')) process.exit(0);

function readStaged(ref) {
  // `git show :package.json` is the staged (index) version; `git show
  // HEAD:package.json` is the committed one. Both are argv elements, so a ref
  // can never be read as a shell word.
  return JSON.parse(runText(['git', 'show', `${ref}:package.json`]));
}

let depChange;
try {
  const stagedPkg = readStaged('');
  const headPkg = readStaged('HEAD');
  const keys = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
    'overrides',
    'resolutions',
    'trustedDependencies',
    'patchedDependencies',
  ];
  depChange = keys.some(
    (k) => JSON.stringify(stagedPkg[k] ?? null) !== JSON.stringify(headPkg[k] ?? null)
  );
} catch {
  // If the comparison could not run, fail closed: a broken check must not
  // become a silently skipped one.
  depChange = true;
}

if (!depChange) process.exit(0);

console.log('');
console.log('✖  package.json dependency changes staged without bun.lock.');
console.log('   Run: bun install   (updates the lockfile) then re-stage bun.lock.');
console.log('   CI installs with --frozen-lockfile and will fail otherwise.');
console.log('');
process.exit(1);
