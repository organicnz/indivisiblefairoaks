#!/usr/bin/env node
/**
 * Notify when dependencies change on branch checkout.
 */
import { execSync } from 'node:child_process';

const [, , prev, curr, isBranchCheckout] = process.argv;

if (isBranchCheckout !== '1') process.exit(0);

let changed;
try {
  changed = execSync(`git diff --name-only ${prev} ${curr} -- package.json bun.lock`, {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
} catch {
  process.exit(0);
}

if (changed.length > 0) {
  console.log('');
  console.log('📦  Dependencies changed on this branch. Run: bun install');
  console.log('');
}
