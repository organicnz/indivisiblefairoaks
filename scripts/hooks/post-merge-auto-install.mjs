#!/usr/bin/env bun
/**
 * Auto-install when the lock file changes on merge.
 */
import { lines, runInherit, runText } from '../bun-exec.mjs';

const changed = lines(
  runText([
    'git',
    'diff-tree',
    '-r',
    '--name-only',
    '--no-commit-id',
    'ORIG_HEAD',
    'HEAD',
    '--',
    'bun.lock',
    'package.json',
  ])
);

if (changed.length === 0) process.exit(0);

console.log('📦  Lock file changed — running bun install...');
const code = runInherit(['bun', 'install']);
if (code !== 0) {
  console.error('✖  bun install failed — the working tree is not in a usable state.');
  process.exit(code);
}
