import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers/navigation';

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
    await gotoHydrated(page, '/');

    const signIn = page.getByRole('link', { name: 'Sign In' });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute('href', '/login');

    await signIn.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('mobile drawer offers Sign In linking to /login', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoHydrated(page, '/');

    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const account = page.getByRole('link', { name: 'Sign in to your account' });
    await expect(account).toBeVisible();
    await expect(account).toHaveAttribute('href', '/login');
  });

  test('tablet viewport (1024) shows the inline account entry, not a drawer', async ({ page }) => {
    // The nav row starts at md and the drawer is md:hidden, so 1024 gets the
    // two-tier desktop header. This test used to expect a drawer here, from
    // when the row only appeared at xl — and that assumption is exactly what
    // let the account entry go missing between 768 and 1279.
    await page.setViewportSize({ width: 1024, height: 800 });
    await gotoHydrated(page, '/');

    const signIn = page.getByRole('link', { name: 'Sign in to your account' });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute('href', '/login');
    await expect(page.locator('nav[aria-label="Primary"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeHidden();

    const overflow = await page.evaluate(() => {
      const row = document.querySelector('header > div > div');
      if (!row) return 'no-row';
      return (row as HTMLElement).scrollWidth <= (row as HTMLElement).clientWidth + 1
        ? 'fits'
        : `overflow ${(row as HTMLElement).scrollWidth - (row as HTMLElement).clientWidth}px`;
    });
    expect(overflow).toBe('fits');
  });
});
