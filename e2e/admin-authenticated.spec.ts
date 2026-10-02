import { mkdirSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Authenticated admin coverage. Seeded once per run through the site's own
 * password sign-in, then every admin surface asserts on the rendered page
 * instead of the login redirect.
 *
 * Requires E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD for a non-MFA-enrolled admin
 * user on the target Supabase project. Without them the whole suite skips —
 * admin browser coverage stays opt-in until that user exists, and nothing in
 * the gate silently weakens.
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const STORAGE_STATE = path.join(__dirname, '.auth', 'admin.json');

test.describe('admin surfaces with a seeded session', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run');

  test.beforeAll(async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.goto('/login?next=/admin');
    await page.locator('#auth-tab-password').click();
    await page.locator('#login-email').fill(ADMIN_EMAIL as string);
    await page.locator('#login-password').fill(ADMIN_PASSWORD as string);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(admin|account)/, { timeout: 15_000 });
    mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
    await ctx.storageState({ path: STORAGE_STATE });
    await ctx.close();
  });

  test.use({ storageState: STORAGE_STATE });

  test('constituent directory renders for an admin', async ({ page }) => {
    await page.goto('/admin/crm');
    await expect(page).toHaveURL(/\/admin\/crm/);
    await expect(page.locator('body')).toContainText('Constituent Directory');
  });

  test('broadcast composer renders for an admin', async ({ page }) => {
    await page.goto('/admin/crm/broadcasts');
    await expect(page).toHaveURL(/\/admin\/crm\/broadcasts/);
    await expect(page.locator('body')).toContainText('Campaign Broadcasts');
  });

  test('content editor renders for an admin', async ({ page }) => {
    await page.goto('/admin/content');
    await expect(page).toHaveURL(/\/admin\/content/);
    await expect(page.locator('body')).not.toContainText('Sign in');
  });

  test('admin CRM page has no serious axe violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/admin/crm', { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? '')
    );
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('an unauthenticated context still redirects', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/admin/crm');
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });
});
