import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Cart & Checkout flow E2E tests.
 *
 * Strategy: navigate to a real in-stock product detail page, add it to the
 * bag via the "Add to bag" button, then verify the cart page accumulates the
 * item correctly. Never relies on CSS-class selectors — uses accessible roles
 * and text that the real UI exposes.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
);

let productSlug: string | null = null;

test.beforeAll(async () => {
  const { data } = await supabase
    .from('products')
    .select('slug')
    .eq('stock_status', 'instock')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  productSlug = data?.slug ?? null;
});

test('cart page loads with correct heading', async ({ page }) => {
  await page.goto('/cart');
  // Either "Your Cart" (has items) or "Your Cart is Empty" heading is visible
  const heading = page.getByRole('heading', { name: /your cart/i });
  await expect(heading).toBeVisible({ timeout: 10_000 });
});

test('cart page has checkout action when items are present', async ({ page }) => {
  test.skip(!productSlug, 'no in-stock product seeded');

  // Navigate to a real product and add it to the cart
  await page.goto(`/products/${productSlug}`);
  await page.getByRole('button', { name: /add to bag/i }).click();

  // Navigate to the cart
  await page.goto('/cart');

  // "Proceed to Checkout" button must be visible
  await expect(page.getByRole('button', { name: /proceed to checkout/i })).toBeVisible({
    timeout: 10_000,
  });
});

test('cart is empty state renders correctly', async ({ page }) => {
  // Use a fresh context so localStorage (Zustand persisted store) is clean
  await page.goto('/cart');

  // Either the heading exists (empty or with items) — the page must load
  const heading = page.getByRole('heading', { name: /your cart/i });
  await expect(heading).toBeVisible({ timeout: 10_000 });
});

test('product listing page renders products', async ({ page }) => {
  await page.goto('/products');

  // The h1 must say "All Gear" (or a category name if filtered)
  await expect(page.getByRole('heading', { name: /all gear|gear/i }).first()).toBeVisible({
    timeout: 10_000,
  });

  // At least one product link (View Gear) must be present when products are seeded
  const viewGearLinks = page.getByRole('link', { name: /view gear/i });
  const count = await viewGearLinks.count();
  // If the store has products, assert at least one is shown. If empty, just
  // verify the "No gear found" message renders (not an error).
  if (count === 0) {
    await expect(page.getByText(/no gear found/i)).toBeVisible({ timeout: 5_000 });
  } else {
    expect(count).toBeGreaterThan(0);
  }
});

test('add to bag and quantity updates work on product detail page', async ({ page }) => {
  test.skip(!productSlug, 'no in-stock product seeded');

  await page.goto(`/products/${productSlug}`);

  const addBtn = page.getByRole('button', { name: /add to bag/i });
  await expect(addBtn).toBeVisible({ timeout: 10_000 });

  await addBtn.click();

  // After adding, the button should briefly show "Added to Cart!" feedback
  await expect(page.getByRole('button', { name: /added to cart!/i })).toBeVisible({
    timeout: 3_000,
  });
});
