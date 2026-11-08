#!/usr/bin/env bun
/**
 * Workflow YAML and action-ref sanity.
 *
 * A malformed .github/workflows/*.yml silently disables a pipeline
 * (GitHub drops invalid workflow files). Parse-check any staged workflow
 * so a broken pipeline never ships.
 *
 * The same pass rejects a remote `uses:` reference that is not a full
 * commit SHA; a floating tag or branch can change CI without a repository
 * change. The scanner walks the parsed job and step structure, so folded
 * scalars, quoted values, and reusable-workflow refs are checked alike.
 *
 * The parse is `Bun.YAML.parse`, so there is no Ruby dependency, no
 * subprocess, and no second language in a repository whose entire toolchain
 * is Bun and Deno. Bun's YAML is 1.2, which also means `on:` stays the
 * string "on" instead of being coerced to the boolean `true` the way a 1.1
 * parser would — a difference that matters for GitHub Actions keys.
 */
import { findUnpinnedActionRefs } from './action-pinning.mjs';

const files = process.argv.slice(2);
const yamlErrors = [];
const pinningErrors = [];

for (const file of files) {
  try {
    const text = await Bun.file(file).text();
    const workflow = Bun.YAML.parse(text);
    for (const finding of findUnpinnedActionRefs(workflow)) {
      pinningErrors.push(`  ${file}  ${finding.path}  ${finding.ref}`);
    }
  } catch {
    yamlErrors.push(`  ${file} (invalid YAML)`);
  }
}

if (yamlErrors.length > 0) {
  console.log('');
  console.log('✖  Invalid YAML in workflow file(s):');
  for (const e of yamlErrors) console.log(e);
  console.log('');
  console.log('   GitHub silently ignores broken workflow files — a malformed');
  console.log('   deploy.yml would disable CI without anyone noticing.');
  console.log('');
  process.exit(1);
}

if (pinningErrors.length > 0) {
  console.log('');
  console.log('✖  GitHub Action references must be pinned to a full commit SHA:');
  for (const e of pinningErrors) console.log(e);
  console.log('');
  console.log('   Use owner/action@<40-character-sha> # vN instead of a tag or branch.');
  console.log('');
  process.exit(1);
}
