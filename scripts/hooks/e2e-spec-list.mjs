#!/usr/bin/env node
/**
 * E2E spec list check (no browsers).
 *
 * Cheap commit-time guard: `playwright test --list` parses every spec and
 * fails on import/syntax errors without launching a browser. The full
 * suite is the pre-push delivery gate (see `e2e` under pre-push).
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync('./node_modules/.bin/playwright', ['test', '--list'], {
  encoding: 'utf8',
});

if (result.status === 0) process.exit(0);

console.log('');
console.log('✖  Playwright specs failed to list (import/syntax error):');
if (result.stderr) console.log(result.stderr);
console.log('');
console.log('   Fix the spec before committing.');
console.log('   Full suite runs as the pre-push e2e delivery gate.');
console.log('');
process.exit(1);
