#!/usr/bin/env node
/**
 * Auto-install when the lock file changes on merge.
 */
import { execSync } from 'node:child_process';

const changed = execSync(
  'git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD -- bun.lock package.json',
  { encoding: 'utf8' }
)
  .split('\n')
  .filter(Boolean);

if (changed.length === 0) process.exit(0);

console.log('📦  Lock file changed — running bun install...');
execSync('bun install', { stdio: 'inherit' });
