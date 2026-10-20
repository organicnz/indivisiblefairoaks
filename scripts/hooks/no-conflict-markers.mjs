#!/usr/bin/env bun
/**
 * Merge conflict markers.
 *
 * A leftover conflict marker compiles fine in most grammars but ships
 * broken code. Fail the commit if any staged file contains one.
 */

const MARKER = /^<<<<<<< |^=======$\|^>>>>>>> /;

const files = process.argv.slice(2);
const found = [];

for (const file of files) {
  let content;
  try {
    content = await Bun.file(file).text();
  } catch {
    continue;
  }
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (MARKER.test(lines[i])) {
      found.push(`${file}:${i + 1}:${lines[i]}`);
    }
  }
}

if (found.length > 0) {
  console.log('');
  console.log('✖  Merge conflict markers in staged files:');
  for (const f of found) console.log(f);
  console.log('');
  console.log('   Resolve the conflict first (git mergetool), then re-stage.');
  console.log('');
  process.exit(1);
}
