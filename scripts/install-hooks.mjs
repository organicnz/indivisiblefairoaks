#!/usr/bin/env bun
/**
 * Install the lefthook git hooks.
 *
 * ## What this replaces
 *
 * The `prepare` script used to be:
 *
 * ```sh
 * test -d .git && lefthook install || true
 * ```
 *
 * That is the last shell construct in this repository. It is a `sh` line
 * evaluated by whichever shell the package manager chose — `sh` on Linux,
 * `cmd.exe` on Windows — and `lefthook` was resolved from `node_modules/.bin`
 * by *that* shell, not by Bun.
 *
 * ## Why the shell construct was worth removing
 *
 * `lefthook` is a Node.js program. Its bin is
 * `node_modules/lefthook/bin/index.js`, and it starts with
 * `#!/usr/bin/env node`. When `bun install` ran the `prepare` script through
 * the system shell, the shell honoured that shebang and executed it with
 * **Node.js** — on any machine that had Node installed, and with a confusing
 * "no such file or directory" on the machines that do not.
 *
 * The rest of this repository never has that ambiguity, because it invokes
 * every local binary as `bun --bun <bin>`, which forces Bun's runtime.
 * `prepare` was the one place that did not, and it was the place that ran
 * automatically on every `bun install` — on every developer's machine.
 *
 * ## What this script does
 *
 * 1. **Does nothing outside a git checkout.** `bun install` also runs in a
 *    published tarball, in a Docker build stage, and in CI's dependency
 *    install, where `.git` may be absent and a hook install would be
 *    meaningless. This is the `test -d .git` half of the old line.
 * 2. **Does nothing when lefthook is not installed.** A production install
 *    (`bun install --production`) has no devDependencies, and `prepare` still
 *    runs. Failing there would break the install for a hook that is not
 *    wanted.
 * 3. **Runs lefthook on Bun.** `bun --bun <path>` forces Bun's runtime
 *    regardless of the shebang, so the hook installer is a Bun process like
 *    everything else.
 * 4. **Never fails the install.** The old line ended in `|| true` for a
 *    reason: a failed hook install must not break `bun install`, or a
 *    developer cannot get their dependencies installed at all. A warning is
 *    printed instead.
 *
 * ## Why the path is resolved rather than hard-coded
 *
 * `node_modules/lefthook/bin/index.js` is lefthook's internal layout, and a
 * minor release could move it. The path is read out of lefthook's own
 * `package.json` `bin` field instead, so this script keeps working when
 * lefthook does, and fails loudly (by skipping) if it does not.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');

/**
 * Whether this is a git checkout at all.
 *
 * A `.git` *file* is a worktree or submodule pointer rather than a
 * directory, and lefthook handles that case, so the check accepts either
 * shape — it is asking "is there a repository here", not "is there a
 * directory called .git".
 *
 * `node:fs`'s `existsSync` rather than `Bun.file(...).exists()`: the latter
 * is a Promise, and — the reason it matters here — it answers `false` for a
 * **directory**, because it asks "is this a file". A `.git` entry is usually
 * a directory, so the Bun-native call would report every ordinary checkout
 * as "not a git checkout" and the hooks would silently never be installed.
 */
export function isGitCheckout(root) {
  return existsSync(join(root, '.git'));
}

/**
 * lefthook's entry point, or `null` when it is not installed.
 *
 * **Resolved from the project's own `node_modules`, and not through
 * `Bun.resolveSync`.** That is a correction, not a preference: `Bun.resolveSync`
 * falls back to Bun's *global install cache* when the specifier is not found
 * relative to the given parent, and it will happily hand back a different
 * version than the lockfile pins.
 *
 * Measured on this repository:
 *
 *     $ bun -e "console.log(Bun.resolveSync('lefthook/package.json', '/tmp'))"
 *     /Users/organic/.bun/install/cache/lefthook@2.2.2@@@1/package.json
 *
 * The project pins lefthook `2.1.12`. The cache copy is `2.2.2`. So the
 * resolver was offering to install the hooks of a *different version* of
 * lefthook than the one the repository depends on — which is the same class
 * of mistake as `bunx <tool>` resolving a tool from the registry, and the
 * reason the CI comments insist on invoking the installed package directly.
 *
 * The path within the package comes from lefthook's own `bin` metadata rather
 * than a hard-coded string, so a change in lefthook's internal layout is not
 * a broken install.
 */
export async function resolveLefthookBin(root) {
  const manifestPath = join(root, 'node_modules', 'lefthook', 'package.json');

  let manifest;
  try {
    manifest = JSON.parse(await Bun.file(manifestPath).text());
  } catch {
    return null;
  }

  const bin = manifest.bin;
  const relative = typeof bin === 'string' ? bin : bin?.lefthook;
  if (typeof relative !== 'string') return null;

  return resolve(dirname(manifestPath), relative);
}

/**
 * What `main` did, and why.
 *
 * A string rather than a bare exit code, because "nothing happened" has
 * several distinct reasons and a caller that cannot tell them apart cannot
 * tell a working install from a silently skipped one.
 *
 * - `not-a-checkout` — there is no `.git` here.
 * - `lefthook-absent` — lefthook is not installed.
 * - `installed` — the hooks were installed.
 * - `install-failed` — lefthook ran and did not succeed.
 */
export const OUTCOME = {
  NOT_A_CHECKOUT: 'not-a-checkout',
  LEFTHOOK_ABSENT: 'lefthook-absent',
  INSTALLED: 'installed',
  INSTALL_FAILED: 'install-failed',
};

/**
 * Install the hooks.
 *
 * `spawn` is injectable so a test can observe the command without running it.
 * The default is the real thing.
 *
 * @param {object}   [options]
 * @param {string}   [options.root]  The repository root. Defaults to this one.
 * @param {Function} [options.spawn] `(argv, options) => { exitCode }`.
 * @returns {Promise<string>} One of `OUTCOME`.
 */
export async function main({ root = REPO_ROOT, spawn } = {}) {
  const run = spawn ?? defaultSpawn;

  // 1. Not a git checkout — nothing to install hooks into.
  if (!isGitCheckout(root)) return OUTCOME.NOT_A_CHECKOUT;

  // 2. lefthook is not installed — a production install, or a partial tree.
  const lefthookBin = await resolveLefthookBin(root);
  if (!lefthookBin) return OUTCOME.LEFTHOOK_ABSENT;

  // 3. Install the hooks, on Bun.
  //
  // `process.execPath` is the bun binary, and `--bun` forces Bun's runtime
  // for the child whatever lefthook's own shebang says.
  const result = run([process.execPath, '--bun', lefthookBin, 'install'], {
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit',
    cwd: root,
  });

  if (result.exitCode !== 0) {
    console.warn(
      `\n  lefthook install exited ${result.exitCode ?? 'signal'} — the git hooks were not installed.\n` +
        '  The repository still works; the pre-commit gates simply will not run.\n'
    );
    return OUTCOME.INSTALL_FAILED;
  }

  return OUTCOME.INSTALLED;
}

/** The real spawn, kept separate so `main` can be tested without one. */
function defaultSpawn(argv, options) {
  return Bun.spawnSync(argv, options);
}

// Direct invocation only. Importing this module must not install anything —
// which is also what lets a test drive the four branches.
if (process.argv[1]?.endsWith('install-hooks.mjs')) {
  // 4. A failed hook install must not break `bun install`.
  await main();
  process.exit(0);
}
