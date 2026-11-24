import { parseBunInvocations } from './bun-invocations.mjs';

/**
 * Detect `bun x` / `bunx` invocations that are not safely pinned.
 *
 * Two properties matter, and an exact version provides only one of them:
 *
 *   - `bun x pkg@latest` resolves whatever the registry serves at run time.
 *   - `bun x pkg@3.2.0` pins the package, but the package's bin can still
 *     follow its `#!/usr/bin/env node` shebang and run on Node.js. `--bun`
 *     forces Bun's runtime.
 *
 * The shared Bun invocation model identifies the package-runner forms. These
 * checks only add package semantics: exact version and the runtime flag.
 */
const EXACT_PACKAGE =
  /^(?:@[^/\s]+\/)?[^@\s]+@\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function packageInvocations(line) {
  return parseBunInvocations(line).filter((invocation) => invocation.kind === 'package');
}

/**
 * Return the first package spec without an exact version, or null.
 *
 * @param {string} line
 * @returns {string | null}
 */
export function findUnpinnedBunx(line) {
  for (const { target } of packageInvocations(line)) {
    if (!EXACT_PACKAGE.test(target)) return target;
  }

  return null;
}

/**
 * Return the first exactly pinned package spec that omits `--bun`, or null.
 *
 * Unpinned specs are left to {@link findUnpinnedBunx} so one line produces one
 * finding, and fixing the version exposes the missing runtime flag next.
 *
 * @param {string} line
 * @returns {string | null}
 */
export function findPinnedBunxWithoutBun(line) {
  for (const { target, forcedBun } of packageInvocations(line)) {
    if (!EXACT_PACKAGE.test(target)) continue;
    if (!forcedBun) return target;
  }

  return null;
}
