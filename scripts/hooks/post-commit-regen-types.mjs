#!/usr/bin/env bun
/**
 * Auto-regenerate TypeScript types when a migration is committed.
 *
 * Guarded: only runs if the commit actually touched supabase/migrations/*.sql.
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
    'HEAD',
    '--',
    'supabase/migrations/*.sql',
  ])
);

if (changed.length === 0) process.exit(0);

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
