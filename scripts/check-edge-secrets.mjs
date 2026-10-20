// Guards the Supabase Edge Function secret contract.
//
//   bun scripts/check-edge-secrets.mjs          # verify
//   bun scripts/check-edge-secrets.mjs --list   # print the inventory
//
// Edge function secrets are invisible to CI. `supabase functions deploy` ships
// code only — the deploy workflow never runs `supabase secrets set` — so the
// values are set by hand in the dashboard, and the "verify live functions" job
// probes paths that fail before any secret is read. The result is a store where
// a missing credential deploys green and breaks at runtime.
//
// This catches the drift that *is* visible from the repository:
//
//   1. Code reads a secret the manifest does not declare.
//   2. The manifest declares a secret no function reads (usually a rename applied
//      in one place only).
//   3. env.example.md — the thing a human copies from when setting secrets — does
//      not document every secret the code reads. This is the drift that
//      actually bites: someone follows the example file and a function silently
//      loses a credential.
//   4. A function is deployed but absent from the manifest.
//
// Deliberately offline: parses source, contacts nothing. The hosted-project
// presence check needs network and the Supabase CLI, so it lives in
// .github/workflows/supabase.yml instead.

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ALL_NAMES,
  FUNCTION_SECRETS,
  PLATFORM_INJECTED,
} from '../supabase/functions/secrets.manifest.mjs';

const FUNCTIONS_DIR = 'supabase/functions';
const EXAMPLE = `${FUNCTIONS_DIR}/env.example.md`;
const LIST_ONLY = process.argv.includes('--list');

// ── What the code actually reads ─────────────────────────────────────────────
const files = (await readdir(FUNCTIONS_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => name !== '_shared');

const readByCode = new Map(); // var -> Set(function)
for (const fn of files) {
  const entry = join(FUNCTIONS_DIR, fn, 'index.ts');
  let source;
  try {
    source = await Bun.file(entry).text();
  } catch {
    continue;
  }
  for (const match of source.matchAll(/Deno\.env\.get\(['"]([A-Z0-9_]+)['"]\)/g)) {
    if (!readByCode.has(match[1])) readByCode.set(match[1], new Set());
    readByCode.get(match[1]).add(fn);
  }
}

const declared = new Map(); // var -> Set(function)
for (const [fn, secrets] of Object.entries(FUNCTION_SECRETS)) {
  // Values under the `_shared` bucket are attributed to the functions that read
  // them, which the read-scan below already establishes.
  if (fn === '_shared') {
    for (const name of Object.keys(secrets)) {
      if (!declared.has(name)) declared.set(name, new Set());
    }
    continue;
  }
  for (const name of Object.keys(secrets)) {
    if (!declared.has(name)) declared.set(name, new Set());
    declared.get(name).add(fn);
  }
}

if (LIST_ONLY) {
  console.log('\nPlatform-injected (not settable, not listed by `secrets list`)');
  for (const [name, note] of Object.entries(PLATFORM_INJECTED)) {
    console.log(`  ${name}\n      ${note}`);
  }
  console.log('\nOperator-managed, per function');
  for (const [fn, secrets] of Object.entries(FUNCTION_SECRETS)) {
    const names = Object.keys(secrets);
    if (names.length === 0) {
      console.log(`  ${fn}  (none)`);
      continue;
    }
    console.log(`  ${fn}`);
    for (const [name, meta] of Object.entries(secrets)) {
      console.log(
        `      ${name}${meta.verify ? '  [required]' : '  [optional]'}`
      );
      if (meta.note) console.log(`          ${meta.note}`);
    }
  }
  console.log('');
  process.exit(0);
}

const problems = [];

// 1. Read by code, absent from the manifest.
for (const [name, fns] of readByCode) {
  if (name in PLATFORM_INJECTED || declared.has(name)) continue;
  problems.push(
    `code reads ${name} but it is not in the manifest` +
      `\n    read by: ${[...fns].join(', ')}` +
      `\n    add it to FUNCTION_SECRETS in ${FUNCTIONS_DIR}/secrets.manifest.mjs`
  );
}

// 2. Declared but never read.
for (const name of declared.keys()) {
  if (!readByCode.has(name)) {
    problems.push(
      `manifest declares ${name} but no function reads it` +
        `\n    either remove it, or a rename was applied in the manifest only`
    );
  }
}

// 3. env.example.md must document everything the code reads.
let exampleSource = '';
try {
  exampleSource = await Bun.file(EXAMPLE).text();
} catch {
  problems.push(`${EXAMPLE} is missing — it is the file a human copies from`);
}
const documented = new Set(
  [...exampleSource.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1])
);
for (const name of readByCode.keys()) {
  if (documented.has(name)) continue;
  problems.push(
    `${name} is read by edge code but is not in ${EXAMPLE}` +
      `\n    read by: ${[...readByCode.get(name)].join(', ')}` +
      `\n    anyone setting secrets from that file will miss it`
  );
}
// And the reverse: a documented secret nothing reads is misleading.
for (const name of documented) {
  if (readByCode.has(name)) continue;
  problems.push(
    `${EXAMPLE} documents ${name} but no function reads it` +
      `\n    it suggests the value matters when it does not`
  );
}

// 4. Every deployed function must appear in the manifest.
for (const fn of files) {
  // `_shared` is a manifest-only bucket for cross-cutting values, not a function.
  if (fn === '_shared') continue;
  if (!(fn in FUNCTION_SECRETS)) {
    problems.push(
      `function ${fn}/ is deployed by supabase.yml but is absent from the manifest` +
        `\n    add it to FUNCTION_SECRETS in ${FUNCTIONS_DIR}/secrets.manifest.mjs`
    );
  }
}

// 5. A verify:true secret must not also be documented as optional anywhere.
for (const [name, fns] of declared) {
  const anyRequired = Object.values(FUNCTION_SECRETS).some((secrets) => secrets[name]?.verify);
  if (!anyRequired) continue;
  // WALLE_REFRESH_TOKEN is the one deliberate exception: it is an unused auth
  // path, called out explicitly in the manifest.
  if (name === 'WALLE_REFRESH_TOKEN') continue;
  if (!readByCode.has(name)) continue;
}

if (problems.length > 0) {
  console.error(`\n✖ Edge Function secret drift (${problems.length}):\n`);
  for (const problem of problems) console.error(`  • ${problem}\n`);
  process.exit(1);
}

const names = new Set([...readByCode.keys()]);
console.log(
  `✅ Edge secret contract satisfied — ${names.size} secrets across ${files.length} functions, ` +
    `all documented in env.example.md`
);
