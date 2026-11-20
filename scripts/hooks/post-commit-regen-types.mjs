#!/usr/bin/env bun
/**
 * Auto-regenerate TypeScript types when a migration is committed.
 *
 * Guarded: only runs if the commit actually touched supabase/migrations/*.sql.
 * It then reads the hosted project's migration history and regenerates only
 * when every local migration — not just the changed ones — is recorded as
 * applied. A migration that is committed but not applied must not trigger
 * generation: `gen-types` reads the live schema, so doing it early would
 * overwrite `src/types/supabase.ts` with the pre-migration schema.
 *
 * It also skips cleanly when SUPABASE_ACCESS_TOKEN is absent: contributors
 * without Management API access must still be able to commit, and CI verifies
 * the generated file once the migration has been applied.
 *
 * Generation is pinned to the verified project ref; it never re-derives the
 * target from the shell environment after the history check.
 */
import { lines, runInherit, runText } from '../bun-exec.mjs';
import { resolveSupabaseAccessToken } from '../supabase-access-token.mjs';
import { PROJECT_REF } from './_project-ref.mjs';
import { regenerateTypesIfApplied, typeGenerationCommand } from './regen-types-guard.mjs';

function changedMigrationFiles() {
  return lines(
    runText([
      'git',
      'diff-tree',
      '-r',
      '--name-only',
      '--no-commit-id',
      'HEAD',
      '--',
      'supabase/migrations/*.sql',
    ])
  );
}

/**
 * Exported with injectable inputs so the skip paths are tested without a live
 * project, a token, or a real git commit.
 */
export async function main({
  changedFiles,
  localVersions,
  accessToken,
  generate,
  fetchImpl,
  log,
} = {}) {
  const files = changedFiles ?? changedMigrationFiles();
  const token = accessToken ?? (await resolveSupabaseAccessToken());

  return regenerateTypesIfApplied({
    mode: 'commit',
    changedFiles: files,
    localVersions,
    accessToken: token,
    projectRef: PROJECT_REF,
    generate: generate ?? ((ref) => runInherit(typeGenerationCommand(ref))),
    fetchImpl,
    log,
  });
}

if (process.argv[1]?.endsWith('post-commit-regen-types.mjs')) {
  await main();
}
