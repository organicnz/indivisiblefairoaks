#!/usr/bin/env bun
/**
 * Warn before rebasing onto main.
 */
const upstream = process.argv[2];

if (upstream === 'main' || upstream === 'origin/main') {
  console.log('');
  console.log('⚠️   Rebasing onto main rewrites history.');
  console.log('    Only do this on private unshared branches.');
  console.log('    Proceeding in 3 seconds... (Ctrl+C to abort)');
  // `Bun.sleep` rather than forking a `sleep` process to do nothing for
  // three seconds.
  await Bun.sleep(3000);
}
