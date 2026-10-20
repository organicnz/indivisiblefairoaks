#!/usr/bin/env bun
/**
 * Load `.env.local` into the process environment.
 *
 * ## Why this exists at all
 *
 * Bun loads `.env` and `.env.local` natively — but it does so *at startup*,
 * and it chooses which files to read from the `NODE_ENV` in the environment
 * at that moment:
 *
 *   - `NODE_ENV` unset, `development`, `production`, `staging` → `.env.local`
 *     is read.
 *   - `NODE_ENV=test` → `.env.local` is **not** read; `.env.test` is read
 *     instead, and if there is no `.env.test` then neither is present.
 *
 * So a script started from a shell that exports `NODE_ENV=test` sees no
 * `.env.local` at all. This is the fallback for that case.
 *
 * ## Why it writes `process.env`
 *
 * The write is the part that has to be portable: `process.env` is the one
 * spelling every Bun version accepts for a mutation, and Bun documents
 * `Bun.env` as an *alias* for it. Every *read* in `scripts/` and `e2e/` goes
 * through `Bun.env`, and a read sees what is written here, because they are
 * the same object — verified in both directions.
 *
 * ## Why it strips quotes
 *
 * A quoted value in a `.env` file means the value *without* the quotes, and
 * that is what Bun's own loader does. Two of the twenty-three keys in this
 * repository's `.env.local` are quoted — `VERCEL_TOKEN` and
 * `VERCEL_OIDC_TOKEN`, both API credentials — so a loader that does not strip
 * them hands the next script a token with literal quote characters on the
 * end, and the failure is an authentication error that says nothing about
 * the cause.
 *
 * Five of the six loaders this replaced did not strip them. The sixth did.
 * They are one loader now.
 *
 * ## What it does not do
 *
 * It does not overwrite a variable that is already set. The shell's
 * environment wins — the same precedence Bun's own loader uses, and the
 * reason a CI-injected value is never clobbered by a checked-out file.
 */

/**
 * Load a `.env`-shaped file into an environment.
 *
 * @param {object}  [options]
 * @param {string}  [options.path]   The file to read. Defaults to `.env.local`.
 * @param {boolean} [options.stripQuotes] Strip surrounding quotes from a value.
 *   Defaults to `true` — see the note above.
 * @param {object}  [options.target]  Where to write the variables. Defaults to
 *   `process.env`. A caller can pass a plain object to collect them instead,
 *   which is what the test does: a test that mutates the real environment
 *   has to clean up after itself, and a leak into the next file in the same
 *   worker is a failure nobody is looking for.
 * @returns {Promise<number>} How many variables were set.
 */
export async function loadEnvLocal({
  path = '.env.local',
  stripQuotes = true,
  target = process.env,
} = {}) {
  let text;
  try {
    text = await Bun.file(path).text();
  } catch {
    // No local env file — CI injects the environment instead.
    return 0;
  }

  let loaded = 0;
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;

    // The shell's environment wins: a value that is already set is not
    // replaced by a checked-out file.
    if (target[key]) continue;

    let value = raw.trim();
    if (stripQuotes && /^["'].*["']$/.test(value)) {
      value = value.slice(1, -1);
    }

    target[key] = value;
    loaded++;
  }
  return loaded;
}
