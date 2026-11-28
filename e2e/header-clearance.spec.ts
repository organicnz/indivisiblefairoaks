import { expect, test } from '@playwright/test';
import { gotoRoute } from './helpers/navigation';

/**
 * Fixed-header clearance guards.
 *
 * The header is position:fixed and its own height changes with the scroll
 * state and viewport. Pages must clear the measured box through
 * PageWrapper's `pt-(--header-clearance)`, not through a hard-coded offset.
 *
 * PERF: Consolidated to 1 desktop + 1 mobile test. Each loops through its
 * routes in the same browser context, saving ~20-30s of context-creation
 * overhead on the swap-constrained host.
 */

type Route = { path: string; heading: RegExp };

const guardedRoutes: Route[] = [
  { path: '/events', heading: /Events/i },
  { path: '/faqs', heading: /Frequently Asked Questions/i },
  { path: '/partners', heading: /Partner/i },
  { path: '/contact', heading: /Contact/i },
  { path: '/privacy-policy', heading: /Privacy/i },
  { path: '/terms-and-conditions', heading: /Terms/i },
  { path: '/search?q=action', heading: /Search Results/ },
];

async function expectHeadingClearOfHeader(page: import('@playwright/test').Page) {
  const banner = page.getByRole('banner');
  await expect(banner).toBeVisible();
  // The clearance contract only means something while the banner is fixed.
  await expect(banner).toHaveCSS('position', 'fixed');
  await expect.poll(() => banner.boundingBox(), { timeout: 10_000 }).not.toBeNull();
  const header = await banner.boundingBox();

  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible();
  await expect.poll(() => h1.boundingBox(), { timeout: 10_000 }).not.toBeNull();
  const h1Box = await h1.boundingBox();

  expect(header, 'header must render').toBeTruthy();
  expect(h1Box, 'page must have an h1').toBeTruthy();

  if (!header || !h1Box) return;

  expect(
    h1Box.y,
    `h1 at y=${h1Box.y} overlaps fixed header ending at y=${header.y + header.height}`
  ).toBeGreaterThanOrEqual(header.y + header.height - 2);
}

test.describe('header clearance', () => {
  test('desktop: h1 clears the fixed navbar on all guarded routes', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 800 });

    const failures: string[] = [];
    for (const route of guardedRoutes) {
      await gotoRoute(page, route.path);
      await expect(page.locator('h1').first()).toHaveText(new RegExp(route.heading.source, 'i'), {
        timeout: 15_000,
      });
      try {
        await expectHeadingClearOfHeader(page);
      } catch (e) {
        failures.push(`${route.path}: ${(e as Error).message}`);
      }
    }
    expect(failures, `desktop clearance failures:\n${failures.join('\n')}`).toEqual([]);
  });

  test('mobile: h1 clears the fixed navbar on sampled routes', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 390, height: 844 });

    const mobileRoutes = [guardedRoutes[0], guardedRoutes[1], guardedRoutes[6]];
    const failures: string[] = [];
    for (const route of mobileRoutes) {
      await gotoRoute(page, route.path);
      await expect(page.locator('h1').first()).toHaveText(new RegExp(route.heading.source, 'i'), {
        timeout: 15_000,
      });
      try {
        await expectHeadingClearOfHeader(page);
      } catch (e) {
        failures.push(`${route.path}: ${(e as Error).message}`);
      }
    }
    expect(failures, `mobile clearance failures:\n${failures.join('\n')}`).toEqual([]);
  });
});
