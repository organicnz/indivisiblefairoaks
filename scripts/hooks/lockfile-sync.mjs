#!/usr/bin/env bun
/**
 * Lock file sync check (pre-push).
 */
import { lines, tryRunText } from '../bun-exec.mjs';

function diffNames(refs) {
  return lines(tryRunText(['git', 'diff', '--name-only', ...refs]) ?? '');
}

const upstreamDiff = diffNames(['HEAD..@{u}']);
const localDiff = diffNames(['HEAD']);

if (upstreamDiff.includes('package.json') && !upstreamDiff.includes('bun.lock')) {
  console.log('✖  package.json changed but bun.lock not updated. Run: bun install');
  process.exit(1);
}

if (localDiff.includes('package.json') && !localDiff.includes('bun.lock')) {
  console.log('✖  package.json has local changes but bun.lock is unchanged. Run: bun install');
  process.exit(1);
}
