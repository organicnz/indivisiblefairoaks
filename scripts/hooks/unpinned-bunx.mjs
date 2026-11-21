/**
 * Detect `bun x` / `bunx` invocations that are not pinned to an exact version.
 *
 * `bun x pkg@latest` and `bunx supabase` resolve whatever the registry
 * serves at run time. That is a second, unpinned dependency path next to
 * `bun.lock`: the same commit can run a different binary tomorrow, and no
 * lockfile records what it ran.
 *
 * An exact semver is the only accepted form:
 *
 *   bun x --bun pkg@1.2.3 gen types ...
 *   bunx --bun pkg@1.2.3 functions deploy
 *
 * The command can appear as shell words or as an argv array. The check reads
 * the token stream after normalising the quotes, commas and brackets both
 * shapes use. `--package` / `-p` is supported for `bunx` aliases: when a package
 * is named there, the following command is a bin name, not another package.
 */

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const PACKAGE_SPEC = /^(?:@[^/\s]+\/)?[^@\s]+@(.+)$/;

/** Whether a registry spec names one exact version, not a tag or range. */
export function isExactPackageSpec(spec) {
  const match = PACKAGE_SPEC.exec(spec);
  return Boolean(match && EXACT_VERSION.test(match[1]));
}

function tokens(line) {
  return line
    .replace(/[()[\]{},;'"`]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Return the first unpinned package spec on a line, or null.
 *
 * @param {string} line
 * @returns {string | null}
 */
export function findUnpinnedBunx(line) {
  const words = tokens(line);

  for (let i = 0; i < words.length; i++) {
    let cursor;
    if (words[i] === 'bunx') {
      cursor = i + 1;
    } else if (words[i] === 'bun' && words[i + 1] === 'x') {
      cursor = i + 2;
      i++;
    } else {
      continue;
    }

    let packageSpecified = false;
    while (cursor < words.length && words[cursor].startsWith('-')) {
      const flag = words[cursor];
      if (flag === '--package' || flag === '-p') {
        const spec = words[cursor + 1];
        if (!spec) break;
        packageSpecified = true;
        if (!isExactPackageSpec(spec)) return spec;
        cursor += 2;
        continue;
      }
      if (flag.startsWith('--package=')) {
        const spec = flag.slice('--package='.length);
        packageSpecified = true;
        if (!isExactPackageSpec(spec)) return spec;
        cursor++;
        continue;
      }
      cursor++;
    }

    const command = words[cursor];
    if (!command) continue;
    if (!packageSpecified && !isExactPackageSpec(command)) return command;
    i = cursor;
  }

  return null;
}
