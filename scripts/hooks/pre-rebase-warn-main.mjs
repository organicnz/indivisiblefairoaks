#!/usr/bin/env node
/**
 * Warn before rebasing onto main.
 */
import { execSync } from 'node:child_process';

const upstream = process.argv[2];

if (upstream === 'main' || upstream === 'origin/main') {
  console.log('');
  console.log('⚠️   Rebasing onto main rewrites history.');
  console.log('    Only do this on private unshared branches.');
  console.log('    Proceeding in 3 seconds... (Ctrl+C to abort)');
  execSync('sleep 3');
}
