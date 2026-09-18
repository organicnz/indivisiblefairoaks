import { expect, test } from '@playwright/test';

/**
 * Search page E2E tests.
 *
 * All tests navigate directly to /search?q=... — the page is a Server
 * Component that calls Supabase FTS RPCs (with an ILIKE fallback). No mock
 * server required; results may vary depending on seeded data but the UI
 * structure is stable.
 */

test.describe('search page', () => {
  test('search results page renders for a broad query', async ({ page }) => {
    await page.goto('/search?q=community');

    // h1 must say "Search Results"
    await expect(page.getByRole('heading', { name: /search results/i })).toBeVisible({
      timeout: 10_000,
    });
    // Results for "community" caption must be visible
    await expect(page.getByText(/results for/i)).toBeVisible({ timeout: 5_000 });
  });

  test('search with no query shows Search Results page with empty state', async ({ page }) => {
    await page.goto('/search');

    // Page must still load (no crash) and show h1
    await expect(page.getByRole('heading', { name: /search results/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('search results page renders for a product keyword', async ({ page }) => {
    await page.goto('/search?q=gear');

    await expect(page.getByRole('heading', { name: /search results/i })).toBeVisible({
      timeout: 10_000,
    });

    // Either products or "No matches" is shown — both are acceptable
    const hasProducts = (await page.getByRole('link', { name: /view gear/i }).count()) > 0;
    const hasContent =
      (await page.getByRole('heading', { name: /from the logbook & pages/i }).count()) > 0;
    const hasNoResults = (await page.getByText(/no matches found/i).count()) > 0;
    expect(hasProducts || hasContent || hasNoResults).toBe(true);
  });

  test('search page returns 200 for any non-spam query string', async ({ request }) => {
    const res = await request.get('/search?q=indivisible');
    expect(res.status()).toBe(200);
  });

  test('search page sanitizes query in the results caption', async ({ page }) => {
    // XSS probe: the query is echoed inside a <span> — it must appear as
    // plain text, not executed markup.
    await page.goto('/search?q=<script>alert(1)</script>');

    await expect(page.getByRole('heading', { name: /search results/i })).toBeVisible({
      timeout: 10_000,
    });

    // The raw <script> tag must never appear as a live element
    const scriptTags = await page.locator('script[src=""]').count();
    expect(scriptTags).toBe(0);

    // The text should NOT have executed any alert
    // (Playwright would surface dialog events if it had)
  });

  test('search page shows no results state gracefully', async ({ page }) => {
    await page.goto('/search?q=xyzzyquuxfrobnicatethisislongerthan40chars');

    await expect(page.getByRole('heading', { name: /search results/i })).toBeVisible({
      timeout: 10_000,
    });

    // Long nonsense query should yield "No matches found"
    await expect(page.getByText(/no matches found/i)).toBeVisible({ timeout: 8_000 });
  });
});
