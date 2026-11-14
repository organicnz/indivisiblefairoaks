import { expect, test } from '@playwright/test';

/**
 * Public-page structure and reflow gate.
 *
 * The design pass is only real if every public route keeps the same reading
 * contract: one h1, no skipped heading levels, one main landmark, and no
 * horizontal overflow from 320px to a laptop. This runs the same browser page
 * for each route and only changes the viewport after the initial load, so the
 * four widths add reflow checks rather than four full navigations apiece.
 */

const ROUTES = [
  { path: '/', name: 'Home' },
  { path: '/about', name: 'About' },
  { path: '/events', name: 'Events' },
  { path: '/voter-info', name: 'Voter information' },
  { path: '/choir', name: 'Choir' },
  { path: '/news', name: 'News' },
  { path: '/contact', name: 'Contact' },
  { path: '/gallery', name: 'Gallery' },
  { path: '/links', name: 'Coalition links' },
  { path: '/archive', name: 'Archive' },
  { path: '/donate', name: 'Donate' },
  { path: '/faqs', name: 'FAQ' },
  { path: '/partners', name: 'Partners' },
  { path: '/privacy-policy', name: 'Privacy' },
  { path: '/terms-and-conditions', name: 'Terms' },
  { path: '/search?q=democracy', name: 'Search' },
  { path: '/login', name: 'Login' },
  { path: '/ice-alerts', name: 'ICE alerts demo' },
  { path: '/this-page-does-not-exist', name: '404' },
] as const;

const WIDTHS = [320, 390, 768, 1280] as const;

test('public routes keep one h1, ordered headings, one main, and no overflow', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  const failures: { route: string; reason: string }[] = [];

  for (const route of ROUTES) {
    await page.goto(route.path, { waitUntil: 'load' });
    // The login form is a client component under Suspense; its heading can
    // arrive a beat after the document load event. Wait for it, then run the
    // outline check — a missing h1 still fails below.
    await page
      .locator('h1')
      .first()
      .waitFor({ state: 'visible', timeout: 2000 })
      .catch(() => {});
    await page.waitForTimeout(100);

    const structure = await page.evaluate(() => {
      const headings = [...document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')]
        .filter((heading) => heading.getClientRects().length > 0)
        .map((heading) => ({
          level: Number(heading.tagName.slice(1)),
          text: (heading.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 90),
        }));

      const skips: string[] = [];
      let previous = 0;
      for (const heading of headings) {
        if (previous > 0 && heading.level > previous + 1) {
          skips.push(`h${previous} → h${heading.level}: ${heading.text}`);
        }
        previous = heading.level;
      }

      return {
        h1Count: headings.filter((heading) => heading.level === 1).length,
        firstHeading: headings[0] ?? null,
        skips,
        mainCount: document.querySelectorAll('main').length,
        headings,
      };
    });

    if (structure.h1Count !== 1) {
      failures.push({
        route: route.name,
        reason: `expected exactly one visible h1, found ${structure.h1Count}`,
      });
    }
    if (!structure.firstHeading || structure.firstHeading.level !== 1) {
      failures.push({
        route: route.name,
        reason: `first visible heading is ${structure.firstHeading ? `h${structure.firstHeading.level}` : 'missing'}`,
      });
    }
    if (structure.skips.length > 0) {
      failures.push({
        route: route.name,
        reason: `skipped heading level(s): ${structure.skips.join('; ')}`,
      });
    }
    if (structure.mainCount !== 1) {
      failures.push({
        route: route.name,
        reason: `expected one main landmark, found ${structure.mainCount}`,
      });
    }

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(120);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (overflow.scrollWidth > overflow.clientWidth + 1) {
        failures.push({
          route: route.name,
          reason: `${width}px: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`,
        });
      }
    }
  }

  expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
});
