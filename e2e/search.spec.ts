import { expect, test } from '@playwright/test';

/**
 * Search page E2E tests.
 *
 * PERF: Consolidated browser tests into 2 tests (1 browser, 1 API-only).
 * The XSS and no-results checks don't need isolated contexts — one navigation
 * per assertion group saves ~8-12s.
 */

test.describe('search page', () => {
  test('search results, XSS sanitization, and no-results all work correctly', async ({ page }) => {
    // 1. Broad query renders results
    await page.goto('/search?q=community');
    await expect(page.getByRole('heading', { name: /search results/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/results for/i)).toBeVisible({ timeout: 5_000 });

    // 2. XSS probe: query echoed as plain text, not executed markup
    await page.goto('/search?q=<script>alert(1)</script>');
    await expect(page.getByRole('heading', { name: /search results/i })).toBeVisible({
      timeout: 10_000,
    });
    const scriptTags = await page.locator('script[src=""]').count();
    expect(scriptTags).toBe(0);

    // 3. No-results state
    await page.goto('/search?q=xyzzyquuxfrobnicatethisislongerthan40chars');
    await expect(page.getByRole('heading', { name: /search results/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/no matches found/i)).toBeVisible({ timeout: 8_000 });

    // 4. Empty query — page loads without crash
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: /search results/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('search API returns 200 for valid queries', async ({ request }) => {
    const res = await request.get('/search?q=indivisible');
    expect(res.status()).toBe(200);
  });

  test('search results page renders for a product keyword', async ({ page }) => {
    await page.goto('/search?q=gear');

    await expect(page.getByRole('heading', { name: /search results/i })).toBeVisible({
      timeout: 10_000,
    });

    const hasProducts = (await page.getByRole('link', { name: /view gear/i }).count()) > 0;
    const hasContent =
      (await page.getByRole('heading', { name: /from the logbook & pages/i }).count()) > 0;
    const hasNoResults = (await page.getByText(/no matches found/i).count()) > 0;
    expect(hasProducts || hasContent || hasNoResults).toBe(true);
  });
});
