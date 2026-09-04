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
 */

const PAGES: { path: string; name?: string }[] = [
  { path: '/' },
  { path: '/products' },
  { path: '/about-us' },
  { path: '/faqs' },
  { path: '/partners' },
  { path: '/contact' },
  { path: '/shipping-returns' },
  { path: '/gallery' },
  { path: '/news', name: 'Newsletters' },
  { path: '/events', name: 'Events' },
  { path: '/voter-info', name: 'Voter Information' },
  { path: '/choir', name: 'Resistance Choir' },
];

for (const { path, name } of PAGES) {
  test(`a11y: ${name ?? path} has no serious axe violations`, async ({ page }) => {
    // Two determinism guards:
    //  - networkidle hangs on hosted runners (long-lived analytics sockets);
    //    load + a settle beat is enough for an axe scan.
    //  - Animations sampled mid-flight fake color-contrast violations (hero
    //    fades/moves); the app honours prefers-reduced-motion, so scans run
    //    against settled final-state rendering.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // YouTube's player DOM is third-party code served inside a cross-origin
      // iframe — its internal aria/button markup is Google's to fix, not ours.
      // Exclude the frame so the gate judges first-party markup only.
      .exclude('iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]')
      .analyze();

    const serious = results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    );

    // Always surface the full picture in the report, then gate on serious+.
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
      console.log(`\naxe findings on ${path}:\n${summary}${detail ? `\n${detail}` : ''}`);
    }

    expect(serious, `serious a11y violations on ${path}`).toEqual([]);
  });
}
