import { expect, test } from '@playwright/test';

/**
 * Editability coverage gate.
 *
 * Every public editorial route must expose at least one of the two admin edit
 * surfaces in its rendered HTML:
 *
 *  - `data-copy-region` for a coded page slice backed by a `copy-*` CMS row
 *  - `data-data-point` for an inline CMS-backed field
 *
 * The check runs signed out on purpose. Both attributes are part of the public
 * render, so this is a coverage assertion rather than an admin-permission test;
 * the editor's own authenticated tests prove the write paths. Private,
 * token-gated pages (the reunification status lookup) and non-editorial utility
 * routes (login, 404) are deliberately excluded.
 *
 * When a new public page is added without an edit surface, this fails and names
 * the route. That is the regression this gate exists to catch: "everything is
 * editable" is a coverage property, not a one-time audit.
 */

const EDITORIAL_ROUTES = [
  { path: '/', name: 'Home' },
  { path: '/about', name: 'About' },
  { path: '/events', name: 'Events' },
  { path: '/voter-info', name: 'Voter information' },
  { path: '/choir', name: 'Choir' },
  { path: '/news', name: 'News' },
  { path: '/newsletters', name: 'Newsletters' },
  { path: '/contact', name: 'Contact' },
  { path: '/gallery', name: 'Gallery' },
  { path: '/links', name: 'Link Tree' },
  { path: '/archive', name: 'Archive' },
  { path: '/donate', name: 'Donate' },
  { path: '/faqs', name: 'FAQ' },
  { path: '/partners', name: 'Partners' },
  { path: '/privacy-policy', name: 'Privacy' },
  { path: '/terms-and-conditions', name: 'Terms' },
  { path: '/search', name: 'Search' },
  { path: '/ice-alerts', name: 'ICE rapid-response map' },
  { path: '/ice-alerts/data', name: 'ICE open data' },
  { path: '/ice-alerts/report', name: 'ICE private report' },
  { path: '/ice-alerts/reunification', name: 'ICE reunification request' },
  { path: '/ice-alerts/web-reports', name: 'ICE web reports' },
] as const;

test.describe('public editorial editability coverage', () => {
  for (const route of EDITORIAL_ROUTES) {
    test(`${route.name} exposes an admin edit surface`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'load' });

      const surfaces = page.locator('[data-copy-region], [data-data-point]');
      await expect(
        surfaces.first(),
        `${route.path} renders no data-copy-region or data-data-point surface`
      ).toBeAttached();

      const regionIds = await page.locator('[data-copy-region]').evaluateAll((nodes) =>
        nodes
          .map((node) => node.getAttribute('data-copy-region')?.trim() ?? '')
          .filter(Boolean)
      );

      expect(new Set(regionIds).size, `${route.path} has duplicate copy-region ids`).toBe(
        regionIds.length
      );

      const emptySurfaces = await surfaces.evaluateAll((nodes) =>
        nodes
          .filter((node) => !(node.textContent ?? '').trim())
          .map((node) =>
            node.getAttribute('data-copy-region') ?? node.getAttribute('data-data-point') ?? ''
          )
      );
      expect(emptySurfaces, `${route.path} renders empty edit surfaces`).toEqual([]);
    });
  }
});
