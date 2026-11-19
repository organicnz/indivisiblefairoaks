#!/usr/bin/env bun
/**
 * Resolve the Supabase Management API token for local type generation.
 *
 * `gen-types.mjs` loads `.env.local` itself, but the post-commit and post-merge
 * hooks run before that script and need to decide whether generation is even
 * possible. A shell-injected token wins; otherwise the value is read from
 * `.env.local`, the same file `gen-types.mjs` will load.
 *
 * This is deliberately a separate module: the token is a credential, so it
 * has one place to be read and no place to be logged.
 */
import { readEnvValue } from './hooks/_env-file.mjs';

/**
 * @param {object} [options]
 * @param {Record<string, string | undefined>} [options.env] Environment to read first.
 * @param {string} [options.file] Dotenv file to fall back to.
 * @returns {Promise<string>} The token, or `''` when neither source has one.
 */
export async function resolveSupabaseAccessToken({ env = Bun.env, file = '.env.local' } = {}) {
  const fromEnvironment = env.SUPABASE_ACCESS_TOKEN?.trim();
  if (fromEnvironment) return fromEnvironment;

  return (await readEnvValue('SUPABASE_ACCESS_TOKEN', file)).trim();
}
