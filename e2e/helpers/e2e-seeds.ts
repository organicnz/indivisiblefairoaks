import path from 'node:path';

/**
 * Freshness flag for the seeded admin grant, shared between the setup project
 * and its consumers without importing a test file (importing auth.setup.ts
 * would register its tests a second time).
 *
 * Written by e2e/auth.setup.ts when e2e-admin signs in but is not an admin,
 * removed when the seed verifies. The consuming suite checks it in a
 * beforeEach — not at load time, because workers load spec files before the
 * setup project finishes, so a load-time read would race the writer.
 */
export const GRANT_MARKER = path.join(import.meta.dirname, '..', '.auth', 'no-admin-grant');

/**
 * Written when e2e-admin signs in but has no verified TOTP factor.
 *
 * Admin pages now require enrollment, so the legacy non-MFA seed can no longer
 * reach the rendered admin surfaces. The setup reports that as an incomplete
 * fixture and skips the browser admin suite rather than weakening the gate.
 */
export const MFA_ENROLLMENT_MARKER = path.join(
  import.meta.dirname,
  '..',
  '.auth',
  'no-admin-mfa'
);
