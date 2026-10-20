#!/usr/bin/env bun
/**
 * Migration verify script (pre-push).
 */
import { runInherit } from '../bun-exec.mjs';

if (!(await Bun.file('.env.local').exists())) {
  console.log('ℹ️   No .env.local — skipping migration verification.');
  process.exit(0);
}

// The presence check used to be `grep -q`, which meant a shell, a pipe and a
// subprocess to answer a question about one line of one file. Reading the file
// and testing the line is the same answer with no shell involved.
const envLocal = await Bun.file('.env.local').text();
if (!/^SUPABASE_SECRET_KEY=.{5,}$/m.test(envLocal)) {
  console.log('ℹ️   SUPABASE_SECRET_KEY not configured — skipping migration verification.');
  process.exit(0);
}

console.log('🗄️   Verifying migrations against live schema...');
if (runInherit(['bun', 'scripts/verify_migration.mjs']) !== 0) {
  console.log('');
  console.log('✖  Migration verification failed. Fix before pushing.');
  process.exit(1);
}
console.log('✔   Migrations verified.');
