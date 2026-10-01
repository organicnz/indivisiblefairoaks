#!/usr/bin/env node
/**
 * Migration guard.
 *
 * Migrations are append-only. Modifying an already-tracked file is dangerous.
 */
import { execSync } from 'node:child_process';

const modified = execSync(
  'git diff --cached --name-only --diff-filter=M -- "supabase/migrations/*.sql"',
  { encoding: 'utf8' }
)
  .split('\n')
  .filter(Boolean);

if (modified.length > 0) {
  console.log('');
  console.log('✖  Modifying an existing migration file is not allowed:');
  for (const f of modified) console.log(f);
  console.log('');
  console.log('   Migrations are append-only. Create a new one instead:');
  console.log('   supabase migration new <descriptive_name>');
  console.log('');
  console.log('   Bypass: LEFTHOOK_EXCLUDE=migration-guard git commit');
  console.log('');
  process.exit(1);
}
