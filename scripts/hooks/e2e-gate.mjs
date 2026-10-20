#!/usr/bin/env bun
/**
 * Playwright e2e delivery gate.
 *
 * Runs last so build-check has already produced a warm .next; Playwright's
 * webServer starts `next start` against that build (reuseExistingServer).
 * Change-aware: full suite only when the push range can affect runtime.
 * Bypass (emergency only): LEFTHOOK_EXCLUDE=e2e git push
 */
import { run, tryRunText } from '../bun-exec.mjs';

// Push range: upstream when available, otherwise the tip commit.
let rangeDiff = tryRunText(['git', 'diff', '--name-only', '@{u}...HEAD']) ?? '';
if (!rangeDiff.trim()) {
  rangeDiff = tryRunText(['git', 'diff', '--name-only', 'HEAD~1...HEAD']) ?? '';
}

if (!rangeDiff.trim()) {
  rangeDiff = tryRunText(['git', 'show', '--no-patch', '--format=', 'HEAD']) ?? '';
}

// Anything that can change served behaviour or the suite itself forces
// a full run. Docs-only pushes skip cleanly (README, AGENTS, comments).
//
// **The test is per line, and it has to be.** `rangeDiff` is a
// newline-separated list of paths, and this pattern is anchored with `^`.
// Without the `m` flag, `^` matches only the start of the *whole string* —
// so the pattern matched only when the **first** path in the sorted list
// happened to be one of these.
//
// That is how this gate came to skip almost every push. The list is sorted,
// and it starts with whatever sorts first: `AGENTS.md`, a `.github/`
// workflow, a skill file, `bun.lock`… None of those is `src/` or `e2e/`, so
// the gate read "no runtime changes" for a push that had changed 128 of
// them.
//
// The bug arrived with `b7583ec`, which moved this check out of a bash
// `grep -qE` — which *is* per line — and into a JavaScript regex, which
// was not. The CI equivalent in `.github/workflows/ci.yml` still uses
// `grep -qE` and was never affected, so only the local pre-push gate was
// blind.
//
// A guard that skips the work it exists to do is worse than no guard: it
// reports success, and the push looks delivered.
const RUNTIME_PATTERN =
  /^(src\/|e2e\/|public\/|supabase\/|scripts\/mock-notify-contact\.mjs|playwright\.config\.ts|next\.config\.ts|proxy\.ts|package\.json|bun\.lock)/;

const touchesRuntime = rangeDiff
  .split('\n')
  .some((line) => RUNTIME_PATTERN.test(line));

if (!touchesRuntime) {
  console.log('ℹ️   No runtime/e2e changes in push range — skipping Playwright.');
  console.log(`    Range touched: ${rangeDiff.split('\n').join(' ').slice(0, 240)}`);
  process.exit(0);
}

if (!(await Bun.file('.next/BUILD_ID').exists())) {
  console.log('');
  console.log('✖  No production build at .next/BUILD_ID — e2e cannot run.');
  console.log('   Run: NEXT_SKIP_ENV_VALIDATION=1 bun run build');
  console.log('');
  process.exit(1);
}

console.log('🎭  Playwright e2e delivery gate (workers=2)...');
// workers=2: higher parallelism caused intermittent header-clearance
// flakes under load; CI keeps CI=true → retries + 2 workers in config.
//
// The CLI is invoked as `bun <file>`, never as `./node_modules/.bin/playwright`.
// The `.bin` shim is a `#!/usr/bin/env node` script, and this project has no
// Node — so the shim would exec a missing interpreter. `bun <file>` runs the
// lockfile-pinned Playwright on Bun's runtime. `bunx playwright` is equally
// wrong for a different reason: `playwright` is only a transitive dependency,
// so `bunx` would resolve it from the registry and run a version the lockfile
// does not pin.
const result = run(['bun', 'node_modules/@playwright/test/cli.js', 'test', '--workers=2'], {
  stdout: 'inherit',
  stderr: 'inherit',
});

if (result.exitCode === 0) {
  console.log('✔   E2E suite passed.');
  process.exit(0);
}

console.log('');
console.log('✖  E2E suite failed.');
console.log('   Report : bun node_modules/@playwright/test/cli.js show-report');
console.log('   Single : bun node_modules/@playwright/test/cli.js test e2e/<spec>.spec.ts --headed --debug');
console.log('   Bypass : LEFTHOOK_EXCLUDE=e2e git push');
console.log('');
process.exit(1);
