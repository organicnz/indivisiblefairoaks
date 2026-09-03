import { instant } from '@next/playwright';
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Instant-navigation guards for the Cache Components + Partial Prefetching
 * adoption. Each assertion locks in what must be visible the moment a
 * navigation lands — before any streamed data arrives.
 *
 * Shell contract (every route): header logo, primary nav, footer tagline.
 * Route data (product info, article prose) is explicitly NOT instant; it
 * streams behind Suspense by design and must never be asserted here.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

let productPath = '/products';

test.beforeAll(async () => {
  const [product] = await Promise.all([
    supabase.from('products').select('slug').eq('stock_status', 'instock').limit(1).single(),
  ]);
  if (product.data?.slug) productPath = `/products/${product.data.slug}`;
});

const shellAssertions = async (page: import('@playwright/test').Page) => {
  const banner = page.getByRole('banner');
  await expect(banner.locator('img[alt="CATCH-22"]')).toBeVisible();
  await expect(banner.getByRole('link', { name: 'Shop' })).toBeVisible();
  await expect(page.getByText('Never Out of a Catch')).toBeVisible();
};

test('shell paints instantly: home → faqs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header img[alt="CATCH-22"]')).toBeVisible();

  await instant(
    page,
    async () => {
      const navigation = page.waitForURL('/faqs');
      await page.getByRole('link', { name: 'FAQs' }).first().click();
      await navigation;
      await shellAssertions(page);
    },
    { baseURL: 'http://localhost:3100' }
  );
});

test('shell paints instantly: home → products listing (deliberate block route)', async ({
  page,
}) => {
  await page.goto('/');
  await instant(
    page,
    async () => {
      const navigation = page.waitForURL('/products');
      await page.getByRole('link', { name: 'Shop' }).first().click();
      await navigation;
      // Block route streams its body, but the shared shell must still be immediate.
      await shellAssertions(page);
    },
    { baseURL: 'http://localhost:3100' }
  );
});

test('shell paints instantly: listing → product detail', async ({ page }) => {
  test.skip(productPath === '/products', 'no instock products seeded');
  await page.goto('/products');
  await instant(
    page,
    async () => {
      const navigation = page.waitForURL(productPath);
      await page.locator(`a[href="${productPath}"]`).first().click();
      await navigation;
      await shellAssertions(page);
    },
    { baseURL: 'http://localhost:3100' }
  );
});
