#!/usr/bin/env node
/**
 * Block direct pushes to main.
 */
import { execSync } from 'node:child_process';

if (process.env.CI === 'true') process.exit(0);

const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

if (currentBranch === 'main') {
  console.log('');
  console.log('✖  Direct push to main is not allowed.');
  console.log('   Open a pull request: gh pr create');
  console.log('   Bypass: LEFTHOOK_EXCLUDE=no-direct-main-push git push');
  console.log('');
  process.exit(1);
}
