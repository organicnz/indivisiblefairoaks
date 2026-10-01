#!/usr/bin/env node
/**
 * Auto-regenerate TypeScript types when a migration is committed.
 *
 * Guarded: only runs if the commit actually touched supabase/migrations/*.sql.
 */
import { execSync } from 'node:child_process';
import { PROJECT_REF } from './_project-ref.mjs';

const changed = execSync(
  'git diff-tree -r --name-only --no-commit-id HEAD -- "supabase/migrations/*.sql"',
  { encoding: 'utf8' }
)
  .split('\n')
  .filter(Boolean);

if (changed.length === 0) process.exit(0);

// Guard: only regenerate if .env.local points at the canonical project.

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
    process.exit(0);
  }
}

console.log('');
console.log('🗄️   Migration committed — regenerating TypeScript types...');
try {
  execSync('bun run types:generate', { stdio: 'inherit' });
  console.log('✔   src/types/supabase.ts updated.');
} catch {
  console.log('⚠️   Type generation failed. Run manually: bun run types:generate');
}
