import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { GRANT_MARKER } from './helpers/e2e-seeds';

/**
 * Seeded admin session for the suites that assert on rendered admin surfaces
 * instead of the login redirect.
 *
 * This is a `setup` project (see playwright.config.ts), not a beforeAll hook,
 * on purpose: a beforeAll that writes the storage file its own describe then
 * consumes via test.use cannot bootstrap itself. When the file does not exist
 * yet, fixture setup fails first and the in-flight hook is cancelled silently,
 * so every test reports a storage-state ENOENT instead of whatever actually
 * went wrong. This file has no test.use, so a failure here displays as itself.
 *
 * Requires E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD for a non-MFA-enrolled admin
 * on the target Supabase project (see scripts/seed-e2e-users.mjs), including
 * the manual profiles grant the priv-esc trigger demands. Without credentials
 * this skips, and the consuming suites skip too.
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const STORAGE_STATE = path.join(__dirname, '.auth', 'admin.json');

setup.describe('seeded admin session', () => {
  setup.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run');

  setup('sign in as the seeded admin', async ({ page }) => {
    await page.goto('/login?next=/admin');
    await page.locator('#auth-tab-password').click();
    await page.locator('#login-email').fill(ADMIN_EMAIL as string);
    await page.locator('#login-password').fill(ADMIN_PASSWORD as string);
    // The submit button, not the "Existing Personnel? Sign In" mode toggle in
    // the footer — /sign in/i matches the toggle, which flips the form into
    // sign-up mode and never navigates. Same selector as mfa-challenge.spec.ts.
    await page.getByRole('button', { name: /^authenticate$/i }).click();
    // Wait until the form actually leaves /login: the ?next=/admin query value
    // itself contains "/admin", so matching on the full URL string returns
    // immediately without waiting for the sign-in round-trip. The pathname
    // cannot match spuriously.
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
    // /admin renders for any signed-in user — non-admins get an "Administrator
    // Privileges Required" notice on the same path — so the pathname alone
    // cannot prove the grant. The directory heading can.
    //
    // A missing grant SKIPS (loudly), it does not fail: sign-in working but
    // the grant absent means the environment is half-seeded, which is the same
    // class of state as credentials absent — and failing here would turn every
    // runtime push red until a human runs one dashboard statement. A broken
    // sign-in, on the other hand, throws above and fails the gate, because
    // that is a product regression rather than an incomplete environment.
    await page.goto('/admin/crm');
    try {
      // Same marker the consuming suite asserts on.
      await expect(page.locator('body')).toContainText('Constituent Directory', {
        timeout: 15_000,
      });
      rmSync(GRANT_MARKER, { force: true });
    } catch {
      console.log('');
      console.log('ADMIN SEED INCOMPLETE — skipping seeded admin coverage.');
      console.log('e2e-admin signed in but is not an admin.');
      console.log('Run this once from the dashboard SQL editor:');
      console.log(
        "  update public.profiles set is_admin = true where email = 'e2e-admin@example.com';"
      );
      console.log('');
      mkdirSync(path.dirname(GRANT_MARKER), { recursive: true });
      writeFileSync(GRANT_MARKER, 'seeded e2e-admin lacks the profiles grant\n');
      setup.skip(
        true,
        'seeded e2e-admin lacks the profiles grant — run the dashboard statement above'
      );
    }
    mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
    await page.context().storageState({ path: STORAGE_STATE });
  });
});
