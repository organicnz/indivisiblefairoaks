import { expect, test } from '@playwright/test';

const LOCATION_STAMP = 'Fair Oaks · Carmichael, CA';

test.describe('header content', () => {
  test('keeps the ICE Alert link in its own landmark without the hero location stamp', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    // The banner is the real client-rendered header; the Suspense fallback is a
    // plain aria-hidden div, so this also waits for hydration before checking
    // the absence of the old label.
    const banner = page.getByRole('banner');
    const alertNavigation = banner.getByRole('navigation', {
      name: 'ICE alerts',
      exact: true,
    });
    const iceAlert = alertNavigation.getByRole('link', {
      name: 'ICE Alert',
      exact: true,
    });

    await expect(alertNavigation).toBeVisible();
    await expect(iceAlert).toBeVisible();
    await expect(iceAlert).toHaveAttribute('href', '/ice-alerts');
    await expect(
      banner
        .getByRole('navigation', { name: 'Primary', exact: true })
        .getByRole('link', { name: 'ICE Alert', exact: true })
    ).toHaveCount(0);
    await expect(banner).not.toContainText(LOCATION_STAMP);

    // The homepage stamp is separate from the header and must remain visible.
    const heroStamp = page
      .locator('#main-content')
      .locator('[data-data-point="home.hero.location_stamp"]');
    await expect(heroStamp).toHaveText(LOCATION_STAMP);
    await expect(heroStamp).toBeVisible();

    // The alert landmark must keep exposing the active-page semantics on its
    // own route, not just exist on the homepage.
    await page.goto('/ice-alerts');
    await expect(iceAlert).toHaveAttribute('aria-current', 'page');
  });
});
