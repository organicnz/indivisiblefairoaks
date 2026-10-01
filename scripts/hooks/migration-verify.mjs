#!/usr/bin/env node
/**
 * Migration verify script (pre-push).
 */
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (!existsSync('.env.local')) {
  console.log('ℹ️   No .env.local — skipping migration verification.');
  process.exit(0);
}

try {
  execSync('grep -q "^SUPABASE_SECRET_KEY=.\\{5,\\}" .env.local', { stdio: 'pipe' });
} catch {
  console.log('ℹ️   SUPABASE_SECRET_KEY not configured — skipping migration verification.');
  process.exit(0);
}

console.log('🗄️   Verifying migrations against live schema...');
try {
  execSync('bun scripts/verify_migration.mjs', { stdio: 'inherit' });
  console.log('✔   Migrations verified.');
} catch {
  console.log('');
  console.log('✖  Migration verification failed. Fix before pushing.');
  process.exit(1);
}
