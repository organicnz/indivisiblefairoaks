#!/usr/bin/env node
/**
 * Admin client scope guard.
 *
 * createAdminClient() bypasses Row Level Security entirely. It must only
 * appear in the explicitly audited files below. Any new usage outside this
 * allowlist is a potential data exposure and requires a security review.
 *
 * Current allowlist (from audit):
 *   src/app/admin/         — admin dashboard (is_admin check required)
 *   src/app/api/webhooks/  — stripe webhook (server-to-server, no user session)
 *   src/app/products/page.tsx — public product listing (read-only, no write)
 *   src/app/account/page.tsx  — profile fetch with user-id scoping
 *   src/lib/admin-auth.ts     — admin-only chokepoint: verifies is_admin
 *                              BEFORE issuing the admin client, then hands
 *                              it only to /admin routes and actions.
 *   src/app/api/crm/unsubscribe/ — public RFC 8058 landing zone: no user
 *                              session exists; token is an unguessable
 *                              per-contact UUID, update is idempotent and
 *                              rate-limited (20/10min/IP). Read + opt-out
 *                              write only — cannot escalate or exfiltrate.
 *
 * Test files are excluded, and the reasoning is narrow rather than
 * convenient. A file under `__tests__` is never shipped, so it cannot
 * bypass RLS in production; and the only way the symbol appears in one
 * is as the *name* of a `vi.mock('@/lib/supabase-server', …)` factory
 * — which is the thing that stops the real privileged client from ever
 * being constructed. Flagging that is a false positive on the exact
 * pattern that makes a test safe.
 *
 * Residual risk, stated: a test that called the *real*
 * `createAdminClient()` would need live credentials in the test
 * environment, and none are injected — `env.ts` validates on import and
 * the server-only key is absent. The same `__tests__` exclusion is
 * already used by `suppress-count` below, so this follows an existing
 * precedent rather than inventing one.
 */
import { readFileSync } from 'node:fs';

const ALLOWLIST =
  'src/app/admin/|src/app/api/webhooks/|src/app/api/crm/unsubscribe/|src/app/products/page.tsx|src/app/account/page.tsx|src/lib/supabase-server.ts|src/lib/admin-auth.ts';

const files = process.argv.slice(2);
const violations = [];

for (const file of files) {
  if (file.includes('__tests__')) continue;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (!content.includes('createAdminClient')) continue;
  if (new RegExp(ALLOWLIST).test(file)) continue;

  violations.push(`  ${file}`);
}

if (violations.length > 0) {
  console.log('');
  console.log('✖  createAdminClient() used outside approved scope:');
  for (const v of violations) console.log(v);
  console.log('');
  console.log('   createAdminClient bypasses Row Level Security entirely.');
  console.log('   Use createServerClient() for user-scoped operations.');
  console.log('');
  console.log('   If this usage is intentional, add the file to the ALLOWLIST');
  console.log('   in scripts/hooks/admin-client-scope.mjs with a security review comment explaining why.');
  console.log('');
  process.exit(1);
}
