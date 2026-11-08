import { expect, test } from '@playwright/test';

/**
 * Core user-journey coverage: wishlist, gallery, static content, home shell.
 *
 * PERF: Static page resolution tests use API requests (no browser context).
 * The `for...of` loop shares one API context. Gallery and wishlist journeys
 * that need a browser keep their own contexts.
 */

const STATIC_PAGES = [
  '/events',
  '/news',
  '/voter-info',
  '/choir',
  '/about-us',
  '/faqs',
  '/partners',
  '/privacy-policy',
  '/terms-and-conditions',
  '/donate',
  '/gallery',
  '/search?q=community',
];

test.describe('static + content pages resolve', () => {
  test('all static pages return <400', async ({ request }) => {
    const failures: { path: string; status: number }[] = [];
    for (const path of STATIC_PAGES) {
      const res = await request.get(path);
      if (res.status() >= 400) {
        failures.push({ path, status: res.status() });
      }
    }
    expect(failures, `dead pages: ${JSON.stringify(failures)}`).toEqual([]);
  });

  test('robots.txt and sitemap.xml resolve', async ({ request }) => {
    expect((await request.get('/robots.txt')).status()).toBeLessThan(400);
    expect((await request.get('/sitemap.xml')).status()).toBeLessThan(400);
  });
});

test.describe('home shell', () => {
  test('header logo, primary nav and footer render', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/');
    const banner = page.getByRole('banner');
    await expect(banner.locator('a[href="/"]').first()).toBeVisible();
    await expect(banner.getByRole('link', { name: 'Events', exact: true })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('drawer carries the full nav labels on narrow viewports', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Navigation menu' });
    await expect(drawer.getByRole('link', { name: 'Events & Actions' })).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Resistance Choir' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
  });

  test('donate page loads with a heading', async ({ page }) => {
    await page.goto('/donate');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
  });
});


test.describe('events search control', () => {
  // The collapsed trigger carries `size-9`, but the input wrapper beside it
  // carried BOTH `relative` and a conditional `absolute`. Tailwind emits
  // `.relative` after `.absolute`, so the wrapper won the cascade, stayed in
  // flow at `w-full`, and flex-shrank the 36px trigger to 18px: the magnifier
  // rendered as a half-width sliver at every viewport. A square control is the
  // invariant; the width assertion is what catches a re-squeeze.
  test('collapsed search trigger is square, not a squeezed sliver', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/events');

    const trigger = page.getByRole('button', { name: 'Search events' });
    await expect(trigger).toBeVisible();

    const box = await trigger.boundingBox();
    if (!box) throw new Error('The events search trigger rendered without a box.');

    expect(Math.abs(box.width - box.height)).toBeLessThan(1);
    expect(box.width).toBeGreaterThanOrEqual(35);
  });
});

test.describe('gallery journey', () => {
  test('gallery hero, search, filters, and lightbox all work', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.getByRole('heading', { name: /democracy in full view/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByPlaceholder(/search by quote/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /all/i }).first()).toBeVisible();

    // Search filters without crashing on nonsense
    await page.getByPlaceholder(/search by quote/i).fill('zzzznothingherezzzz');
    const empty = page.getByText(/no photos match/i);
    const photos = page.locator('[data-gallery-photo]');
    await expect(async () => {
      const emptyCount = await empty.count();
      const photoCount = await photos.count();
      expect(emptyCount + photoCount).toBeGreaterThan(0);
    }).toPass({ timeout: 10_000 });

    // Clear search and open lightbox
    await page.getByPlaceholder(/search by quote/i).fill('');
    await expect.poll(() => photos.count(), { timeout: 10_000 }).toBeGreaterThan(0);
    await photos.first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close image viewer' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('a failed gallery photo shows the accessible fallback', async ({ page }) => {
    await page.route('**/_next/image**', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'text/plain',
        body: 'image unavailable',
      });
    });

    await page.goto('/gallery');
    const photos = page.locator('[data-gallery-photo]');
    await expect.poll(() => photos.count(), { timeout: 10_000 }).toBeGreaterThan(0);

    const firstPhoto = photos.first();
    await expect(firstPhoto.getByTestId('gallery-image-fallback')).toBeVisible({
      timeout: 10_000,
    });
    await expect(firstPhoto.locator('img')).toHaveCount(0);
  });
});
