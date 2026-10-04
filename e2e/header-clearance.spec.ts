import { expect, test } from '@playwright/test';

/**
 * Fixed-header clearance guards.
 *
 * The header is position:fixed and measures 77px unscrolled / 69px scrolled
 * (measured 2026-10-04 at 390 and 1280 wide — the older 112/144px figures
 * describe a header this is not). Pages clear it through PageWrapper's
 * `pt-(--header-clearance)`: 88px below 48rem, 104px at and above, plus the
 * iOS safe-area inset. The clearance deliberately over-estimates the 77px
 * header by 11–27px — margin, not exact fit — so a taller scrolled state or a
 * notched device still clears.
 *
 * What this guards is the geometry, not the constants: every assertion below
 * measures the real banner and the real h1. Rename the figures here when a
 * measurement changes them; do not tune the CSS to match the comment.
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

  // Site chrome is the landmark <header> (banner). Prefer the role over a bare
  // `header` tag so we never pick WALL-E's panel header, and wait until it is
  // actually laid out — boundingBox() is null during Suspense/stream races even
  // when the a11y tree already lists the banner.
  const banner = page.getByRole('banner');
  await expect(banner).toBeVisible();
  await expect.poll(() => banner.boundingBox(), { timeout: 10_000 }).not.toBeNull();
  const header = await banner.boundingBox();

  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible();
  await expect.poll(() => h1.boundingBox(), { timeout: 10_000 }).not.toBeNull();
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

test.describe('desktop clearance (104px clearance vs 77px header)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const route of guardedRoutes) {
    test(`h1 clears navbar: ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      // Products page streams h1 behind PPR — allow up to 15s for DB-backed routes.
      await expect(page.locator('h1').first()).toHaveText(new RegExp(route.heading.source, 'i'), {
        timeout: 15_000,
      });
      await expectHeadingClearOfHeader(page);
    });
  }
});

test.describe('mobile clearance (88px clearance vs 77px header)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of [guardedRoutes[0], guardedRoutes[1], guardedRoutes[7]]) {
    test(`h1 clears navbar: ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator('h1').first()).toHaveText(new RegExp(route.heading.source, 'i'), {
        timeout: 15_000,
      });
      await expectHeadingClearOfHeader(page);
    });
  }
});
