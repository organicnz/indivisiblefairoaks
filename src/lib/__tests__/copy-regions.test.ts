// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  COPY_REGION_SLUG_PREFIX,
  copyRegionComposeHref,
  copyRegionIdForSlug,
  copyRegionLocationForSlug,
  copyRegionSlug,
  describeCopyRegionSlugConflict,
  getPageCopyRegions,
  isCopyRegionSlug,
  PAGE_COPY_REGIONS,
  pageHasCopyRegions,
} from '@/lib/copy-regions';

describe('copy region slugs', () => {
  it('round-trips an id through the slug space', () => {
    expect(copyRegionSlug('home-hero')).toBe('copy-home-hero');
    expect(copyRegionIdForSlug('copy-home-hero')).toBe('home-hero');
  });

  it('does not treat an arbitrary slug as a region', () => {
    expect(isCopyRegionSlug('about')).toBe(false);
    expect(isCopyRegionSlug('copy')).toBe(false);
    // A slug that merely *contains* the prefix is not owned by it.
    expect(isCopyRegionSlug('my-copy-thing')).toBe(false);
    expect(copyRegionIdForSlug('copy-')).toBeNull();
  });

  it('refuses a hand-authored region slug, naming the region', () => {
    expect(describeCopyRegionSlugConflict('copy-home-hero')).toContain('home-hero');
    expect(describeCopyRegionSlugConflict('about')).toBeNull();
  });
});

describe('resolving a region row back to its page', () => {
  it('finds the host page and region from the stored slug', () => {
    expect(copyRegionLocationForSlug('copy-home-hero')).toEqual({
      path: '/',
      region: { id: 'home-hero', label: 'Hero & Headline' },
    });
    expect(copyRegionLocationForSlug('copy-about-mission')?.path).toBe('/about');
  });

  it('returns null for a normal slug or an unregistered region', () => {
    expect(copyRegionLocationForSlug('about')).toBeNull();
    expect(copyRegionLocationForSlug('copy-nope')).toBeNull();
  });

  it('addresses the host page with the region selected', () => {
    // `/copy-home-hero` is not a route. The editor's address is the page the
    // region renders into, plus the query that says which slice to open.
    expect(copyRegionComposeHref('copy-home-hero')).toBe('/?visual-edit=1&region=home-hero');
    expect(copyRegionComposeHref('copy-about-mission')).toBe(
      '/about?visual-edit=1&region=about-mission'
    );
    expect(copyRegionComposeHref('copy-nope')).toBeNull();
  });

  it('never addresses a region row at its own path', () => {
    for (const [path, regions] of Object.entries(PAGE_COPY_REGIONS)) {
      for (const region of regions) {
        const href = copyRegionComposeHref(copyRegionSlug(region.id));
        expect(href, region.id).toBe(`${path}?visual-edit=1&region=${region.id}`);
        expect(href?.startsWith('/copy-'), region.id).toBe(false);
      }
    }
  });
});

describe('page copy region registry', () => {
  it('returns regions only for registered paths', () => {
    expect(getPageCopyRegions('/').map((r) => r.id)).toEqual([
      'home-hero',
      'home-pillars',
      'home-voter-hub',
    ]);
    expect(getPageCopyRegions('/wishlist')).toEqual([]);
    expect(pageHasCopyRegions('/wishlist')).toBe(false);
  });

  it('never registers a region id that collides with another region', () => {
    // Two regions with the same id on one page would both render into the same
    // `content` row and fight over it.
    for (const [path, regions] of Object.entries(PAGE_COPY_REGIONS)) {
      const ids = regions.map((region) => region.id);
      expect(new Set(ids).size, `${path} duplicate region id`).toBe(ids.length);
    }
  });

  it('never registers the same region id on two different pages', () => {
    const seen = new Map<string, string>();
    for (const [path, regions] of Object.entries(PAGE_COPY_REGIONS)) {
      for (const region of regions) {
        expect(seen.has(region.id), `${region.id} on ${path} and ${seen.get(region.id)}`).toBe(
          false
        );
        seen.set(region.id, path);
      }
    }
  });

  it('gives every region a non-empty label', () => {
    for (const regions of Object.values(PAGE_COPY_REGIONS)) {
      for (const region of regions) {
        expect(region.label.trim().length, region.id).toBeGreaterThan(0);
      }
    }
  });

  it('leaves /faqs unregistered so its JSON-LD cannot drift from its copy', () => {
    // The FAQ answers are rendered into FAQPage JSON-LD from the same array the
    // page renders. A copy region replacing the visible text would leave the
    // structured data emitting the old answers — a documented schema.org
    // manual-action risk — so the path has no region at all. The rationale
    // lives on the registry itself; there is no second list to read.
    expect(getPageCopyRegions('/faqs')).toEqual([]);
  });

  it('keeps the reserved prefix out of every region id', () => {
    // A second `copy-` inside an id would double the prefix on write and the
    // filter on read would no longer recognise its own slug.
    for (const regions of Object.values(PAGE_COPY_REGIONS)) {
      for (const region of regions) {
        expect(region.id.startsWith(COPY_REGION_SLUG_PREFIX), region.id).toBe(false);
        expect(copyRegionSlug(region.id)).toBe(`${COPY_REGION_SLUG_PREFIX}${region.id}`);
      }
    }
  });
});
