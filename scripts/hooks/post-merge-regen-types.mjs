#!/usr/bin/env bun
/**
 * Regenerate TypeScript types when migrations are pulled via merge.
 *
 * Guard: only regenerate if the Supabase URL resolves to the correct
 * project ref. If .env.local points at a different project (e.g. a
 * personal workspace), skip silently to avoid clobbering committed types.
 */
import { lines, runInherit, runText } from '../bun-exec.mjs';
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
