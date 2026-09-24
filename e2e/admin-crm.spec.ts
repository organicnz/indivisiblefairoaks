import { expect, test } from '@playwright/test';

/**
 * CRM admin surface is gated by requireAdmin() (MFA-aware session check).
 * Without seeded admin credentials these routes must never render CRM data —
 * they must bounce unauthenticated visitors to /login.
 */
test.describe('Civic CRM admin gate', () => {
  const CRM_ROUTES = ['/admin/crm', '/admin/crm/tasks', '/admin/crm/broadcasts'];

  for (const route of CRM_ROUTES) {
    test(`redirects unauthenticated users away from ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      // Must not leak CRM chrome/content while logged out.
      await expect(page.locator('body')).not.toContainText('Constituent Directory');
      await expect(page.locator('body')).not.toContainText('Campaign Broadcasts');
      await expect(page.locator('body')).not.toContainText('Follow-ups');
    });
  }

  test('login page offers a path back to the requested admin route', async ({ page }) => {
    await page.goto('/admin/crm');
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
