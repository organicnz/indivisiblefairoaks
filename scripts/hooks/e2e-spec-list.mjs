#!/usr/bin/env bun
/**
 * E2E spec list check (no browsers).
 *
 * Cheap commit-time guard: `playwright test --list` parses every spec and
 * fails on import/syntax errors without launching a browser. The full
 * suite is the pre-push delivery gate (see `e2e` under pre-push).
 *
 * Playwright is run through `bun <file>` rather than its `.bin` shim: the shim
 * has a `#!/usr/bin/env node` shebang, and this project has no Node. The
 * installed package is used directly — `bunx playwright` would resolve the
 * package from the registry and run a different version than the lockfile
 * pins.
 */
import { run } from '../bun-exec.mjs';

const result = run(['bun', 'node_modules/@playwright/test/cli.js', 'test', '--list']);

if (result.exitCode === 0) process.exit(0);

console.log('');
console.log('✖  Playwright specs failed to list (import/syntax error):');
if (result.stderr) console.log(result.stderr);
if (result.stdout) console.log(result.stdout);
console.log('');
console.log('   Fix the spec before committing.');
console.log('   Full suite runs as the pre-push e2e delivery gate.');
console.log('');
process.exit(1);
