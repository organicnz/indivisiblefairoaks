/**
 * The one Supabase CLI command prefix used by repository scripts.
 *
 * `bun x` resolves the package from the registry, so the exact version is what
 * makes a run reproducible. Both type generation and the migration dry-run
 * spread this array, which turns an upgrade into one edit.
 *
 * Keep the package literal on this line: `no-node-runtime.mjs` checks it with
 * the unpinned-package-runner rule.
 */
export const SUPABASE_CLI = ['bun', 'x', '--bun', 'supabase@3.2.0'];
