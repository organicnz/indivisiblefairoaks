#!/usr/bin/env bun
/**
 * Notify when dependencies change on branch checkout.
 */
import { lines, tryRunText } from '../bun-exec.mjs';

const [, , prev, curr, isBranchCheckout] = process.argv;

if (isBranchCheckout !== '1') process.exit(0);

// The refs are argv elements, not shell text. They used to be interpolated
// into a command string, which meant a branch named `x; rm -rf ~` was a
// command line.
const changed = tryRunText([
  'git',
  'diff',
  '--name-only',
  prev,
  curr,
  '--',
  'package.json',
  'bun.lock',
]);

if (changed === null) process.exit(0);

if (lines(changed).length > 0) {
  console.log('');
  console.log('📦  Dependencies changed on this branch. Run: bun install');
  console.log('');
}
