#!/usr/bin/env bun
/**
 * Just-in-time migration dry-run.
 *
 * Mirrors the CI token-only flow: supabase link + db push --linked
 * --dry-run. Skips silently when the local machine has no link state /
 * token (CI covers it there).
 */
import { runInherit } from '../bun-exec.mjs';

if (!(await Bun.file('supabase/.temp/linked-project.json').exists())) {
  console.log('ℹ️   No linked Supabase project — skipping migration dry-run.');
  process.exit(0);
}

// See `migration-verify.mjs`: a `grep -q` to answer a question about one line
// of one file is a shell, a pipe and a subprocess.
const envLocalFile = Bun.file('.env.local');
if (!(await envLocalFile.exists())) {
  console.log('ℹ️   No .env.local — skipping migration dry-run.');
  process.exit(0);
}
const envLocal = await envLocalFile.text();
if (!/^SUPABASE_ACCESS_TOKEN=.{5,}$/m.test(envLocal)) {
  console.log('ℹ️   SUPABASE_ACCESS_TOKEN not configured — skipping migration dry-run.');
  process.exit(0);
}

console.log('🗄️   Migrations changed — dry-running local → remote diff...');
// Keep this CLI pin in step with scripts/gen-types.mjs.
if (
  runInherit([
    'bun',
    'x',
    '--bun',
    'supabase@3.2.0',
    'db',
    'push',
    '--linked',
    '--dry-run',
    '--yes',
  ]) !== 0
) {
  console.log('');
  console.log('✖  Migration dry-run failed (see output above).');
  console.log('   Fix before pushing — CI will fail otherwise.');
  process.exit(1);
}
console.log('✔   Migration dry-run passed.');
