#!/usr/bin/env bun
/**
 * Migration guard.
 *
 * Migrations are append-only. Modifying an already-tracked file is dangerous.
 */
import { lines, runText } from '../bun-exec.mjs';

const modified = lines(
  runText([
    'git',
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=M',
    '--',
    'supabase/migrations/*.sql',
  ])
);

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
