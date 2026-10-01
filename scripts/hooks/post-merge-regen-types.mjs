#!/usr/bin/env node
/**
 * Regenerate TypeScript types when migrations are pulled via merge.
 *
 * Guard: only regenerate if the Supabase URL resolves to the correct
 * project ref. If .env.local points at a different project (e.g. a
 * personal workspace), skip silently to avoid clobbering committed types.
 */
import { execSync } from 'node:child_process';
import { PROJECT_REF } from './_project-ref.mjs';

const changed = execSync(
  'git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD -- "supabase/migrations/*.sql"',
  { encoding: 'utf8' }
)
  .split('\n')
  .filter(Boolean);

if (changed.length === 0) process.exit(0);


let supabaseUrl = '';
try {
  const envLocal = execSync('grep -E "^NEXT_PUBLIC_SUPABASE_URL=" .env.local', {
    encoding: 'utf8',
  }).trim();
  supabaseUrl = envLocal.split('=').slice(1).join('=').replace(/['"]/g, '').trim();
} catch {
  // .env.local missing or var absent — skip silently
}

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

console.log('🗄️   Migrations pulled — regenerating TypeScript types...');
try {
  execSync('bun run types:generate', { stdio: 'inherit' });
  console.log('✔   src/types/supabase.ts updated.');
} catch {
  console.log('⚠️   Type generation failed. Run: bun run types:generate');
}
