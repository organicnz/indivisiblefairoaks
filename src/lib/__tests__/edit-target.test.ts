import { describe, expect, it, vi } from 'vitest';
import { resolveEditContext } from '@/lib/edit-context';
import { cmsSlugForPath, editUrlForContentId } from '@/lib/edit-target';

describe('cmsSlugForPath', () => {
  it('accepts a plain CMS slug', () => {
    expect(cmsSlugForPath('/choir-retreat')).toBe('choir-retreat');
  });

  it('rejects everything that cannot be CMS content', () => {
    // Home, nested routes, and infrastructure prefixes are never content,
    // however the table reads.
    for (const path of [
      '/',
      '',
      null,
      undefined,
      'about',
      '/products/yard-sign',
      '/admin/content',
      '/api/crm/unsubscribe',
      '/auth/mfa',
      '/login',
      '/account',
      '/_next/static/chunk.js',
    ]) {
      expect(cmsSlugForPath(path), path ?? '(empty)').toBeNull();
    }
  });

  it('rejects traversal, encoded separators, and file-ish segments', () => {
    // Eligibility runs before any query, so hostile input must die here —
    // the route never sees it.
    for (const path of [
      '/..',
      '/../admin',
      '/%2e%2e/admin',
      '/a%2Fb',
      '/slug%3Fquery',
      '/page Vasil',
      '/UPPER CASE',
      '/favicon.ico',
      '/robots.txt',
      '/a'.concat('a'.repeat(300)),
    ]) {
      expect(cmsSlugForPath(path), path).toBeNull();
    }
  });

  it('ignores query strings and fragments on an otherwise valid slug', () => {
    // `usePathname` never sends these, but the API takes raw input.
    expect(cmsSlugForPath('/choir-retreat?utm=x')).toBe('choir-retreat');
    expect(cmsSlugForPath('/choir-retreat#news')).toBe('choir-retreat');
  });
});

describe('editUrlForContentId', () => {
  it('points at the content editor', () => {
    expect(editUrlForContentId(42)).toBe('/admin/content/42');
  });
});

describe('resolveEditContext', () => {
  const row = { id: 7, title: 'Choir Retreat', status: 'publish' };

  it('tells a non-admin nothing and touches no database', async () => {
    const findContentBySlug = vi.fn();
    const res = await resolveEditContext('/choir-retreat', {
      isAdmin: async () => false,
      findContentBySlug,
    });

    expect(res).toEqual({ isAdmin: false, target: null });
    expect(findContentBySlug).not.toHaveBeenCalled();
  });

  it('resolves an admin on a CMS page to the editor URL', async () => {
    const res = await resolveEditContext('/choir-retreat', {
      isAdmin: async () => true,
      findContentBySlug: async (slug) => (slug === 'choir-retreat' ? row : null),
    });

    expect(res).toEqual({
      isAdmin: true,
      target: {
        kind: 'cms',
        editUrl: '/admin/content/7',
        label: 'Choir Retreat',
        status: 'publish',
      },
    });
  });

  it('returns no target when no row matches the slug', async () => {
    const findContentBySlug = vi.fn(async () => null);
    const res = await resolveEditContext('/nothing-here', {
      isAdmin: async () => true,
      findContentBySlug,
    });

    expect(res).toEqual({ isAdmin: true, target: null });
    expect(findContentBySlug).toHaveBeenCalledWith('nothing-here');
  });

  it('skips the lookup for reserved and nested paths', async () => {
    const findContentBySlug = vi.fn();
    for (const path of ['/admin/crm', '/products/sign', '/']) {
      const res = await resolveEditContext(path, {
        isAdmin: async () => true,
        findContentBySlug,
      });
      expect(res).toEqual({ isAdmin: true, target: null });
    }
    expect(findContentBySlug).not.toHaveBeenCalled();
  });
});
