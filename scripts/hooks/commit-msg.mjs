#!/usr/bin/env node
/**
 * Conventional Commits message check.
 */
import { readFileSync } from 'node:fs';

const msgFile = process.argv[2];
const msg = readFileSync(msgFile, 'utf8');

const cleanMsg = msg
  .split('\n')
  .filter((l) => !l.startsWith('#'))
  .filter((l) => l.trim())
  .slice(0, 1)[0];

const pattern = /^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\(.+\))?(!)?: .{1,100}$/;

if (!pattern.test(cleanMsg)) {
  console.log('');
  console.log('✖  Commit message doesn\'t follow Conventional Commits.');
  console.log('   Format : type(scope?): subject  (max 100 chars)');
  console.log('   Types  : feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert');
  console.log('   Breaking: append !  →  feat(api)!: redesign checkout');
  console.log('');
  console.log(`   Your message: ${cleanMsg}`);
  console.log('');
  process.exit(1);
}
