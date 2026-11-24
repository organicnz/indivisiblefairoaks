/**
 * One model for the Bun invocations both runtime guards inspect.
 *
 * A line can carry a command in two shapes, and both are real:
 *
 *   - shell words — `run: bun --bun biome ci ./src`
 *   - an argv array — `run(['bun', '--bun', 'biome', 'ci'])`
 *
 * The repository uses the array shape heavily because `scripts/bun-exec.mjs`
 * takes argv arrays, so the tokenizer normalises the quotes, commas and
 * brackets both shapes use.
 *
 * The model distinguishes a local binary (`bun [run] <name>`) from a package
 * runner (`bun x <spec>` / `bunx <spec>`). Both rules then use the same
 * `forcedBun` value instead of each deciding for itself what counts as the
 * `--bun` flag.
 */
const SEPARATORS = /[()[\]{},;'"`]/g;

function tokens(line) {
  return line.replace(SEPARATORS, ' ').split(/\s+/).filter(Boolean);
}

/**
 * Read flags up to the target, optionally treating `run` as a subcommand.
 *
 * `--` ends flag parsing; anything after it is the target, not another flag.
 */
function parseFlags(words, start, { allowRun = false } = {}) {
  const flags = [];
  let cursor = start;

  while (words[cursor] !== undefined) {
    if (allowRun && words[cursor] === 'run') {
      cursor++;
      continue;
    }
    if (words[cursor] === '--') {
      cursor++;
      break;
    }
    if (!words[cursor].startsWith('-')) break;

    flags.push(words[cursor]);
    cursor++;
  }

  return { flags, cursor };
}

/**
 * @typedef {object} BunInvocation
 * @property {'package' | 'local'} kind
 * @property {string} target package spec or local binary/script name
 * @property {string[]} flags flags before the target
 * @property {boolean} forcedBun whether `--bun` was among those flags
 */

/**
 * @param {'package' | 'local'} kind
 * @param {string} target
 * @param {string[]} flags
 * @returns {BunInvocation}
 */
function invocation(kind, target, flags) {
  return {
    kind,
    target,
    flags,
    forcedBun: flags.includes('--bun'),
  };
}

function parsePackage(words, start) {
  const { flags, cursor } = parseFlags(words, start);
  const target = words[cursor];
  return target ? invocation('package', target, flags) : null;
}

function parseLocal(words, start) {
  const { flags, cursor } = parseFlags(words, start, { allowRun: true });
  const target = words[cursor];
  return target ? invocation('local', target, flags) : null;
}

/**
 * Every Bun invocation on a line, in source order.
 *
 * @param {string} line
 * @returns {BunInvocation[]}
 */
export function parseBunInvocations(line) {
  const words = tokens(line);
  const invocations = [];

  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'bunx') {
      const parsed = parsePackage(words, i + 1);
      if (parsed) invocations.push(parsed);
      continue;
    }
    if (words[i] !== 'bun') continue;

    if (words[i + 1] === 'x') {
      const parsed = parsePackage(words, i + 2);
      if (parsed) invocations.push(parsed);
      continue;
    }

    const parsed = parseLocal(words, i + 1);
    if (parsed) invocations.push(parsed);
  }

  return invocations;
}
