#!/usr/bin/env bun
/**
 * Regenerate TypeScript types when migrations are pulled via merge.
 *
 * Guarded: only runs if the merge actually brought in supabase/migrations/*.sql.
 * It then reads the hosted project's migration history and regenerates only
 * when every local migration — not just the pulled ones — is recorded as
 * applied. The pull may arrive before the migration is applied; regenerating
 * then would overwrite `src/types/supabase.ts` with the pre-migration schema.
 *
 * It also skips when SUPABASE_ACCESS_TOKEN is absent: a pull must not fail
 * because a contributor does not hold the Management API credential.
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
      'ORIG_HEAD',
      'HEAD',
      '--',
      'supabase/migrations/*.sql',
    ])
  );
}

/**
 * Exported with injectable inputs so the skip paths are tested without a live
 * project, a token, or a real merge.
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
    mode: 'merge',
    changedFiles: files,
    localVersions,
    accessToken: token,
    projectRef: PROJECT_REF,
    generate: generate ?? ((ref) => runInherit(typeGenerationCommand(ref))),
    fetchImpl,
    log,
  });
}

if (process.argv[1]?.endsWith('post-merge-regen-types.mjs')) {
  await main();
}
