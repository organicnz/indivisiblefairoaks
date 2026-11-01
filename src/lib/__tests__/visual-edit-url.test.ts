// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { syncRegionParamInUrl, withRegionParam } from '@/lib/visual-edit-url';

/**
 * The region is a lens over one document, not a navigation.
 *
 * These helpers were added because switching regions in the sidebar changed
 * React state and nothing else: the address bar kept the old id (or none), so a
 * refresh returned the admin to the whole page. The pure half is tested
 * directly; the DOM half is tested through `history`, where the difference
 * between replace and push is observable.
 */
describe('withRegionParam', () => {
  it('adds the region and keeps every other parameter', () => {
    expect(withRegionParam('?visual-edit=1&utm=rally', 'home-hero')).toBe(
      '?visual-edit=1&utm=rally&region=home-hero'
    );
  });

  it('replaces an existing region rather than duplicating it', () => {
    expect(withRegionParam('?visual-edit=1&region=home-hero', 'home-pillars')).toBe(
      '?visual-edit=1&region=home-pillars'
    );
  });

  it('removes the parameter for the whole page', () => {
    expect(withRegionParam('?visual-edit=1&region=home-hero', null)).toBe('?visual-edit=1');
  });

  it('returns an empty query when there is nothing left', () => {
    expect(withRegionParam('?region=home-hero', null)).toBe('');
  });

  it('does not write an empty region, which the overlay would read as an id', () => {
    expect(withRegionParam('', null)).toBe('');
    expect(withRegionParam('', '')).toBe('');
  });
});

describe('syncRegionParamInUrl', () => {
  const href = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('writes the region into the address bar', () => {
    window.history.replaceState({}, '', '/about?visual-edit=1#mission');
    syncRegionParamInUrl('about-mission');

    expect(window.location.pathname).toBe('/about');
    expect(new URLSearchParams(window.location.search).get('region')).toBe('about-mission');
    expect(window.location.hash).toBe('#mission');
  });

  it('removes the region without disturbing the path or hash', () => {
    window.history.replaceState({}, '', '/about?region=about-mission&visual-edit=1#mission');
    syncRegionParamInUrl(null);

    expect(href()).toBe('/about?visual-edit=1#mission');
  });

  it('replaces the current history entry instead of growing the back stack', () => {
    window.history.replaceState({ marker: 1 }, '', '/about');
    const length = window.history.length;

    syncRegionParamInUrl('about-mission');

    // A push would make Back navigate through editor state instead of leaving.
    expect(window.history.length).toBe(length);
    expect(window.history.state).toEqual({ marker: 1 });
  });

  it('is a no-op when the address already says this', () => {
    window.history.replaceState({ marker: 2 }, '', '/about?region=about-mission');
    syncRegionParamInUrl('about-mission');
    expect(window.history.state).toEqual({ marker: 2 });
  });
});
