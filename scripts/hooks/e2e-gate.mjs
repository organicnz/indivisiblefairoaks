#!/usr/bin/env node
/**
 * Playwright e2e delivery gate.
 *
 * Runs last so build-check has already produced a warm .next; Playwright's
 * webServer starts `next start` against that build (reuseExistingServer).
 * Change-aware: full suite only when the push range can affect runtime.
 * Bypass (emergency only): LEFTHOOK_EXCLUDE=e2e git push
 */
import { existsSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';

// Push range: upstream when available, otherwise the tip commit.
let rangeDiff;
try {
  rangeDiff = execSync('git diff --name-only @{u}...HEAD', { encoding: 'utf8' });
} catch {
  try {
    rangeDiff = execSync('git diff --name-only HEAD~1...HEAD', { encoding: 'utf8' });
  } catch {
    rangeDiff = '';
  }
}

if (!rangeDiff.trim()) {
  try {
    rangeDiff = execSync('git show --no-patch --format= HEAD', { encoding: 'utf8' });
  } catch {
    rangeDiff = '';
  }
}

// Anything that can change served behaviour or the suite itself forces
// a full run. Docs-only pushes skip cleanly (README, AGENTS, comments).
const RUNTIME_PATTERN =
  /^(src\/|e2e\/|public\/|supabase\/|scripts\/mock-notify-contact\.mjs|playwright\.config\.ts|next\.config\.ts|middleware\.ts|package\.json|bun\.lock)/;

if (!RUNTIME_PATTERN.test(rangeDiff)) {
  console.log('ℹ️   No runtime/e2e changes in push range — skipping Playwright.');
  console.log(`    Range touched: ${rangeDiff.split('\n').join(' ').slice(0, 240)}`);
  process.exit(0);
}

if (!existsSync('.next/BUILD_ID')) {
  console.log('');
  console.log('✖  No production build at .next/BUILD_ID — e2e cannot run.');
  console.log('   Run: NEXT_SKIP_ENV_VALIDATION=1 bun run build');
  console.log('');
  process.exit(1);
}

console.log('🎭  Playwright e2e delivery gate (workers=2)...');
// workers=2: higher parallelism caused intermittent header-clearance
// flakes under load; CI keeps CI=true → retries + 2 workers in config.
const result = spawnSync('./node_modules/.bin/playwright', ['test', '--workers=2'], {
  stdio: 'inherit',
});

if (result.status === 0) {
  console.log('✔   E2E suite passed.');
  process.exit(0);
}

console.log('');
console.log('✖  E2E suite failed.');
console.log('   Report : npx playwright show-report');
console.log('   Single : ./node_modules/.bin/playwright test e2e/<spec>.spec.ts --headed --debug');
console.log('   Bypass : LEFTHOOK_EXCLUDE=e2e git push');
console.log('');
process.exit(1);
