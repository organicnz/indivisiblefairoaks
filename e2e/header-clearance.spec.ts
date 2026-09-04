import { expect, test } from '@playwright/test';

/**
 * Fixed-header clearance guards.
 *
 * The header is position:fixed and ~112px tall on mobile / ~144px on md+
 * (logo h-16/h-24 + py-6). Pages must pad their first heading with
 * pt-(--header-h) so titles never render behind the navbar.
 *
 * Home and gallery are intentionally excluded: their heroes are designed to
 * sit under the transparent header.
 */

type Route = { path: string; heading: RegExp };

const guardedRoutes: Route[] = [
  { path: '/products', heading: /All Gear|Gear/ },
  { path: '/faqs', heading: /Frequently Asked Questions/i },
  { path: '/partners', heading: /Partner/i },
  { path: '/contact', heading: /Contact/i },
  { path: '/shipping-returns', heading: /Shipping/i },
  { path: '/privacy-policy', heading: /Privacy/i },
  { path: '/terms-and-conditions', heading: /Terms/i },
  { path: '/wishlist', heading: /Wishlist/i },
  { path: '/search?q=braid', heading: /Search Results/ },
];

async function expectHeadingClearOfHeader(page: import('@playwright/test').Page) {
  // Dynamic routes stream their body; measure only once the stream has settled
  // so we never capture a half-painted layout.
  // networkidle hangs on hosted runners (persistent sockets); load suffices.
  await page.waitForLoadState('load');

  const header = await page.locator('header').first().boundingBox();
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible();
  const h1Box = await h1.boundingBox();

  expect(header, 'header must render').toBeTruthy();
  expect(h1Box, 'page must have an h1').toBeTruthy();

  if (!header || !h1Box) return;

  // Allow 2px tolerance for sub-pixel rounding.
  expect(
    h1Box.y,
    `h1 at y=${h1Box.y} overlaps fixed header ending at y=${header.y + header.height}`
  ).toBeGreaterThanOrEqual(header.y + header.height - 2);
}

test.describe('desktop clearance (144px header)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const route of guardedRoutes) {
    test(`h1 clears navbar: ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator('h1').first()).toHaveText(new RegExp(route.heading.source, 'i'));
      await expectHeadingClearOfHeader(page);
    });
  }
});

test.describe('mobile clearance (112px header)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of [guardedRoutes[0], guardedRoutes[1], guardedRoutes[7]]) {
    test(`h1 clears navbar: ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator('h1').first()).toHaveText(new RegExp(route.heading.source, 'i'));
      await expectHeadingClearOfHeader(page);
    });
  }
});
