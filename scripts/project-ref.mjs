/**
 * Resolve the Supabase project ref used for type generation.
 *
 * An explicit `--project-ref` wins outright. The regeneration guard passes the
 * canonical ref here after verifying the migration history against it, so a
 * shell-level `SUPABASE_PROJECT_REF` cannot silently redirect the write to a
 * different project.
 *
 * Without the flag, preserve the historical precedence: the dedicated env var
 * first, then the project ref embedded in the public URL.
 *
 * @param {object} [options]
 * @param {string[]} [options.argv]
 * @param {Record<string, string | undefined>} [options.env]
 * @returns {string} The project ref, or `''` when neither source has one.
 */
export function resolveProjectRef({ argv = process.argv, env = Bun.env } = {}) {
  const flag = argv.indexOf('--project-ref');
  if (flag !== -1) {
    const value = argv[flag + 1]?.trim();
    if (!value || value.startsWith('--')) {
      throw new Error('--project-ref requires a project ref');
    }
    return value;
  }

  const explicit = env.SUPABASE_PROJECT_REF?.trim();
  if (explicit) return explicit;

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url) {
    try {
      return new URL(url).hostname.split('.')[0];
    } catch {
      // Fall through to the caller's configuration error.
    }
  }

  return '';
}
