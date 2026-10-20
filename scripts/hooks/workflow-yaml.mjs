#!/usr/bin/env bun
/**
 * Workflow YAML sanity.
 *
 * A malformed .github/workflows/*.yml silently disables a pipeline
 * (GitHub drops invalid workflow files). Parse-check any staged workflow
 * so a broken pipeline never ships.
 *
 * The parse is `Bun.YAML.parse`, so there is no Ruby dependency, no
 * subprocess, and no second language in a repository whose entire toolchain
 * is Bun and Deno. Bun's YAML is 1.2, which also means `on:` stays the
 * string "on" instead of being coerced to the boolean `true` the way a 1.1
 * parser would — a difference that matters for GitHub Actions keys.
 */
const files = process.argv.slice(2);
const errors = [];

for (const file of files) {
  try {
    const text = await Bun.file(file).text();
    Bun.YAML.parse(text);
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
