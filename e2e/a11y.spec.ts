import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Automated accessibility regression gate (WCAG 2.1 A/AA via axe-core).
 *
 * Runs against the production build served by the shared Playwright web
 * server. Covers the public surfaces customers actually traverse; auth-gated
 * routes (/account, /admin) are excluded — they require seeded credentials
 * and are exercised manually.
 *
 * Serious/critical violations fail CI. Moderate/minor findings are reported
 * but tolerated so the gate stays actionable instead of noisy.
 *
 * PERF: All pages are scanned in a single test case that loops through them
 * in the same browser context. On a swap-constrained host, each new browser
 * context adds 2-3s of overhead; looping inside one saves ~25-35s.
 */

const PAGES: { path: string; name?: string }[] = [
  { path: '/' },
  { path: '/about' },
  { path: '/events' },
  { path: '/voter-info', name: 'Voter Information' },
  { path: '/choir', name: 'Resistance Choir' },
  { path: '/news', name: 'Newsletters' },
  { path: '/contact' },
  { path: '/gallery' },
  { path: '/links', name: 'Coalition Links' },
  { path: '/archive', name: 'Chapter Archive' },
  { path: '/donate' },
  { path: '/faqs' },
  { path: '/partners' },
  { path: '/privacy-policy', name: 'Privacy' },
  { path: '/terms-and-conditions', name: 'Terms' },
  { path: '/search?q=democracy', name: 'Search' },
  { path: '/login', name: 'Login' },
  { path: '/ice-alerts', name: 'ICE alerts demo' },
  { path: '/this-page-does-not-exist', name: '404' },
];

const THEMES = ['light', 'dark'] as const;

test('a11y: all public pages pass axe WCAG 2.1 A/AA in both themes', async ({ page }) => {
  test.slow();
  const failures: { page: string; theme: string; violations: string[] }[] = [];

  for (const theme of THEMES) {
    for (const { path, name } of PAGES) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(path, { waitUntil: 'load' });
      await page.waitForTimeout(250);

      // The theme provider reacts to the emulated system scheme. Assert the
      // rendered surface actually switched before measuring contrast.
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]')
        .analyze();

      const serious = results.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? '')
      );

      const summary = results.violations
        .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`)
        .join('\n');
      if (summary) {
        const detail = results.violations
          .filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
          .map((v) =>
            v.nodes
              .map((n) => `  ${v.id} → ${n.target.join(' ')} :: ${n.html.slice(0, 140)}`)
              .join('\n')
          )
          .join('\n');
        console.log(`\naxe findings on ${path} (${theme}):\n${summary}${detail ? `\n${detail}` : ''}`);
      }

      if (serious.length > 0) {
        failures.push({
          page: name ?? path,
          theme,
          violations: serious.map((v) => `${v.id}: ${v.help}`),
        });
      }
    }
  }

  expect(
    failures,
    `serious a11y violations:\n${failures
      .map((f) => `  ${f.page} (${f.theme}): ${f.violations.join(', ')}`)
      .join('\n')}`
  ).toEqual([]);
});
