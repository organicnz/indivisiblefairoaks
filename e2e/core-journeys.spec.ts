import { expect, test } from '@playwright/test';

/**
 * Core user-journey coverage: wishlist, gallery, static content, home shell.
 *
 * Complements the focused specs (cart-checkout, product-detail, search,
 * contact) so that taken together the suite touches every public surface:
 * every page either gets a functional test here or is covered by a11y /
 * link-integrity / header-clearance.
 */

const STATIC_PAGES = [
  '/events',
  '/news',
  '/voter-info',
  '/choir',
  '/about-us',
  '/faqs',
  '/partners',
  '/shipping-returns',
  '/privacy-policy',
  '/terms-and-conditions',
  '/donate',
  '/cart',
  '/wishlist',
  '/gallery',
  '/search?q=community',
];

test.describe('static + content pages resolve', () => {
  for (const path of STATIC_PAGES) {
    test(`GET ${path} → <400`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status(), `${path} must resolve`).toBeLessThan(400);
    });
  }

  test('robots.txt and sitemap.xml resolve', async ({ request }) => {
    expect((await request.get('/robots.txt')).status()).toBeLessThan(400);
    expect((await request.get('/sitemap.xml')).status()).toBeLessThan(400);
  });
});

test.describe('home shell', () => {
  test('header logo, primary nav and footer render', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByRole('banner');
    await expect(banner.locator('a[href="/"]').first()).toBeVisible();
    await expect(banner.getByRole('link', { name: 'Events & Actions' })).toBeVisible();
    await expect(page.getByText('Indivisible')).toBeVisible();
  });

  test('donate page loads with a heading', async ({ page }) => {
    await page.goto('/donate');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('wishlist journey', () => {
  test('empty wishlist shows empty state with Explore Gear link', async ({ page }) => {
    await page.goto('/wishlist');
    await expect(page.getByRole('heading', { name: /my wishlist/i })).toBeVisible({
      timeout: 10_000,
    });
    // Fresh context → persisted store is empty → empty-state copy renders.
    await expect(page.getByText(/your wishlist is empty/i)).toBeVisible({ timeout: 5_000 });

    const explore = page.getByRole('link', { name: /explore gear/i });
    await expect(explore).toBeVisible();
    await explore.click();
    await page.waitForURL('/products');
  });
});

test.describe('gallery journey', () => {
  test('gallery hero, search and filters render without crashing', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.getByRole('heading', { name: /democracy in full view/i })).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByPlaceholder(/search by quote/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /all/i }).first()).toBeVisible();
  });

  test('gallery search filters without crashing on nonsense', async ({ page }) => {
    await page.goto('/gallery');
    await page.getByPlaceholder(/search by quote/i).fill('zzzznothingherezzzz');
    // Either photos or the empty-filter message — both prove no crash.
    const empty = page.getByText(/no photos match/i);
    const photos = page.locator('a[href="/gallery"]');
    await expect(async () => {
      const emptyCount = await empty.count();
      const photoCount = await photos.count();
      expect(emptyCount + photoCount).toBeGreaterThan(0);
    }).toPass({ timeout: 10_000 });
  });
});
