// Guards the Vercel environment contract.
//
//   bun scripts/check-vercel-env.mjs          # verify
//   bun scripts/check-vercel-env.mjs --list   # print the inventory
//
// Four drift classes, all invisible to the compiler:
//
//   1. A var the code reads is not declared in scripts/vercel-env.mjs, so nobody
//      sets it and a runtime `.default()` masks its absence.
//   2. A declared var the code never reads — usually a rename applied in one
//      place only, or config that outlived its consumer.
//   3. A `NEXT_PUBLIC_*` value declared as a secret. Next inlines it into the
//      client bundle, so a real credential behind that prefix is published to
//      every visitor.
//   4. A CI-only variable present in `.env.example`, which is the template a human
//      copies from for local dev and therefore the most likely place for a test
//      switch to be handed to production.
//
// Offline by design: reads source and `.env.example`, contacts nothing. Checking
// what is *actually set* in the Vercel project needs `vercel env ls`, which
// requires the CLI to be authenticated against the project — a documented
// manual step, not something a pre-commit hook can do.

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ALL_SECRETS, ALL_VARS, CI_ONLY, SECRETS, VARS } from './vercel-env.mjs';
import { ALL_NAMES as EDGE_SECRET_NAMES } from '../supabase/functions/secrets.manifest.mjs';

const LIST_ONLY = process.argv.includes('--list');

// ── What the code reads ──────────────────────────────────────────────────────
// env.<NAME> is the sanctioned accessor: a pre-commit hook (`no-raw-env-access`)
// rejects raw process.env reads outside src/lib/env.ts, so env.X is the
// complete set of what the app consumes.
const SRC = 'src';
const readInCode = new Map(); // var -> [files]

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

for (const file of await walk(SRC)) {
  const source = await Bun.file(file).text();
  for (const match of source.matchAll(/\benv\.([A-Z0-9_]+)\b/g)) {
    if (!readInCode.has(match[1])) readInCode.set(match[1], []);
    readInCode.get(match[1]).push(file);
  }
}

// Read inside env.ts but consumed by nobody is fine — the schema is the contract.
// NODE_ENV and the validation switch are framework/build concerns, not config.
// NEXT_RUNTIME joins them: Next.js sets it to `nodejs` or `edge` per runtime,
// no operator ever sets it, and src/instrumentation.ts branches on it to load
// the matching Sentry config.
const FRAMEWORK = new Set(['NODE_ENV', 'NEXT_SKIP_ENV_VALIDATION', 'NEXT_RUNTIME']);

// `.env.example` legitimately carries BOTH Next app vars and Edge Function vars:
// `supabase functions serve` reads the same file when running edge code locally.
// So a var read only by an edge function (ZAI_API_KEY, GROQ_API_KEY, …) is not
// dead config. Scanning `src/` alone wrongly flagged those.
const edgeOwned = new Set(EDGE_SECRET_NAMES);

// Build-time-only secrets, read by next.config.ts — which lives at the repo
// root, cannot resolve the `@/` alias, and is outside the `src/` tree this
// checker scans. SENTRY_AUTH_TOKEN is the first of the kind: the Sentry build
// plugin reads it during `next build`, and no runtime code may touch it. A name
// lands here only with a reader named in its vercel-env.mjs note; anything else
// is the half-finished rename rule 2 exists to catch.
const buildTimeOwned = new Set(['SENTRY_AUTH_TOKEN']);

if (LIST_ONLY) {
  console.log('\nVercel VARIABLES (Project → Settings → Environment Variables → Plain)');
  for (const [name, meta] of Object.entries(VARS)) {
    console.log(`  ${name}${meta.required ? '' : '  (optional)'}`);
    if (meta.example) console.log(`      e.g. ${meta.example}`);
    if (meta.note) console.log(`      ${meta.note}`);
  }
  console.log('\nVercel SECRETS (Project → Settings → Environment Variables → Secret)');
  for (const [name, meta] of Object.entries(SECRETS)) {
    console.log(`  ${name}${meta.required ? '' : '  (optional)'}`);
    if (meta.example) console.log(`      e.g. ${meta.example}`);
    if (meta.note) console.log(`      ${meta.note}`);
  }
  console.log('\nCI-only — must NOT be set in the Vercel project');
  for (const [name, note] of Object.entries(CI_ONLY)) {
    console.log(`  ${name}\n      ${note}`);
  }
  console.log('\nSupabase Edge Function secrets → supabase/functions/env.example.md');
  console.log('GitHub Actions secrets and variables → docs/ci-secrets.md\n');
  process.exit(0);
}

const problems = [];

// 1. Read by code, undeclared.
for (const [name, files] of readInCode) {
  if (FRAMEWORK.has(name) || ALL_VARS.includes(name) || ALL_SECRETS.includes(name)) continue;
  if (name in CI_ONLY) continue;
  problems.push(
    `code reads env.${name} but it is not declared in scripts/vercel-env.mjs` +
      `\n    read by: ${[...new Set(files)].join(', ')}` +
      `\n    add it to VARS or SECRETS — otherwise nobody sets it and a Zod` +
      `\n    .default() masks its absence`
  );
}

// 2. Declared, never read.
for (const name of [...ALL_VARS, ...ALL_SECRETS]) {
  if (readInCode.has(name)) continue;
  if (buildTimeOwned.has(name)) continue;
  problems.push(
    `scripts/vercel-env.mjs declares ${name} but no code reads it` +
      `\n    either remove it, or a rename was applied in the manifest only`
  );
}

// 3. A NEXT_PUBLIC_* value declared as a secret.
for (const name of ALL_SECRETS) {
  if (!name.startsWith('NEXT_PUBLIC_')) continue;
  problems.push(
    `${name} is declared as a Vercel secret but is NEXT_PUBLIC_*` +
      `\n    Next inlines NEXT_PUBLIC_* into the client bundle. A credential behind` +
      `\n    that prefix is served to every visitor. It belongs under Plain.`
  );
}

// 4. A CI-only switch in the local-dev template.
let example = '';
try {
  example = await Bun.file('.env.example').text();
} catch {
  problems.push('.env.example is missing — it is the template a human copies from');
}
if (example) {
  for (const name of Object.keys(CI_ONLY)) {
    const declared = new RegExp(`^${name}=`, 'm').test(example);
    if (!declared) continue;
    problems.push(
      `.env.example declares ${name}, which is CI-only` +
        `\n    it is a test switch. Keeping it in the template a human copies from is` +
        `\n    how it ends up set in the Vercel project, where it would route real` +
        `\n    traffic into a test harness. Remove it from .env.example.`
    );
  }
  // Dead config: declared in the template, read by nothing. SUPABASE_SERVICE_ROLE_KEY
  // sat here for months — superseded by SUPABASE_SECRET_KEY, but still in the file
  // people copy from, implying a credential the app never uses.
  for (const match of example.matchAll(/^([A-Z0-9_]+)=/gm)) {
    const name = match[1];
    if (FRAMEWORK.has(name) || name in CI_ONLY) continue;
    if (readInCode.has(name)) continue;
    // Read by an edge function instead of the app — still live, not dead config.
    if (edgeOwned.has(name)) continue;
    problems.push(
      `.env.example declares ${name} but nothing reads it` +
        `\n    dead config. It implies a value the app needs, and people set it.` +
        `\n    (SUPABASE_SERVICE_ROLE_KEY was superseded by SUPABASE_SECRET_KEY.)`
    );
  }

  // And a *required* var the code needs that the template omits. Optional vars
  // legitimately may be absent from a local template.
  for (const name of ALL_VARS) {
    if (!VARS[name].required) continue;
    if (!new RegExp(`^${name}=`, 'm').test(example)) {
      problems.push(
        `${name} is required by the app but is not in .env.example` +
          `\n    local dev cannot initialise it, and the env-integrity hook keys` +
          `\n    off that file — so nothing flagged the omission`
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`\n✖ Vercel environment drift (${problems.length}):\n`);
  for (const problem of problems) console.error(`  • ${problem}\n`);
  process.exit(1);
}

console.log(
  `✅ Vercel env contract satisfied — ${ALL_VARS.length} vars, ${ALL_SECRETS.length} secrets, ` +
    `all read by the app and all present in .env.example`
);
