#!/usr/bin/env bun
/**
 * Read a value out of a dotenv-style file.
 *
 * The hooks that need to know "which Supabase project does this machine point
 * at?" used to answer it with `grep -E "^NEXT_PUBLIC_SUPABASE_URL=" .env.local`
 * — a shell, a pipe and a subprocess to read one line of one file. This is
 * the same answer, in-process.
 *
 * Deliberately minimal: it parses `KEY=value` lines the way a dotenv file
 * writes them and does not attempt to be a full dotenv implementation
 * (no `export` prefixes, no multiline values, no variable interpolation).
 * That is enough for the one question these hooks ask, and a partial parser
 * that silently disagrees with the real one is worse than a narrow one.
 */

/**
 * @param {string} name  The variable to read.
 * @param {string} file  Path to the dotenv file.
 * @returns {Promise<string>} The value, or `''` when the file or the key is absent.
 */
export async function readEnvValue(name, file) {
  let text;
  try {
    text = await Bun.file(file).text();
  } catch {
    return '';
  }

  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || match[1] !== name) continue;

    // Strip surrounding quotes, which a dotenv file may carry.
    return match[2].trim().replace(/^['"]|['"]$/g, '');
  }

  return '';
}
