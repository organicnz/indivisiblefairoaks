#!/usr/bin/env bun
/**
 * Auto-regenerate TypeScript types when a migration is committed.
 *
 * Guarded: only runs if the commit actually touched supabase/migrations/*.sql.
 * It also skips cleanly when SUPABASE_ACCESS_TOKEN is absent: contributors
 * without Management API access must still be able to commit, and CI verifies
 * the generated file once the migration has been applied.
 */
import { lines, runInherit, runText } from '../bun-exec.mjs';
import { resolveSupabaseAccessToken } from '../supabase-access-token.mjs';
import { readEnvValue } from './_env-file.mjs';
import { PROJECT_REF } from './_project-ref.mjs';

const changed = lines(
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

if (changed.length === 0) process.exit(0);

// A missing token is ordinary for contributors who do not have Management API
// access. The commit has already succeeded; do not turn a local convenience
// into a failed hook. CI verifies the generated file after the migration is
// applied.
const accessToken = await resolveSupabaseAccessToken();
if (!accessToken) {
  console.log('');
  console.log('ℹ️   SUPABASE_ACCESS_TOKEN is not set — skipping TypeScript type regeneration.');
  console.log('    After the migration is applied, run: bun run types:generate');
  process.exit(0);
}

// Guard: only regenerate if .env.local points at the canonical project.
const supabaseUrl = await readEnvValue('NEXT_PUBLIC_SUPABASE_URL', '.env.local');

if (supabaseUrl) {
  const derived = supabaseUrl.replace(/^https:\/\//, '').split('.')[0];
  if (derived !== PROJECT_REF) {
    console.log(
      `⚠️   Skipping type regen — .env.local points to a different project (${derived} ≠ ${PROJECT_REF}).`
    );
    process.exit(0);
  }
}

console.log('');
console.log('🗄️   Migration committed — regenerating TypeScript types...');
if (runInherit(['bun', 'run', 'types:generate']) === 0) {
  console.log('✔   src/types/supabase.ts updated.');
} else {
  console.log('⚠️   Type generation failed. Run manually: bun run types:generate');
}
