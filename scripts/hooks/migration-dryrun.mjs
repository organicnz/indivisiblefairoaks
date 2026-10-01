#!/usr/bin/env node
/**
 * Just-in-time migration dry-run.
 *
 * Mirrors the CI token-only flow: supabase link + db push --linked
 * --dry-run. Skips silently when the local machine has no link state /
 * token (CI covers it there).
 */
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (!existsSync('supabase/.temp/linked-project.json')) {
  console.log('ℹ️   No linked Supabase project — skipping migration dry-run.');
  process.exit(0);
}

try {
  execSync('grep -q "^SUPABASE_ACCESS_TOKEN=.\\{5,\\}" .env.local', { stdio: 'pipe' });
} catch {
  console.log('ℹ️   SUPABASE_ACCESS_TOKEN not configured — skipping migration dry-run.');
  process.exit(0);
}

console.log('🗄️   Migrations changed — dry-running local → remote diff...');
try {
  execSync('bun x supabase@latest db push --linked --dry-run --yes', { stdio: 'inherit' });
  console.log('✔   Migration dry-run passed.');
} catch {
  console.log('');
  console.log('✖  Migration dry-run failed (see output above).');
  console.log('   Fix before pushing — CI will fail otherwise.');
  process.exit(1);
}
