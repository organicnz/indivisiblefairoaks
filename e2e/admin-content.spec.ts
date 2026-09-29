import { expect, test } from '@playwright/test';

/**
 * The content editor admin surface is gated by requireAdmin() (an MFA-aware
 * session check) like the rest of /admin. Without seeded admin credentials
 * these routes must never render CMS rows — including draft slugs and titles,
 * which is the thing that would matter most if the gate ever failed.
 */
test.describe('Content editor admin gate', () => {
  const ROUTES = ['/admin/content', '/admin/content/new', '/admin/content/1'];

  for (const route of ROUTES) {
    test(`redirects unauthenticated users away from ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      // Editor chrome and CMS content must not leak while logged out.
      await expect(page.locator('body')).not.toContainText('Pages & posts');
      await expect(page.locator('body')).not.toContainText('New page');
      await expect(page.locator('body')).not.toContainText('Search preview');
      await expect(page.locator('body')).not.toContainText('URL slug');
    });
  }

  test('login page offers a path back to the requested editor route', async ({ page }) => {
    await page.goto('/admin/content');
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test('a missing CMS page is never indexable', async ({ page }) => {
    // This route is Partial Prerendered, so a missing row comes back as HTTP 200
    // with a "Page Not Found" title — see the note on ContentPage in
    // src/app/[slug]/page.tsx for why the status cannot be changed without a
    // per-request database round trip. What must hold is that it is not
    // indexable, so this asserts the robots directive rather than the status.
    const response = await page.goto('/definitely-not-a-real-page-xyz');
    expect(response?.status()).toBe(200);
    // page.title(), not a locator: <title> is not rendered content, so
    // toContainText resolves it to an empty string.
    expect(await page.title()).toMatch(/not found/i);
    const robots = await page.locator('meta[name="robots"]').first().getAttribute('content');
    expect(robots).toMatch(/noindex/);
  });
});
