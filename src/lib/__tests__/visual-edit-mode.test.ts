import { describe, expect, it, vi } from 'vitest';
import { sanitizeWPContent } from '@/lib/sanitize';
import {
  collectPageSections,
  highlightPageSection,
  readVisualEditMode,
  VISUAL_EDIT_PARAM,
  VISUAL_EDIT_STORAGE_KEY,
  visualEditModeFromSearchParams,
  visualEditModeHref,
  writeVisualEditMode,
} from '@/lib/visual-edit-mode';

/** A storage stub that records what was written, and can be made to throw. */
function fakeStorage(overrides: Partial<Storage> = {}) {
  const values = new Map<string, string>();
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    ...overrides,
  };
}

describe('readVisualEditMode', () => {
  it('reads an enabled preference', () => {
    const storage = fakeStorage();
    storage.values.set(VISUAL_EDIT_STORAGE_KEY, '1');
    expect(readVisualEditMode(storage)).toBe(true);
  });

  it('reads every other stored value as off', () => {
    for (const value of ['0', 'true', '', 'yes']) {
      const storage = fakeStorage();
      storage.values.set(VISUAL_EDIT_STORAGE_KEY, value);
      expect(readVisualEditMode(storage), value).toBe(false);
    }
  });

  it('reads a missing preference as off', () => {
    expect(readVisualEditMode(fakeStorage())).toBe(false);
  });

  it('reads a storage that throws as off rather than propagating', () => {
    // Safari private browsing throws on getItem. The mode is a preference, not
    // a reason for a public page to fail to render.
    const storage = fakeStorage({
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
    });
    expect(readVisualEditMode(storage)).toBe(false);
  });

  it('reads no storage at all as off', () => {
    expect(readVisualEditMode(null)).toBe(false);
    expect(readVisualEditMode(undefined)).toBe(false);
  });
});

describe('writeVisualEditMode', () => {
  it('stores the enabled flag', () => {
    const storage = fakeStorage();
    writeVisualEditMode(storage, true);
    expect(storage.values.get(VISUAL_EDIT_STORAGE_KEY)).toBe('1');
  });

  it('removes the key when disabling', () => {
    const storage = fakeStorage();
    storage.values.set(VISUAL_EDIT_STORAGE_KEY, '1');
    writeVisualEditMode(storage, false);
    expect(storage.values.has(VISUAL_EDIT_STORAGE_KEY)).toBe(false);
    expect(storage.removeItem).toHaveBeenCalled();
  });

  it('swallows a storage that throws', () => {
    const storage = fakeStorage({
      setItem: vi.fn(() => {
        throw new Error('QuotaExceeded');
      }),
    });
    expect(() => writeVisualEditMode(storage, true)).not.toThrow();
  });
});

describe('visualEditModeFromSearchParams', () => {
  it('returns null when the URL says nothing', () => {
    // Null, not false: "no opinion" and "explicitly off" are different
    // instructions, and collapsing them makes a shared ?visual-edit=0 link
    // indistinguishable from one that never mentioned it.
    expect(visualEditModeFromSearchParams('')).toBeNull();
    expect(visualEditModeFromSearchParams('?other=1')).toBeNull();
    expect(visualEditModeFromSearchParams(null)).toBeNull();
    expect(visualEditModeFromSearchParams(undefined)).toBeNull();
  });

  it('accepts the on spellings', () => {
    for (const value of ['1', 'true', 'on', 'TRUE', 'On', '']) {
      expect(visualEditModeFromSearchParams(`?${VISUAL_EDIT_PARAM}=${value}`), value).toBe(true);
    }
  });

  it('accepts the off spellings', () => {
    for (const value of ['0', 'false', 'off', 'OFF']) {
      expect(visualEditModeFromSearchParams(`?${VISUAL_EDIT_PARAM}=${value}`), value).toBe(false);
    }
  });

  it('ignores an unrecognised value', () => {
    expect(visualEditModeFromSearchParams(`?${VISUAL_EDIT_PARAM}=maybe`)).toBeNull();
  });

  it('accepts a parsed URLSearchParams', () => {
    const params = new URLSearchParams();
    params.set(VISUAL_EDIT_PARAM, '1');
    expect(visualEditModeFromSearchParams(params)).toBe(true);
  });
});

describe('visualEditModeHref', () => {
  it('enables the mode on a bare path', () => {
    expect(visualEditModeHref('/choir-retreat', true)).toBe('/choir-retreat?visual-edit=1');
  });

  it('clears the mode without leaving an empty query', () => {
    // A trailing `?` is a different URL to a router and to a crawler, and it
    // would accumulate one per toggle.
    expect(visualEditModeHref('/choir-retreat?visual-edit=1', false)).toBe('/choir-retreat');
  });

  it('preserves every other parameter', () => {
    // An admin mid-filter must not lose the filter by toggling a mode.
    expect(visualEditModeHref('/products?category=signs&sort=price', true)).toBe(
      '/products?category=signs&sort=price&visual-edit=1'
    );
  });

  it('round-trips through the reader', () => {
    const on = visualEditModeHref('/page', true);
    expect(visualEditModeFromSearchParams(on.split('?')[1])).toBe(true);
    const off = visualEditModeHref(on, false);
    expect(visualEditModeFromSearchParams(off.split('?')[1] ?? '')).toBeNull();
  });
});

describe('collectPageSections', () => {
  function body(html: string): HTMLDivElement {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
  }

  it('collects each top-level child that has a heading', () => {
    const root = body(`
      <div><h2>Why we canvass</h2><p>Body copy.</p></div>
      <div><h2>How to help</h2><p>More copy.</p></div>
    `);
    expect(collectPageSections(root)).toEqual([
      { index: 0, label: 'Why we canvass' },
      { index: 1, label: 'How to help' },
    ]);
  });

  it('skips children with no heading', () => {
    // A section an admin cannot name is not a section: listing it as
    // "Section 3" would be a control that scrolls somewhere meaningless.
    const root = body(`
      <div><h2>Real section</h2></div>
      <p>An orphan paragraph.</p>
      <div><img src="/a.png" alt="" /></div>
      <div><h2>Another section</h2></div>
    `);
    const sections = collectPageSections(root);
    expect(sections.map((s) => s.label)).toEqual(['Real section', 'Another section']);
  });

  it('keeps the index aligned with the live DOM children', () => {
    // The index is what the overlay scrolls to. If skipping a headingless child
    // also renumbered the rest, every jump after it would land on the wrong node.
    const root = body(`
      <p>Orphan.</p>
      <div><h2>First</h2></div>
      <p>Orphan.</p>
      <div><h2>Second</h2></div>
    `);
    const sections = collectPageSections(root);
    expect(sections).toEqual([
      { index: 1, label: 'First' },
      { index: 3, label: 'Second' },
    ]);
    expect(root.children[1].textContent).toContain('First');
    expect(root.children[3].textContent).toContain('Second');
  });

  it('accepts an element that is itself a heading', () => {
    const root = body(`<h2>Standalone heading</h2>`);
    expect(collectPageSections(root)).toEqual([{ index: 0, label: 'Standalone heading' }]);
  });

  it('accepts an element that is an h3 or h4 standalone heading', () => {
    const root = body(`<h3>Sub-heading Section</h3><h4>Minor Section</h4>`);
    expect(collectPageSections(root)).toEqual([
      { index: 0, label: 'Sub-heading Section' },
      { index: 1, label: 'Minor Section' },
    ]);
  });

  it('accepts an element with aria-label as section label', () => {
    const root = body(`<section aria-label="Supporters Directory"><p>List of allies</p></section>`);
    expect(collectPageSections(root)).toEqual([{ index: 0, label: 'Supporters Directory' }]);
  });

  it('collapses whitespace in the label', () => {
    const root = body(`<div><h2>  Multi
        spaced     heading  </h2></div>`);
    expect(collectPageSections(root)).toEqual([{ index: 0, label: 'Multi spaced heading' }]);
  });

  it('truncates a runaway label', () => {
    const root = body(`<div><h2>${'x'.repeat(400)}</h2></div>`);
    const [section] = collectPageSections(root);
    expect(section.label.length).toBeLessThanOrEqual(80);
  });

  it('returns nothing for a container that is not a living DOM', () => {
    // The overlay reads this as "nothing to edit here" and hides itself.
    expect(collectPageSections(null)).toEqual([]);
    expect(collectPageSections(undefined)).toEqual([]);
    expect(collectPageSections(document.createDocumentFragment())).toEqual([]);
  });

  it('reads a real page rendered by the sanitizer', () => {
    // The shape that matters is the one the public page produces: a single
    // sanitized HTML blob with interleaved headings, images and links. The
    // blob goes through `sanitizeWPContent` for real — the section indices are
    // positions among the container's element children, so an image that the
    // sanitizer keeps occupies a slot and shifts the headings after it.
    const root = body(
      sanitizeWPContent(`
      <p>Intro paragraph with <a href="/about">a link</a>.</p>
      <h2>Our position</h2>
      <p>Paragraph.</p>
      <img src="https://example.supabase.co/storage/v1/object/public/media/a.png" alt="" width="800" height="600" />
      <h2>Take action</h2>
      <p>Sign the petition.</p>
    `)
    );
    expect(collectPageSections(root)).toEqual([
      { index: 1, label: 'Our position' },
      { index: 4, label: 'Take action' },
    ]);
  });
});

describe('highlightPageSection', () => {
  it('smoothly scrolls and animates element with accent pulse', () => {
    const el = document.createElement('section');
    el.scrollIntoView = vi.fn();
    el.animate = vi.fn();

    highlightPageSection(el, { durationMs: 1200 });

    expect(el.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
    expect(el.animate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ boxShadow: expect.any(String) })]),
      expect.objectContaining({ duration: 1200, easing: 'ease-out' })
    );
  });

  it('handles null and undefined without throwing', () => {
    expect(() => highlightPageSection(null)).not.toThrow();
    expect(() => highlightPageSection(undefined)).not.toThrow();
  });
});
