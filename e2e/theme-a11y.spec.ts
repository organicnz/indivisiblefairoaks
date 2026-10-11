import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Dark-mode accessibility gate — the counterpart to `a11y.spec.ts`.
 *
 * The light-mode gate runs against whatever palette the browser chooses, which
 * is light. The theme conversion gave every page a dark half, and the dark
 * half is the half a diff cannot show: a surface that flipped without its ink
 * keeps its exact class list and changes nothing a reviewer can see. This gate
 * pins the dark palette with `colorScheme` and runs the same axe tags, so a
 * missing `dark:` variant fails CI instead of shipping an unreadable page to
 * every reader whose operating system asks for dark.
 *
 * The two sets are deliberately separate rather than one loop over two schemes:
 * each has its own failure list, so a regression names the palette it broke.
 * The exclusions match `a11y.spec.ts` — embedded YouTube players carry axe
 * findings neither palette controls.
 */

const PAGES: { path: string; name?: string }[] = [
  { path: '/' },
  { path: '/products' },
  { path: '/about' },
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

test('a11y: all public pages pass axe in the dark palette', async ({ page }) => {
  test.slow();
  // Fold the OS preference into the palette the same way the bootstrap script
  // does, so this exercises the attribute path a dark-mode reader actually
  // gets rather than only the media query.
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });

  const failures: { page: string; violations: string[] }[] = [];

  for (const { path, name } of PAGES) {
    await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    // The attribute is set before paint by the inline bootstrap script; a page
    // that never took the palette is the failure this gate exists for, and axe
    // would read it as a light page and pass.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]')
      .analyze();

    const serious = results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    );

    if (serious.length > 0) {
      failures.push({
        page: name ?? path,
        violations: serious.map(
          (v) =>
            `${v.id}: ${v.help} - targets: ${JSON.stringify(v.nodes?.map((n) => n.target) || [])}`
        ),
      });
    }
  }

  expect(
    failures,
    `serious a11y violations in the dark palette:\n${failures
      .map((f) => `  ${f.page}: ${f.violations.join(', ')}`)
      .join('\n')}`
  ).toEqual([]);
});
