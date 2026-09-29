import { describe, expect, it } from 'vitest';
import { isLegacySlug, LEGACY_REDIRECTS } from '@/config/legacy-redirects';
import { isActiveRoute, NOT_FOUND_ROUTES, ROUTES } from '@/config/routes';

describe('isActiveRoute', () => {
  it('matches an exact path', () => {
    expect(isActiveRoute('/about', { label: 'About', href: '/about' })).toBe(true);
    expect(isActiveRoute('/about-us', { label: 'About', href: '/about' })).toBe(false);
  });

  it('matches Home only on the root, not on every path', () => {
    // The trap: every path starts with "/", so a naive startsWith marks Home
    // active on the entire site.
    const home = ROUTES.find((route) => route.href === '/');
    if (!home) throw new Error('ROUTES must contain a Home entry');
    expect(isActiveRoute('/', home)).toBe(true);
    expect(isActiveRoute('/about', home)).toBe(false);
    expect(isActiveRoute('/products/yard-sign', home)).toBe(false);
  });

  it('does not treat a sibling with a shared prefix as active', () => {
    expect(isActiveRoute('/newslike', { label: 'News', href: '/news' })).toBe(false);
  });

  it('matches nested paths under a declared prefix', () => {
    const products = { label: 'Shop', href: '/products', matchPrefixes: ['/products'] };
    expect(isActiveRoute('/products', products)).toBe(true);
    expect(isActiveRoute('/products/yard-sign', products)).toBe(true);
  });

  it('does not match a path that merely starts with the prefix characters', () => {
    const account = { label: 'Account', href: '/account', matchPrefixes: ['/account'] };
    expect(isActiveRoute('/accounting', account)).toBe(false);
  });

  it('highlights nothing for a path outside the nav', () => {
    expect(ROUTES.some((route) => isActiveRoute('/admin/orders', route))).toBe(false);
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

  it('uses root-relative hrefs only', () => {
    for (const route of [...ROUTES, ...NOT_FOUND_ROUTES]) {
      expect(route.href.startsWith('/')).toBe(true);
      expect(route.href).not.toContain('://');
    }
  });

  it('gives every route a concise short label for the desktop row', () => {
    // The short labels are what make the nine-item row fit at 2xl. A route
    // without one silently falls back to its full label and re-introduces the
    // ~1700px row that overflowed the viewport.
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
    for (const privatePath of ['/cart', '/login', '/account', '/admin', '/wishlist']) {
      expect(hrefs).not.toContain(privatePath);
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
