#!/usr/bin/env bun
/**
 * Verify that `src/types/supabase.ts` matches the live Supabase schema.
 *
 * ## Why this needs a token, and why it skips without one
 *
 * The generated file is produced from the hosted project, not from the
 * migration files. Comparing it therefore needs `SUPABASE_ACCESS_TOKEN` and
 * network access. A contributor without either must still be able to commit and
 * run the rest of the local gates, so the default mode reports the skip and
 * exits 0. CI uses `--require-token`, where a missing credential is a
 * configuration fault rather than a reason to pretend the types are fresh.
 *
 * `gen-types.mjs --check` does the actual comparison without writing the file.
 * This wrapper owns only the credential policy and the user-facing message.
 *
 * Usage:
 *   bun scripts/check-supabase-types.mjs
 *   bun scripts/check-supabase-types.mjs --require-token   # CI
 */
import { runInherit } from './bun-exec.mjs';
import { resolveSupabaseAccessToken } from './supabase-access-token.mjs';

function defaultGenerate() {
  return runInherit(['bun', 'scripts/gen-types.mjs', '--check']);
}

/**
 * @param {object} [options]
 * @param {string} [options.token] Resolved token; omit to read the environment.
 * @param {boolean} [options.requireToken] Fail instead of skipping without a token.
 * @param {() => number | Promise<number>} [options.generate] Generator runner.
 * @param {(message: string) => void} [options.log]
 * @param {(message: string) => void} [options.error]
 * @returns {Promise<number>} Process exit code.
 */
export async function main({
  token,
  requireToken = false,
  generate = defaultGenerate,
  log = console.log,
  error = console.error,
} = {}) {
  const accessToken = token === undefined ? await resolveSupabaseAccessToken() : token;

  if (!accessToken) {
    if (requireToken) {
      error('::error::SUPABASE_ACCESS_TOKEN is required to verify generated Supabase types.');
      return 1;
    }
    log('ℹ️   SUPABASE_ACCESS_TOKEN is not set — skipping generated-type freshness check.');
    log('    CI runs this with a token; locally, run `bun run types:generate` after the migration lands.');
    return 0;
  }

  log('🔎 Checking generated Supabase types against the live schema...');
  const code = await generate();
  if (code === 0) {
    log('✔  src/types/supabase.ts is current.');
    return 0;
  }

  error('✖  Generated-type freshness check failed.');
  error('   If the file is stale, run `bun run types:generate` and commit the result.');
  error('   The generated file must not be edited by hand.');
  return code || 1;
}

// Importing this module from a test must not perform the check.
if (process.argv[1]?.endsWith('check-supabase-types.mjs')) {
  process.exit(await main({ requireToken: process.argv.includes('--require-token') }));
}
