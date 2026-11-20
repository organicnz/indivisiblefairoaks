/**
 * Regenerate generated Supabase types only after the migrations are applied.
 *
 * `gen-types.mjs` reads the hosted schema, not the migration files. A
 * post-commit or post-merge hook that regenerates immediately after adding a
 * migration therefore writes the *pre-migration* schema over
 * `src/types/supabase.ts`. The migration may land minutes or days later, but
 * the generated file has already been overwritten and no longer describes the
 * schema the migration is about to create.
 *
 * This guard reads the hosted project's migration history first. It regenerates
 * only when every local migration version — not merely the versions changed in
 * this commit or merge — is recorded as applied. Every other outcome — no token,
 * unreadable local migrations, unreadable history, missing history table, or an
 * unrecognised filename — skips regeneration and leaves the committed types
 * untouched.
 *
 * Generation is pinned to the verified ref with `--project-ref`. The generator
 * must not re-derive its target from a shell environment; doing so could write
 * types for a project this guard did not check.
 *
 * The Management API query is the one `check-migrations.mjs` already uses, via
 * `scripts/migration-history.mjs`.
 */

import { readAppliedMigrationVersions } from '../migration-history.mjs';

const MIGRATION_VERSION = /^(\d+)_/;

/**
 * @param {string[]} files Changed migration paths.
 * @returns {string[] | null} Unique version prefixes, in first-seen order;
 *   `null` when any changed path is not a migration filename.
 */
export function migrationVersionsFromFiles(files) {
  const versions = new Set();
  for (const file of files) {
    const name = file.split('/').pop() ?? '';
    const match = MIGRATION_VERSION.exec(name);
    if (!match) return null;
    versions.add(match[1]);
  }
  return [...versions];
}

/**
 * The one generation command both hooks use. Keeping it here makes the
 * verified-ref pinning testable and keeps the two entry points from drifting.
 *
 * @param {string} projectRef
 * @returns {string[]}
 */
export function typeGenerationCommand(projectRef) {
  return ['bun', 'scripts/gen-types.mjs', '--project-ref', projectRef];
}

/**
 * Read every local migration version. A failed scan is `null`, which callers
 * treat as a safe skip rather than as an empty, fully-applied history.
 *
 * @returns {Promise<string[] | null>}
 */
async function readLocalMigrationVersions() {
  const glob = new Bun.Glob('*.sql');
  const files = [];
  try {
    for await (const file of glob.scan({ cwd: 'supabase/migrations' })) {
      files.push(file);
    }
  } catch {
    return null;
  }
  return migrationVersionsFromFiles(files);
}

/**
 * @param {object} options
 * @param {'commit' | 'merge'} options.mode
 * @param {string[]} options.changedFiles
 * @param {string[]} [options.localVersions] Every local migration version;
 *   omitted to scan `supabase/migrations`.
 * @param {string} options.accessToken
 * @param {string} options.projectRef
 * @param {(projectRef: string) => number | Promise<number>} options.generate
 * @param {typeof fetch} [options.fetchImpl]
 * @param {number} [options.historyTimeoutMs] Bound the Management API read.
 * @param {(...args: unknown[]) => void} [options.log]
 * @returns {Promise<{
 *   status: 'skipped' | 'generated' | 'failed',
 *   reason: string,
 *   pending?: string[],
 *   versions?: string[],
 *   error?: string,
 * }>}
 */
export async function regenerateTypesIfApplied({
  mode,
  changedFiles,
  localVersions,
  accessToken,
  projectRef,
  generate,
  fetchImpl,
  historyTimeoutMs,
  log = console.log,
}) {
  const isMerge = mode === 'merge';
  const manual = isMerge
    ? 'Run manually after all local migrations are applied: bun run types:generate'
    : 'After all local migrations are applied, run: bun run types:generate';

  if (changedFiles.length === 0) {
    return { status: 'skipped', reason: 'no-migrations' };
  }

  // A missing token is ordinary for contributors without Management API access.
  // The commit/pull has already succeeded; do not turn this into a failed hook.
  if (!accessToken) {
    log('');
    log('ℹ️   SUPABASE_ACCESS_TOKEN is not set — skipping TypeScript type regeneration.');
    log(`    ${manual}`);
    return { status: 'skipped', reason: 'no-token' };
  }

  const versions = migrationVersionsFromFiles(changedFiles);
  if (!versions) {
    log(
      '⚠️   Skipping type regeneration — one or more changed migration filenames have no version.'
    );
    log(`    ${manual}`);
    return { status: 'skipped', reason: 'unrecognized-migration' };
  }

  const local = localVersions === undefined ? await readLocalMigrationVersions() : localVersions;
  if (!local) {
    log('⚠️   Skipping type regeneration — could not read the local migration versions.');
    log(`    ${manual}`);
    return { status: 'skipped', reason: 'local-migrations-unreadable' };
  }

  let applied;
  try {
    // A stalled Management API must not hold the commit or pull. A timeout
    // throws here and takes the existing unreadable-history skip path below.
    applied = await readAppliedMigrationVersions({
      ref: projectRef,
      token: accessToken,
      fetchImpl,
      timeoutMs: historyTimeoutMs,
    });
  } catch (error) {
    const message = String(error?.message ?? error);
    // The history table is absent on a project where no migration has ever
    // been recorded. That is "nothing applied", not a reason to try generation.
    const missingHistory = message.includes('does not exist');
    log('');
    log(
      `⚠️   Skipping TypeScript type regeneration — could not ${
        missingHistory ? 'find' : 'read'
      } the hosted migration history.`
    );
    log('    The live schema may be behind the migrations; regenerate after they are applied.');
    return {
      status: 'skipped',
      reason: missingHistory ? 'history-missing' : 'history-unreadable',
      error: message,
    };
  }

  const required = new Set([...local, ...versions]);
  const pending = [...required].filter((version) => !applied.has(version)).sort();
  if (pending.length > 0) {
    log('');
    log(
      `ℹ️   Migration${pending.length === 1 ? '' : 's'} ${pending.join(', ')} ${
        pending.length === 1 ? 'is' : 'are'
      } not applied to the hosted project — skipping TypeScript type regeneration.`
    );
    log(`    ${manual}`);
    return { status: 'skipped', reason: 'not-applied', pending };
  }

  log('');
  log(
    isMerge
      ? '🗄️   Migrations pulled — regenerating TypeScript types...'
      : '🗄️   Migration committed — regenerating TypeScript types...'
  );

  const exitCode = await generate(projectRef);
  if (exitCode === 0) {
    log('✔   src/types/supabase.ts updated.');
    return { status: 'generated', reason: 'applied', versions };
  }

  log(
    isMerge
      ? '⚠️   Type generation failed. Run: bun run types:generate'
      : '⚠️   Type generation failed. Run manually: bun run types:generate'
  );
  return { status: 'failed', reason: 'generate-failed', versions };
}
