import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Product detail page E2E tests.
 *
 * Seeds a real product slug from the DB so tests run against actual data
 * rather than hard-coded paths. All selectors use ARIA roles and visible text
 * — no CSS class selectors.
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

test('product detail page loads and shows product name', async ({ page }) => {
  test.skip(!productSlug, 'no in-stock product seeded');

  await page.goto(`/products/${productSlug}`);

  // h1 must contain the product name
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
  if (productName) {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(productName, {
      ignoreCase: true,
      timeout: 10_000,
    });
  }
});

test('product detail page shows price and add-to-bag button', async ({ page }) => {
  test.skip(!productSlug, 'no in-stock product seeded');

  await page.goto(`/products/${productSlug}`);

  // Price label visible
  await expect(page.getByText(/^\$\d+\.\d{2}$/).first()).toBeVisible({ timeout: 10_000 });

  // Add to bag button enabled (in-stock product)
  const addBtn = page.getByRole('button', { name: /add to bag/i });
  await expect(addBtn).toBeVisible({ timeout: 10_000 });
  await expect(addBtn).toBeEnabled();
});

test('product detail page shows a product image', async ({ page }) => {
  test.skip(!productSlug, 'no in-stock product seeded');

  await page.goto(`/products/${productSlug}`);

  // At least one <img> element must be visible (product photo or slider)
  await expect(page.getByRole('img').first()).toBeVisible({ timeout: 10_000 });
});

test('unknown product slug returns 404 page', async ({ page }) => {
  await page.goto('/products/this-slug-does-not-exist-xyz123');
  // Cache Components streams a 200 shell before the not-found boundary resolves.
  // Assert the user-visible 404 state rather than relying on the early shell status.
  await expect(page.getByRole('heading', { name: '404 - Page Not Found' })).toBeVisible();
});

test('products listing links navigate to detail pages', async ({ page }) => {
  await page.goto('/products');

  const viewGearLinks = page.getByRole('link', { name: /view gear/i });
  const count = await viewGearLinks.count();
  test.skip(count === 0, 'no products seeded');

  // Click the first product card link and confirm we land on a detail page
  await viewGearLinks.first().click();
  await page.waitForLoadState('load');

  // Detail pages always have an h1
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });

  // And the add-to-bag CTA (or out-of-stock notice)
  const addBtn = page.getByRole('button', { name: /add to bag|out of stock/i });
  await expect(addBtn).toBeVisible({ timeout: 10_000 });
});
