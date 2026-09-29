// Guards the GitHub Actions configuration contract.
//
//   node scripts/check-ci-env.mjs          # verify
//   node scripts/check-ci-env.mjs --list   # print the inventory
//
// Three classes of drift are caught:
//
//   1. A workflow references a secret/variable that is not declared here. That
//      value does not exist, and `${{ secrets.X }}` expands to an empty string
//      rather than erroring — the step runs with a blank value and fails
//      somewhere unrelated, or (worse) succeeds with a placeholder.
//   2. The inventory declares something no workflow uses. Usually a rename that
//      was applied in one place only, which leaves the other silently broken.
//   3. A `NEXT_PUBLIC_*` value is stored as a secret instead of a variable.
//      These ship in the browser bundle, and repository secrets are withheld from
//      fork `pull_request` runs — so a fork PR builds against empty config.
//
// Wiring: `.github/workflows/*` are parsed as text. This deliberately does not
// shell out to `actionlint` or the GitHub API — the contract must be verifiable
// offline, in a pre-commit hook, with no network and no auth.

import { readFile, readdir } from 'node:fs/promises';
import { SECRETS, VARIABLES } from './ci-env.mjs';

const WORKFLOW_DIR = '.github/workflows';
const LIST_ONLY = process.argv.includes('--list');

const declaredSecrets = new Set(Object.keys(SECRETS));
const declaredVariables = new Set(Object.keys(VARIABLES));
// Provided by GitHub itself; never declared as a repository secret.
const BUILT_IN = new Set(['GITHUB_TOKEN']);

const files = (await readdir(WORKFLOW_DIR)).filter((f) => f.endsWith('.yml'));
const usedSecrets = new Map();
const usedVariables = new Map();

for (const file of files) {
  const source = await readFile(`${WORKFLOW_DIR}/${file}`, 'utf8');
  for (const match of source.matchAll(/secrets\.([A-Z0-9_]+)/g)) {
    if (!usedSecrets.has(match[1])) usedSecrets.set(match[1], new Set());
    usedSecrets.get(match[1]).add(file);
  }
  for (const match of source.matchAll(/vars\.([A-Z0-9_]+)/g)) {
    if (!usedVariables.has(match[1])) usedVariables.set(match[1], new Set());
    usedVariables.get(match[1]).add(file);
  }
}

if (LIST_ONLY) {
  console.log('\nRepository VARIABLES (Settings → Secrets and variables → Actions → Variables)');
  for (const [name, meta] of Object.entries(VARIABLES)) {
    console.log(`  ${name}${meta.required ? '' : '  (optional)'}`);
    if ('example' in meta) console.log(`      e.g. ${meta.example}`);
    if ('note' in meta) console.log(`      ${meta.note}`);
  }
  console.log('\nRepository SECRETS (Settings → Secrets and variables → Actions → Secrets)');
  for (const [name, meta] of Object.entries(SECRETS)) {
    console.log(`  ${name}${meta.required ? '' : '  (optional)'}`);
    if ('example' in meta) console.log(`      e.g. ${meta.example}`);
    if ('note' in meta) console.log(`      ${meta.note}`);
  }
  console.log('');
  process.exit(0);
}

const problems = [];

// 1. Referenced but undeclared.
for (const [name, where] of usedSecrets) {
  if (BUILT_IN.has(name) || declaredSecrets.has(name)) continue;
  problems.push(
    `workflow references secrets.${name} but it is not in scripts/ci-env.mjs SECRETS` +
      `\n    used in: ${[...where].join(', ')}`
  );
}
for (const [name, where] of usedVariables) {
  if (declaredVariables.has(name)) continue;
  problems.push(
    `workflow references vars.${name} but it is not in scripts/ci-env.mjs VARIABLES` +
      `\n    used in: ${[...where].join(', ')}`
  );
}

// 2. Declared but unused — usually a half-finished rename.
for (const name of declaredSecrets) {
  if (!usedSecrets.has(name)) {
    problems.push(
      `SECRETS.${name} is declared but no workflow references it` +
        `\n    either remove it from the contract, or a rename was applied in ci-env.mjs only`
    );
  }
}
for (const name of declaredVariables) {
  if (!usedVariables.has(name)) {
    problems.push(
      `VARIABLES.${name} is declared but no workflow references it` +
        `\n    either remove it from the contract, or a rename was applied in ci-env.mjs only`
    );
  }
}

// 3. A public value parked in the secrets store.
for (const name of usedSecrets.keys()) {
  if (name.startsWith('NEXT_PUBLIC_')) {
    problems.push(
      `secrets.${name} holds a NEXT_PUBLIC_* value` +
        `\n    Next inlines NEXT_PUBLIC_* into the client bundle, so it is public by` +
        `\n    construction. It belongs in vars.* — and repository secrets are not` +
        `\n    exposed to pull_request runs from forks, so it arrives empty there.`
    );
  }
}

// 4. Least privilege: a workflow holding credentials must declare permissions.
const credentialed = ['RUNNERS_TOKEN', 'SUPABASE_SECRET_KEY', 'SUPABASE_ACCESS_TOKEN'];
for (const file of files) {
  const source = await readFile(`${WORKFLOW_DIR}/${file}`, 'utf8');
  const usesCredential = credentialed.some((s) => source.includes(`secrets.${s}`));
  if (usesCredential && !/^permissions:/m.test(source)) {
    problems.push(
      `${file} uses a credential but declares no top-level 'permissions:' block` +
        `\n    it inherits the repository default, which may grant write. Add:` +
        `\n      permissions:\n        contents: read`
    );
  }
}

if (problems.length > 0) {
  console.error(`\n✖ GitHub Actions configuration drift (${problems.length}):\n`);
  for (const problem of problems) console.error(`  • ${problem}\n`);
  process.exit(1);
}

console.log(
  `✅ CI env contract satisfied — ${usedVariables.size} variables, ` +
    `${[...usedSecrets].filter((s) => !BUILT_IN.has(s)).length} secrets across ${files.length} workflows`
);
