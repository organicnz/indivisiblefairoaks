import { expect, test } from '@playwright/test';

/**
 * Navbar account entry point.
 *
 * The right side of the header must always offer an account path:
 * signed-out visitors see Sign In (→ /login); signed-in users see a
 * profile icon (→ /account). These run sessionless, so they assert the
 * signed-out state — the profile-icon state is covered by the login flow
 * (Supabase session required).
 */

test.describe('navbar account entry', () => {
  test('desktop header shows Sign In linking to /login when signed out', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const signIn = page.getByRole('link', { name: 'Sign In' });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute('href', '/login');

    await signIn.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('mobile drawer offers My Account / Sign In', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('load');

    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const account = page.getByRole('link', { name: 'My Account / Sign In' });
    await expect(account).toBeVisible();
    await expect(account).toHaveAttribute('href', '/account');
  });
});
