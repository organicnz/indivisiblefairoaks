#!/usr/bin/env bun
/**
 * Regenerate TypeScript types when migrations are pulled via merge.
 *
 * Guard: only regenerate if the Supabase URL resolves to the correct
 * project ref. If .env.local points at a different project (e.g. a
 * personal workspace), skip silently to avoid clobbering committed types.
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
    'ORIG_HEAD',
    'HEAD',
    '--',
    'supabase/migrations/*.sql',
  ])
);

if (changed.length === 0) process.exit(0);

// Same no-token policy as post-commit: a pull must not fail because a
// contributor does not hold the Management API credential. CI catches the
// stale file once the migration has actually been applied.
const accessToken = await resolveSupabaseAccessToken();
if (!accessToken) {
  console.log('');
  console.log('ℹ️   SUPABASE_ACCESS_TOKEN is not set — skipping TypeScript type regeneration.');
  console.log('    After the migration is applied, run: bun run types:generate');
  process.exit(0);
}

const supabaseUrl = await readEnvValue('NEXT_PUBLIC_SUPABASE_URL', '.env.local');

if (supabaseUrl) {
  const derived = supabaseUrl.replace(/^https:\/\//, '').split('.')[0];
  if (derived !== PROJECT_REF) {
    console.log(
      `⚠️   Skipping type regen — .env.local points to a different project (${derived} ≠ ${PROJECT_REF}).`
    );
    console.log('    Run manually if needed: bun run types:generate');
    process.exit(0);
  }
}

console.log('');
console.log('🗄️   Migrations pulled — regenerating TypeScript types...');
if (runInherit(['bun', 'run', 'types:generate']) === 0) {
  console.log('✔   src/types/supabase.ts updated.');
} else {
  console.log('⚠️   Type generation failed. Run: bun run types:generate');
}
