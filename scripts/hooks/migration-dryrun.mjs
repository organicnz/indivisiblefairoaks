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
const envLocal = await Bun.file('.env.local').text();
if (!/^SUPABASE_ACCESS_TOKEN=.{5,}$/m.test(envLocal)) {
  console.log('ℹ️   SUPABASE_ACCESS_TOKEN not configured — skipping migration dry-run.');
  process.exit(0);
}

console.log('🗄️   Migrations changed — dry-running local → remote diff...');
if (
  runInherit(['bun', 'x', 'supabase@latest', 'db', 'push', '--linked', '--dry-run', '--yes']) !== 0
) {
  console.log('');
  console.log('✖  Migration dry-run failed (see output above).');
  console.log('   Fix before pushing — CI will fail otherwise.');
  process.exit(1);
}
console.log('✔   Migration dry-run passed.');
