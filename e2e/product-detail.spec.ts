import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Product detail page E2E tests.
 *
 * Seeds a real product slug from the DB so tests run against actual data.
 *
 * PERF: Consolidated the 3 same-slug tests (name, price+button, image) into
 * 1 test with 1 navigation. The 404 and listing-nav tests remain separate
 * because they navigate to different URLs. Saves ~6-10s.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
);

let productSlug: string | null = null;
let productName: string | null = null;

test.beforeAll(async () => {
  const { data } = await supabase
    .from('products')
    .select('slug, name')
    .eq('stock_status', 'instock')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  productSlug = data?.slug ?? null;
  productName = data?.name ?? null;
});

test('product detail page renders name, price, image, and add-to-bag', async ({ page }) => {
  test.skip(!productSlug, 'no in-stock product seeded');

  await page.goto(`/products/${productSlug}`);

  // h1 with product name
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
  if (productName) {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(productName, {
      ignoreCase: true,
      timeout: 10_000,
    });
  }

  // Price label visible
  await expect(page.getByText(/^\$\d+\.\d{2}$/).first()).toBeVisible({ timeout: 10_000 });

  // Add to bag button enabled (in-stock product)
  const addBtn = page.getByRole('button', { name: /add to bag/i });
  await expect(addBtn).toBeVisible({ timeout: 10_000 });
  await expect(addBtn).toBeEnabled();

  // At least one image visible
  await expect(page.getByRole('img').first()).toBeVisible({ timeout: 10_000 });
});

test('unknown product slug returns 404 page', async ({ page }) => {
  await page.goto('/products/this-slug-does-not-exist-xyz123');
  await expect(page.getByRole('heading', { name: /this page isn't here/i })).toBeVisible();
  await expect(page.getByText('Error 404')).toBeVisible();
});

test('products listing links navigate to detail pages', async ({ page }) => {
  await page.goto('/products');

  const productLinks = page.locator('a[href^="/products/"]');
  const count = await productLinks.count();
  test.skip(count === 0, 'no products seeded');

  await productLinks.first().click();
  await page.waitForLoadState('load');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
  const addBtn = page.getByRole('button', { name: /add to (?:bag|cart)|out of stock/i });
  await expect(addBtn).toBeVisible({ timeout: 10_000 });
});
