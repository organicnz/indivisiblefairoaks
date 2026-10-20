#!/usr/bin/env bun
/**
 * Guard: a test file that reaches for `Bun.*` must declare the `node`
 * environment.
 *
 * ## What it protects
 *
 * Vitest's `jsdom` environment replaces the worker's global object with the
 * jsdom window's. The `Bun` global does not survive that swap on every
 * platform. A test file that calls `Bun.file` — or imports a script that
 * does — therefore passes on a developer's macOS machine and fails on the
 * Linux CI runner with `ReferenceError: Bun is not defined`, at the first
 * call, in every test in the file.
 *
 * That is a 403-test failure that a local run cannot reproduce, and the
 * cause is invisible from the error: the message names a missing global, not
 * an environment.
 *
 * ## Why `node` is the right environment for these files
 *
 * A `node` environment does not create a jsdom window, so the global is the
 * worker's own and `Bun` is present because the worker *is* a Bun process.
 * Vitest spawns its workers with `process.execPath`, and this suite runs
 * under `bun vitest`.
 *
 * It is also the semantically correct environment: the affected files read
 * files off disk and call scripts. They have no DOM to work with, and
 * giving them a DOM is what put them in this position.
 *
 * ## What it blocks
 *
 * A test file under `src/` that uses `Bun.*` — directly, or through a
 * `scripts/*.mjs` module it imports — without declaring
 * `// @vitest-environment node`.
 *
 * The check is transitive for imported scripts, because that is how the
 * failure actually reached the test: `check-migrations.test.ts` never
 * mentions `Bun`, but the script it imports does.
 *
 * ## What it deliberately does not block
 *
 * `node:fs`, `node:path` and the rest. Bun implements them natively, they
 * work in every environment, and `no-node-runtime.mjs` already governs
 * whether they are the right choice.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const TEST_ROOT = join(REPO_ROOT, 'src');
const SCRIPTS_DIR = join(REPO_ROOT, 'scripts');

/** The marker that puts a test file in the `node` environment. */
const ENVIRONMENT_MARKER = '@vitest-environment node';

/** A test file that reaches for a Bun API. */
const BUN_USAGE = /\bBun\s*\./;

/** An import of a `scripts/*.mjs` module from a test. */
const SCRIPT_IMPORT = /from\s+['"][^'"]*scripts\/([a-z0-9-]+)\.mjs['"]/g;

const EXCLUDED_DIRS = new Set(['node_modules', '.next', '.git', 'coverage', 'dist']);

/** Every test file in the tree, as repo-relative paths. */
function findTestFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...findTestFiles(full));
    } else if (/\.test\.[cm]?[jt]sx?$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Whether a script uses a Bun API — the thing that makes importing it into a
 * test a hazard.
 */
function scriptUsesBun(scriptName) {
  const path = join(SCRIPTS_DIR, `${scriptName}.mjs`);
  try {
    return BUN_USAGE.test(readFileSync(path, 'utf8'));
  } catch {
    return false;
  }
}

function checkFile(path) {
  const source = readFileSync(path, 'utf8');

  if (source.includes(ENVIRONMENT_MARKER)) return null;

  const usesBunDirectly = BUN_USAGE.test(source);

  const importedScripts = new Set();
  for (const match of source.matchAll(SCRIPT_IMPORT)) {
    importedScripts.add(match[1]);
  }
  const bunUsingScripts = [...importedScripts].filter(scriptUsesBun);

  if (!usesBunDirectly && bunUsingScripts.length === 0) return null;

  return {
    file: relative(REPO_ROOT, path),
    reason: usesBunDirectly
      ? 'uses Bun.* directly'
      : `imports ${bunUsingScripts.map((s) => `scripts/${s}.mjs`).join(', ')}, which uses Bun.*`,
  };
}

const violations = [];
for (const file of findTestFiles(TEST_ROOT)) {
  const violation = checkFile(file);
  if (violation) violations.push(violation);
}

if (violations.length === 0) {
  process.exit(0);
}

console.error('\n✖  A test that uses `Bun.*` must declare the `node` environment:\n');
for (const violation of violations) {
  console.error(`  ${violation.file}`);
  console.error(`    → ${violation.reason}`);
  console.error(
    '    → add `// @vitest-environment node` as the first line of the file.\n'
  );
}
console.error(
  '  Vitest\'s `jsdom` environment replaces the worker\'s global with the jsdom\n' +
    '  window\'s, and the `Bun` global does not survive that swap on every\n' +
    '  platform — so this passes on macOS and fails on the Linux runner with\n' +
    '  `ReferenceError: Bun is not defined`, in every test in the file.\n'
);
console.error(
  '  A `node` environment leaves the global as the worker\'s own, where `Bun`\n' +
    '  is present because the worker is a Bun process.\n'
);
process.exit(1);
