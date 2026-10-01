#!/usr/bin/env node
/**
 * Edge function import scope.
 *
 * Supabase edge functions are bundled by the CLI at deploy time, and the
 * bundle is rooted at the function's own directory in Deno. Only three kinds
 * of specifier survive that:
 *
 *   1. `jsr:` / `npm:` — Deno-native, resolved by the runtime itself.
 *   2. a relative import that stays inside `supabase/functions/` — which is
 *      what `_shared/` is for.
 *   3. nothing else.
 *
 * Anything that reaches into the Next app — `../../src/lib/...`, `@/lib/...`,
 * or a bare package name with no `npm:` prefix (there is no
 * `import_map.json`, so Deno cannot resolve it) — is the BOOT_ERROR this
 * guard was written to prevent.
 *
 * Two corrections to the previous bash implementation, both of which were
 * found by diffing this script's verdict against the original's across the
 * whole repository. It is recorded here because "the guard was dead" is the
 * kind of fact that gets re-learned the hard way:
 *
 *   - The original wrote `grep ... || true > "$tmpfile"`. A redirect binds
 *     tighter than `||`, so the redirect attached to `true`, `$tmpfile` was
 *     always empty, the `while read` loop never ran, and the guard exited 0
 *     unconditionally. Every import shape passed, including the ones it was
 *     written to catch. It looked like protection and protected nothing.
 *   - Its allowlist permitted `*src/config/*`, contradicting its own
 *     remediation text and `supabase/functions/_shared/commerce.ts`, which
 *     records that "the edge runtime cannot import from `src/` (different
 *     module root and resolver)". That allowance pointed at a move that cannot
 *     work, and `_shared/` — the mechanism that actually exists — was flagged
 *     as a violation.
 *
 * The rule below is what the deployment actually requires, not what the old
 * case statement happened to test.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const FUNCTIONS_ROOT = 'supabase/functions';

/** Matches `from '<spec>'` and bare `import '<spec>'`, in that precedence order. */
function specifier(line) {
  const from = line.match(/from\s+['"]([^'"]+)['"]/);
  if (from) return from[1];
  const bare = line.match(/^\s*import\s+['"]([^'"]+)['"]/);
  return bare ? bare[1] : null;
}

const files = process.argv.slice(2);
const violations = [];

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const line of content.split('\n')) {
    const target = specifier(line);
    if (!target) continue;

    if (target.startsWith('jsr:') || target.startsWith('npm:')) continue;

    if (target.startsWith('.') || target.startsWith('/')) {
      // Resolved against the importing file's own directory, so the answer does
      // not depend on how deeply nested the function happens to be.
      const resolved = path.resolve(path.dirname(file), target);
      if (resolved.startsWith(path.resolve(FUNCTIONS_ROOT) + path.sep)) continue;
      violations.push(`  ${file} → ${target}`);
      continue;
    }

    // A bare specifier with no `npm:` prefix. No import_map.json exists, so
    // Deno has nothing to resolve this against.
    violations.push(`  ${file} → ${target}`);
  }
}

if (violations.length > 0) {
  console.log('');
  console.log('✖  Edge function import outside the function bundle:');
  for (const v of violations) console.log(v);
  console.log('');
  console.log('   The edge bundle is rooted at the function directory. Only');
  console.log('   `jsr:` / `npm:` specifiers and relative imports that stay');
  console.log('   inside supabase/functions/ are resolvable there. The runtime');
  console.log('   cannot import from `src/` at all — it has a different module');
  console.log('   root — so shared logic is mirrored into');
  console.log('   supabase/functions/_shared/ (commerce parity is asserted by');
  console.log('   src/lib/__tests__/commerce-parity.test.ts) or taken from jsr:/npm:.');
  console.log('');
  process.exit(1);
}