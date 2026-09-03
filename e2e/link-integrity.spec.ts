import { expect, test } from '@playwright/test';

/**
 * Sitewide link-integrity crawler.
 *
 * Every internal <a href> discovered on key pages must resolve to a live
 * route (<400). Catches renamed/deleted product slugs and stale CMS links —
 * the "red button leads to a dead page" class of bug (#9) — across the whole
 * storefront, not just the page where it was reported.
 */

const CRAWL_SEEDS = [
  '/',
  '/products',
  '/about-us',
  '/faqs',
  '/partners',
  '/contact',
  '/shipping-returns',
];

const EXCLUDED_PREFIXES = ['/api/', '/_next', 'mailto:', 'tel:', '#'];

test('no dead internal links on storefront pages', async ({ request }) => {
  const checked = new Set<string>();
  const dead: { url: string; status: number; foundOn: string }[] = [];

  for (const seed of CRAWL_SEEDS) {
    const res = await request.get(seed);
    expect(res.status(), `seed page ${seed} must load`).toBeLessThan(400);
    const html = await res.text();

    const hrefs = [...html.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]);
    for (const raw of hrefs) {
      const href = raw.split('?')[0];
      if (EXCLUDED_PREFIXES.some((p) => href.startsWith(p))) continue;
      if (checked.has(href)) continue;
      // Skip Next.js asset/flight internals
      if (/\.(css|js|woff2?|png|jpe?g|svg|ico|xml|txt)$/.test(href)) continue;

      checked.add(href);
      const linkRes = await request.get(href, { maxRedirects: 5 });
      if (linkRes.status() >= 400) {
        dead.push({ url: href, status: linkRes.status(), foundOn: seed });
      }
    }
  }

  expect(dead, `dead internal links: ${JSON.stringify(dead, null, 2)}`).toEqual([]);
  // Guard against accidentally crawling nothing
  expect(checked.size).toBeGreaterThan(20);
});
