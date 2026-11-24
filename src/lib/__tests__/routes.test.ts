// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isLegacySlug, LEGACY_REDIRECTS } from '@/config/legacy-redirects';
import { getHeaderNavigation, isActiveRoute, NOT_FOUND_ROUTES, ROUTES } from '@/config/routes';

describe('isActiveRoute', () => {
  it('matches an exact path', () => {
    expect(isActiveRoute('/about', { label: 'About', href: '/about' })).toBe(true);
    expect(isActiveRoute('/about-us', { label: 'About', href: '/about' })).toBe(false);
  });

  it('matches the Main link only on the root, not on every path', () => {
    // Main is the first primary-row item, directly before About. The trap is
    // that every path starts with "/", so a naive startsWith would mark Main
    // current on the entire site.
    const main = ROUTES[0];
    expect(main).toMatchObject({ label: 'Main', href: '/' });
    expect(isActiveRoute('/', main)).toBe(true);
    expect(isActiveRoute('/about', main)).toBe(false);
    expect(isActiveRoute('/events/rally', main)).toBe(false);
  });

  it('places Main directly before About', () => {
    expect(ROUTES[0]?.href).toBe('/');
    expect(ROUTES[1]?.href).toBe('/about');
  });

  it('does not treat a sibling with a shared prefix as active', () => {
    expect(isActiveRoute('/newslike', { label: 'News', href: '/news' })).toBe(false);
  });

  it('matches nested paths under a declared prefix', () => {
    const events = { label: 'Events', href: '/events', matchPrefixes: ['/events'] };
    expect(isActiveRoute('/events', events)).toBe(true);
    expect(isActiveRoute('/events/rally', events)).toBe(true);
  });

  it('does not match a path that merely starts with the prefix characters', () => {
    const account = { label: 'Account', href: '/account', matchPrefixes: ['/account'] };
    expect(isActiveRoute('/accounting', account)).toBe(false);
  });

  it('highlights nothing for a path outside the nav', () => {
    expect(ROUTES.some((route) => isActiveRoute('/admin/crm/imports', route))).toBe(false);
  });
});

describe('ROUTES', () => {
  it('has no duplicate hrefs', () => {
    const hrefs = ROUTES.map((route) => route.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('has no duplicate labels', () => {
    const labels = ROUTES.map((route) => route.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('names the /links child as Link Tree', () => {
    const linksChild = ROUTES.flatMap((route) => route.children ?? []).find(
      (child) => child.href === '/links'
    );
    expect(linksChild?.label).toBe('Link Tree');
  });

  it('uses root-relative hrefs only', () => {
    for (const route of [...ROUTES, ...NOT_FOUND_ROUTES]) {
      expect(route.href.startsWith('/')).toBe(true);
      expect(route.href).not.toContain('://');
    }
  });

  it('gives every route a concise short label for the desktop row', () => {
    // The short labels are what make the primary nav row fit as the header
    // tightens. A route without one silently falls back to its full label and
    // re-introduces the wide row that overflowed the viewport.
    for (const route of ROUTES) {
      expect(route.short, `${route.href} is missing a short label`).toBeTruthy();
    }
  });

  it('keeps short labels meaningfully shorter than the full label', () => {
    for (const route of ROUTES) {
      if (!route.short) continue;
      // A short label that is not actually shorter is just duplication.
      if (route.label === route.short) continue;
      expect(route.short.length, `${route.href}`).toBeLessThan(route.label.length);
    }
  });

  it('keeps the short label a prefix or abbreviation of the full label', () => {
    // Guards against a short label that points somewhere conceptually different
    // from the page it links to (e.g. 'Links' for a page called 'Coalition').
    for (const route of ROUTES) {
      if (!route.short || route.label === route.short) continue;
      const full = route.label.toLowerCase();
      const short = route.short.toLowerCase();
      const shares = full.includes(short) || short.includes(full) || full.includes(short[0]);
      expect(shares, `"${route.short}" does not relate to "${route.label}"`).toBe(true);
    }
  });

  it('excludes private surfaces from primary navigation', () => {
    const hrefs = ROUTES.map((route) => route.href);
    for (const privatePath of ['/login', '/account', '/admin']) {
      expect(hrefs).not.toContain(privatePath);
    }
  });
});

describe('getHeaderNavigation', () => {
  it('returns the single alert route and excludes it from the primary row', () => {
    const { alertRoute, primaryRoutes } = getHeaderNavigation();
    expect(alertRoute).toMatchObject({
      label: 'ICE Alert',
      short: 'ICE Alert',
      href: '/ice-alerts',
    });
    expect(primaryRoutes.map((route) => route.href)).not.toContain('/ice-alerts');
  });

  it('fails loudly if the alert route is missing', () => {
    expect(() => getHeaderNavigation([{ label: 'About', href: '/about' }])).toThrow(
      /Expected exactly one route with placement "alert", found 0\./
    );
  });

  it('fails loudly if more than one alert route is declared', () => {
    expect(() =>
      getHeaderNavigation([
        { label: 'About', href: '/about' },
        { label: 'ICE Alert', href: '/ice-alerts', placement: 'alert' },
        { label: 'Other alert', href: '/other-alert', placement: 'alert' },
      ])
    ).toThrow(/Expected exactly one route with placement "alert", found 2\./);
  });
});

describe('ROUTES children (dropdown)', () => {
  it('keeps the parent active on its own page when it has children', () => {
    const voterInfo = ROUTES.find((route) => route.href === '/voter-info');
    if (!voterInfo) throw new Error('ROUTES must contain a Voter Info entry');
    expect(voterInfo.children?.length).toBeGreaterThan(0);
    // Anchors share the page pathname, so the parent stays highlighted.
    expect(isActiveRoute('/voter-info', voterInfo)).toBe(true);
  });

  it('keeps the voter action links on the overview, not in the dropdown', () => {
    const voterInfo = ROUTES.find((route) => route.href === '/voter-info');
    if (!voterInfo) throw new Error('ROUTES must contain a Voter Info entry');

    expect(voterInfo.children?.map((child) => child.href)).toEqual([
      '/voter-info',
      '/voter-info#representatives',
      '/voter-info#guides',
      '/voter-info#hotlines',
    ]);

    const dropdownHrefs = voterInfo.children?.map((child) => child.href) ?? [];
    for (const href of [
      'https://registertovote.ca.gov',
      'https://wheresmyballot.sos.ca.gov',
      'https://elections.saccounty.gov',
    ]) {
      expect(dropdownHrefs).not.toContain(href);
    }
  });

  it('keeps News active on the dedicated newsletters page', () => {
    const news = ROUTES.find((route) => route.href === '/news');
    if (!news) throw new Error('ROUTES must contain a News entry');
    expect(news.children?.map((child) => child.href)).toContain('/newsletters');
    expect(isActiveRoute('/newsletters', news)).toBe(true);
  });

  it('leads with the overview page so existing links keep working', () => {
    for (const route of ROUTES) {
      if (!route.children) continue;
      expect(route.children[0]?.href).toBe(route.href);
      expect(route.children[0]?.external).not.toBe(true);
    }
  });

  it('gives every dropdown entry a unique label', () => {
    for (const route of ROUTES) {
      if (!route.children) continue;
      const labels = route.children.map((child) => child.label);
      expect(new Set(labels).size, `${route.href} children`).toBe(labels.length);
    }
  });

  it('keeps internal children root-relative and marks externals explicitly', () => {
    for (const route of ROUTES) {
      for (const child of route.children ?? []) {
        if (child.external) {
          expect(child.href.startsWith('https://'), child.label).toBe(true);
        } else {
          expect(child.href.startsWith('/'), child.label).toBe(true);
          expect(child.href).not.toContain('://');
        }
      }
    }
  });

  it('points page anchors at the parent page', () => {
    for (const route of ROUTES) {
      for (const child of route.children ?? []) {
        if (child.external || !child.href.includes('#')) continue;
        expect(child.href.startsWith(`${route.href}#`), child.label).toBe(true);
      }
    }
  });
});

describe('LEGACY_REDIRECTS', () => {
  it('only issues permanent redirects', () => {
    for (const redirect of LEGACY_REDIRECTS) {
      expect(redirect.permanent).toBe(true);
    }
  });

  it('never redirects a path to itself', () => {
    for (const redirect of LEGACY_REDIRECTS) {
      expect(redirect.destination).not.toBe(redirect.source);
    }
  });

  it('points only at real, root-relative destinations', () => {
    for (const redirect of LEGACY_REDIRECTS) {
      expect(redirect.destination.startsWith('/')).toBe(true);
    }
  });

  it('has no duplicate sources', () => {
    const sources = LEGACY_REDIRECTS.map((redirect) => redirect.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('never redirects onto a path that is itself redirected', () => {
    const sources = new Set(LEGACY_REDIRECTS.map((r) => r.source));
    for (const redirect of LEGACY_REDIRECTS) {
      expect(sources.has(redirect.destination)).toBe(false);
    }
  });

  it('exposes bare slugs for CMS enumeration', () => {
    expect(isLegacySlug('resistance-choir')).toBe(true);
    expect(isLegacySlug('about-us')).toBe(true);
    expect(isLegacySlug('choir')).toBe(false);
  });

  it('does not shadow a live primary-navigation route', () => {
    const navHrefs = new Set(ROUTES.map((route) => route.href));
    for (const redirect of LEGACY_REDIRECTS) {
      expect(navHrefs.has(redirect.source)).toBe(false);
    }
  });
});
