#!/usr/bin/env node
/**
 * Lock file sync check (pre-push).
 */
import { execSync } from 'node:child_process';

function diffNames(args) {
  try {
    return execSync(`git diff --name-only ${args}`, { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

const upstreamDiff = diffNames('HEAD..@{u}');
const localDiff = diffNames('HEAD');

if (upstreamDiff.includes('package.json') && !upstreamDiff.includes('bun.lock')) {
  console.log('✖  package.json changed but bun.lock not updated. Run: bun install');
  process.exit(1);
}

if (localDiff.includes('package.json') && !localDiff.includes('bun.lock')) {
  console.log('✖  package.json has local changes but bun.lock is unchanged. Run: bun install');
  process.exit(1);
}
