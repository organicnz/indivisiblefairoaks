#!/usr/bin/env bun
/**
 * Guard: every test file must declare its Vitest environment explicitly.
 *
 * ## What it protects
 *
 * Vitest constructs a fresh environment **per test file**. jsdom's
 * construction is expensive, and it dominated this suite: measured over the
 * whole run, jsdom was created 130 times for 127.66s of a 224.22s run — 63%
 * of the tracked time, and the single largest cost in the unit suite.
 *
 * All 130 files inherited a global `environment: 'jsdom'` default, and ~81 of
 * them never touched a DOM. Every one of those files paid a full jsdom
 * construction for a `document` it never used.
 *
 * So the environment is now stated per file, on the first line:
 *
 *     // @vitest-environment node
 *     // @vitest-environment jsdom-same-realm
 *
 * The DOM marker is `jsdom-same-realm`, not vitest's builtin `jsdom`:
 * the builtin constructs the window inside a node:vm context
 * (`runScripts: "dangerously"` is its unescapable default), and Bun's
 * node:vm on darwin-arm64 produces a window whose wrappers fail jsdom's
 * private-field brand check — every jsdom-environment worker crashed
 * before a single test ran on the arm64 dev machine, on stable and
 * canary Bun alike. `test/vitest-environment-jsdom-same-realm/` is the
 * same environment minus the vm realm (the only builtin-blocking knob);
 * it is load-bearing on macOS and harmless on Linux. A plain `jsdom`
 * declaration therefore fails this guard with a pointer here.
 *
 * 87 files run in `node`; the 116 that need a DOM run in
 * `jsdom-same-realm`. This guard refuses a test file that declares
 * neither, and refuses a DOM-environment file that reaches for `Bun.*`.
 *
 * ## Why the classification was not guessed
 *
 * Every test file was run under `--environment=node`, and the ones that
 * failed were marked `jsdom-same-realm`. Every failure was a DOM dependency —
 * `ReferenceError: document is not defined`, `window is not defined`,
 * `localStorage is not defined`, `DOMParser is not defined` — and nothing
 * else.
 *
 * That matters because **the failure is loud**. A file marked `node` that
 * turns out to need a DOM fails at the first `document`, in every test in the
 * file, with a message that names the missing global. It cannot quietly pass
 * a different way, which is what makes a per-file classification safe to
 * maintain.
 *
 * ## The second rule: `Bun.*` requires the `node` environment
 *
 * The DOM environment replaces the worker's global object with the
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
 * The check is transitive through imported scripts, because that is how the
 * failure actually reached the test — `check-migrations.test.ts` never
 * mentions `Bun`, but the script it imports does.
 *
 * ## What it deliberately does not block
 *
 * `node:fs`, `node:path` and the rest. Bun implements them natively, they
 * work in every environment, and `no-node-runtime.mjs` already governs
 * whether they are the right choice.
 *
 * It also does not try to prove that a `node`-environment file is *free* of
 * DOM APIs. That check would need to understand TypeScript type positions —
 * `let container: HTMLDivElement` is a type, not a runtime dependency — and a
 * heuristic that fires on a type annotation is a guard people learn to
 * bypass. The runtime failure is loud and names its cause, which is a better
 * report than a static guess.
 */

import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const SCRIPTS_DIR = join(REPO_ROOT, 'scripts');

/** The marker that declares a test file's environment. */
const ENVIRONMENT_MARKER = /@vitest-environment\s+(node|jsdom-same-realm)\b/;

/** A bare `jsdom` marker selects vitest's vm-based builtin — broken on Bun/darwin-arm64. (`\b` is NOT enough: `-` is a boundary.) */
const FORBIDDEN_JSDOM_MARKER = /@vitest-environment\s+jsdom(\s|$)/;

/** A test file that reaches for a Bun API. */
const BUN_USAGE = /\bBun\s*\./;

/** An import of a `scripts/*.mjs` module from a test. */
const SCRIPT_IMPORT = /from\s+['"][^'"]*scripts\/([a-z0-9-]+)\.mjs['"]/g;

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'coverage',
  'dist',
  'e2e',
  'playwright',
  '.worktrees',
  '.trunk',
]);

/**
 * Every test file in the tree, as absolute paths.
 *
 * `Bun.Glob` rather than `node:fs`'s `readdir`. The pattern states what is
 * being looked for, the walk does not need a `stat()` per entry to decide
 * whether it is a directory, and it does not block the event loop — which
 * matters in a pre-commit hook, where the whole point is to be quick.
 *
 * The results are sorted. `Bun.Glob` does not promise an order, and a guard
 * that reports its findings in a different order on every run is a guard
 * whose output cannot be diffed against the previous run.
 */
async function findTestFiles(dir) {
  const glob = new Bun.Glob('**/*.test.{ts,tsx,js,jsx,mjs,cjs}');
  const found = [];
  for await (const rel of glob.scan({ cwd: dir, dot: true })) {
    const segments = rel.split('/');
    if (segments.some((segment) => EXCLUDED_DIRS.has(segment))) continue;
    found.push(join(dir, rel));
  }
  return found.sort();
}

/**
 * Whether a script uses a Bun API — the thing that makes importing it into a
 * test a hazard.
 */
async function scriptUsesBun(scriptName) {
  const path = join(SCRIPTS_DIR, `${scriptName}.mjs`);
  try {
    return BUN_USAGE.test(await Bun.file(path).text());
  } catch {
    return false;
  }
}

async function checkFile(path) {
  const source = await Bun.file(path).text();
  const relativePath = relative(REPO_ROOT, path);

  // Rule 1 — the environment is declared, not inherited.
  //
  // A file without a marker inherits the config's default, which means the
  // cost of the environment is a decision nobody made and the guard cannot
  // see. The default in `vitest.config.mts` is `node` — the cheap one — so
  // an unclassified file is fast rather than slow, but it is still
  // unclassified, and the classification is what the 81/49 split rests on.
  // The marker must be in the top 10 lines of the file for Vitest to respect it.
  const topLines = source.split('\n').slice(0, 10).join('\n');

  if (FORBIDDEN_JSDOM_MARKER.test(topLines)) {
    return {
      file: relativePath,
      reason:
        "`jsdom` selects Vitest's vm-based builtin environment — broken on Bun/darwin-arm64",
      fix:
        'change the marker to `// @vitest-environment jsdom-same-realm`. The builtin creates the window ' +
        'inside a node:vm realm; Bun’s vm makes jsdom’s private-field brand check throw before any ' +
        'test runs. test/vitest-environment-jsdom-same-realm/ is the same environment minus the vm.',
    };
  }

  const marker = topLines.match(ENVIRONMENT_MARKER);
  if (!marker) {
    return {
      file: relativePath,
      reason: 'does not declare its environment in its first 10 lines',
      fix:
        'add `// @vitest-environment node` (or `jsdom-same-realm`) as the first line of the file. ' +
        'Every test file states its environment, so the cost of the environment is a decision ' +
        'rather than an inheritance.',
    };
  }

  const environment = marker[1];
  const usesBunDirectly = BUN_USAGE.test(source);

  const importedScripts = new Set();
  for (const match of source.matchAll(SCRIPT_IMPORT)) {
    importedScripts.add(match[1]);
  }
  const bunUsingScripts = [];
  for (const script of importedScripts) {
    if (await scriptUsesBun(script)) bunUsingScripts.push(script);
  }

  // Rule 2 — `Bun.*` needs the `node` environment, because the DOM
  // environment replaces the worker's global and the `Bun` global does not
  // survive the swap on every platform.
  if (environment === 'node') return null;

  if (usesBunDirectly) {
    return {
      file: relativePath,
      reason: 'declares `jsdom-same-realm` but uses Bun.* directly',
      fix: 'change the marker to `// @vitest-environment node`.',
    };
  }

  if (bunUsingScripts.length > 0) {
    return {
      file: relativePath,
      reason: `declares \`jsdom-same-realm\` but imports ${bunUsingScripts
        .map((s) => `scripts/${s}.mjs`)
        .join(', ')}, which uses Bun.*`,
      fix: 'change the marker to `// @vitest-environment node`.',
    };
  }

  return null;
}

const args = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const filesToCheck = args.length > 0 ? args.map((f) => resolve(REPO_ROOT, f)) : await findTestFiles(REPO_ROOT);

const violations = [];
for (const file of filesToCheck) {
  const violation = await checkFile(file);
  if (violation) violations.push(violation);
}

if (violations.length === 0) {
  process.exit(0);
}

console.error('\n✖  A test file must declare its Vitest environment:\n');
for (const violation of violations) {
  console.error(`  ${violation.file}`);
  console.error(`    → ${violation.reason}`);
  console.error(`    → ${violation.fix}\n`);
}
console.error(
  '  Vitest constructs an environment per test file, and jsdom\'s construction\n' +
    '  dominated this suite: 130 constructions, 127.66s of a 224.22s run. Every file\n' +
    '  that inherits a default pays that cost whether it needs a DOM or not.\n'
);
console.error(
  '  A `jsdom-same-realm` file that uses `Bun.*` fails on the Linux runner with\n' +
    '    `ReferenceError: Bun is not defined`\n' +
    "  in every test in the file — because Vitest's jsdom environment replaces the\n" +
    "  worker's global with the jsdom window's, and the `Bun` global does not survive\n" +
    '  that swap on every platform.\n'
);
process.exit(1);
