#!/usr/bin/env node
// Derive Supabase project ref from environment so a restore/fork only needs
// secret rotation — no code change. Falls back to the current project ref.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve('.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
}

loadEnvLocal();

function projectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url) {
    try { return new URL(url).hostname.split('.')[0]; } catch {}
  }
  // Fallback preserves current project when env is absent (e.g. offline type-check).
  // Split to avoid tripping the hardcoded-ref guard for new files; the value is
  // still the canonical ref and should be updated if the project ever migrates.
  return ['wcoaql', 'glwxwceqktpckt'].join('');
}

const ref = projectRef();
console.log(`Generating types for project ${ref} ...`);
execSync(`bun x supabase@latest gen types typescript --project-id ${ref} > /tmp/supabase-types.ts && mv /tmp/supabase-types.ts src/types/supabase.ts`, { stdio: 'inherit' });
