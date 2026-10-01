#!/usr/bin/env node
/**
 * Workflow YAML sanity.
 *
 * A malformed .github/workflows/*.yml silently disables a pipeline
 * (GitHub drops invalid workflow files). Parse-check any staged workflow
 * so a broken pipeline never ships.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
const errors = [];

for (const file of files) {
  try {
    execFileSync('ruby', ['-e', 'require "yaml"; YAML.load_file(ARGV[0]); puts "ok"', file], {
      stdio: 'pipe',
    });
  } catch {
    errors.push(`  ${file} (invalid YAML)`);
  }
}

if (errors.length > 0) {
  console.log('');
  console.log('✖  Invalid YAML in workflow file(s):');
  for (const e of errors) console.log(e);
  console.log('');
  console.log('   GitHub silently ignores broken workflow files — a malformed');
  console.log('   deploy.yml would disable CI without anyone noticing.');
  console.log('');
  process.exit(1);
}
