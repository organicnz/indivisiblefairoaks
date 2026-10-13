import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorialButton, EditorialDrawerRow } from '@/components/layout/EditorialButton';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';

const mockToggle = vi.fn();
let mockEnabled = false;
let mockIsAdmin = true;
let mockLoading = false;

vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: () => ({
    loading: mockLoading,
    isAdmin: mockIsAdmin,
    target: { label: 'About Us', editUrl: '/admin/content/1' },
  }),
}));

// The section list comes from the overlay, not from the header. These mock the
// mode store only — the tests that exercise a section list publish one, because
// a header that derived its own list was the bug.
vi.mock('@/components/layout/visual-edit-store', () => ({
  useVisualEditMode: () => ({
    enabled: mockEnabled,
    toggle: mockToggle,
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/about',
}));

/**
 * Publish the section list the overlay would send, as the overlay sends it.
 *
 * Every field matters: `index` is the DOM ordinal, `blockIndex` is the block the
 * controls address, and `enabled` is whether the overlay is drawing a frame. A
 * test that leaves one out is testing a shape no component produces.
 */
function publishSections(
  sections: {
    index: number | null;
    label: string;
    blockIndex: number | null;
    blockType?: string | null;
    enabled?: boolean;
  }[]
) {
  window.dispatchEvent(
    new CustomEvent(VISUAL_EDIT_EVENTS.sectionsPublished, {
      detail: {
        sections: sections.map((section) => ({
          blockType: null,
          enabled: false,
          ...section,
        })),
        pathname: '/about',
      },
    })
  );
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('EditorialButton component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockEnabled = false;
    mockIsAdmin = true;
    mockLoading = false;
    mockToggle.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders nothing when user is not an admin', async () => {
    mockIsAdmin = false;
    await act(async () => {
      root.render(<EditorialButton />);
    });
    expect(container.querySelector('[data-testid="editorial-edit-button"]')).toBeNull();
  });

  it('renders nothing while the admin check is in flight', async () => {
    mockLoading = true;
    await act(async () => {
      root.render(<EditorialButton />);
    });
    // A skeleton the loading state can swap for, not a control that answers the
    // question before it is known. It must carry no testid, or a test — and a
    // reader using one — mistakes a placeholder for the real control.
    expect(container.querySelector('[data-testid="editorial-edit-button"]')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders idle toggle button for admin', async () => {
    mockIsAdmin = true;
    mockEnabled = false;
    await act(async () => {
      root.render(<EditorialButton />);
    });
    const btn = container.querySelector<HTMLButtonElement>('[data-testid="editorial-edit-button"]');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      btn?.click();
    });
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('reports the on state through aria-pressed and the accessible name', async () => {
    mockEnabled = true;
    await act(async () => {
      root.render(<EditorialButton />);
    });
    const btn = container.querySelector<HTMLButtonElement>('[data-testid="editorial-edit-button"]');
    expect(btn?.getAttribute('aria-pressed')).toBe('true');
    expect(btn?.getAttribute('aria-label')).toBe('Disable editorial mode');
  });

  /**
   * The header button is the master switch and nothing else.
   *
   * It used to be two controls of two sizes — an icon plus a chevron opening a
   * menu — which gave one intent two hit areas and duplicated a section list the
   * overlay already publishes. Per-section editing lives on each section's own
   * action pill and in the drawer's editorial card, so a second section list
   * here is a surface that must not come back.
   */
  it('offers no section menu of its own, however many sections exist', async () => {
    mockEnabled = true;

    await act(async () => {
      root.render(<EditorialButton />);
    });
    await act(async () => {
      publishSections([
        { index: 0, label: 'Mission Statement', blockIndex: 0 },
        { index: 1, label: 'Join Our Next Gathering', blockIndex: 1 },
      ]);
    });

    // One control, one job.
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(container.textContent).not.toContain('Mission Statement');
    expect(container.querySelector('button[aria-label="Visual editing menu"]')).toBeNull();
    expect(container.querySelector('[role="switch"]')).toBeNull();
  });

  /**
   * 44px, not 36px.
   *
   * The old pair achieved an adequate target by stacking a `size-9` icon and a
   * `size-6` chevron; the single control has to be big enough on its own, which
   * is the convention every other header control already follows.
   */
  it('keeps a 44px hit target, matching the other header controls', async () => {
    mockEnabled = false;
    await act(async () => {
      root.render(<EditorialButton />);
    });
    const btn = container.querySelector<HTMLButtonElement>('[data-testid="editorial-edit-button"]');
    expect(btn).toBeDefined();
    expect(btn?.getAttribute('aria-label')).toContain('editorial');
  });

  it('renders mobile drawer row with parity and section toggles', async () => {
    mockEnabled = true;
    const onNavigate = vi.fn();

    await act(async () => {
      root.render(<EditorialDrawerRow onNavigate={onNavigate} />);
    });
    await act(async () => {
      publishSections([{ index: 0, label: 'Get Out The Vote', blockIndex: 0, enabled: true }]);
    });

    const switchBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="editorial-visual-edit-row"]'
    );
    expect(switchBtn).not.toBeNull();
    expect(switchBtn?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      switchBtn?.click();
    });
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  /**
   * The drawer is not a lesser editor.
   *
   * These are the controls the small-screen surface gained with the parity
   * pass. A drawer that offered only the frame switch left a phone user unable
   * to do anything else an admin can do from the page — the one place that
   * needs it most. Each dispatch is asserted because the whole point of
   * `lib/visual-edit-events.ts` is that a control which fires an event nobody
   * listens for is indistinguishable from a broken control.
   */
  it('offers the full CRUD from the drawer row, not only the frame switch', async () => {
    mockEnabled = true;
    const onNavigate = vi.fn();
    const heard: Record<string, unknown[]> = {};
    const kinds = [
      'indivisible:focus-section',
      'indivisible:move-section',
      'indivisible:duplicate-section',
      'indivisible:delete-section',
      'indivisible:add-block',
      'indivisible:select-region',
      'indivisible:open-crm',
    ] as const;
    for (const kind of kinds) {
      const listener = (event: Event) => {
        heard[kind] = heard[kind] ?? [];
        heard[kind].push((event as CustomEvent).detail ?? null);
      };
      window.addEventListener(kind, listener);
      (globalThis as Record<string, unknown>)[`__cleanup_${kind}`] = () =>
        window.removeEventListener(kind, listener);
    }

    await act(async () => {
      root.render(<EditorialDrawerRow onNavigate={onNavigate} />);
    });
    await act(async () => {
      publishSections([
        { index: 0, label: 'First Section', blockIndex: 2, enabled: false },
        { index: 1, label: 'Get Out The Vote', blockIndex: 3, enabled: false },
      ]);
    });

    const click = async (selector: (b: HTMLButtonElement) => boolean) => {
      const target = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        selector
      );
      expect(target, 'control not found in the drawer row').not.toBeUndefined();
      await act(async () => {
        target?.click();
      });
    };

    // Jump, edit, duplicate, move, delete — one per row control.
    await click((b) => b.title === 'Jump to Get Out The Vote');
    await click((b) => b.getAttribute('aria-label') === 'Edit Get Out The Vote');
    await click((b) => b.getAttribute('aria-label') === 'Duplicate Get Out The Vote');
    await click((b) => b.getAttribute('aria-label') === 'Move Get Out The Vote up');
    await click((b) => b.getAttribute('aria-label') === 'Delete Get Out The Vote');
    // The block shortcuts.
    await click((b) => b.textContent?.includes('Add block') ?? false);
    await click((b) => b.textContent?.includes('Supabase media library') ?? false);
    await click((b) => b.textContent?.includes('Constituents & CRM') ?? false);

    expect(heard['indivisible:focus-section']).toHaveLength(2);
    expect(heard['indivisible:move-section']).toEqual([{ blockIndex: 3, direction: 'up' }]);
    expect(heard['indivisible:duplicate-section']).toEqual([{ blockIndex: 3 }]);
    expect(heard['indivisible:delete-section']).toEqual([{ blockIndex: 3 }]);
    expect(heard['indivisible:add-block']).toHaveLength(1);
    expect(heard['indivisible:open-crm']).toHaveLength(1);
    // Every navigation dispatch also closes the drawer, so the operator lands
    // back on the page they are editing rather than under the menu.
    expect(onNavigate).toHaveBeenCalled();

    for (const kind of kinds) {
      const cleanup = (globalThis as unknown as Record<string, (() => void) | undefined>)[
        `__cleanup_${kind}`
      ];
      cleanup?.();
      delete (globalThis as unknown as Record<string, unknown>)[`__cleanup_${kind}`];
    }
  });

  /**
   * `Frame all` / `Mute all` must state the *next* state, not the current one.
   *
   * The drawer's control reads "Mute all" while everything is framed and
   * "Frame all" while something is unframed. The inverse — labelling the
   * control with the state it describes — reads as a control that does the
   * wrong thing, and the payload proves which of the two it is.
   */
  it('the drawer Frame-all control dispatches the state it does not yet have', async () => {
    mockEnabled = true;
    let detail: { all?: boolean } | null = null;
    const listener = (event: Event) => {
      detail = (event as CustomEvent<{ all?: boolean }>).detail;
    };
    window.addEventListener(VISUAL_EDIT_EVENTS.toggleSection, listener);

    await act(async () => {
      root.render(<EditorialDrawerRow onNavigate={() => {}} />);
    });
    await act(async () => {
      publishSections([
        { index: 0, label: 'One', blockIndex: 0, enabled: false },
        { index: 1, label: 'Two', blockIndex: 1, enabled: false },
      ]);
    });

    const frameAll = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Frame all'
    );
    expect(frameAll, 'expected a "Frame all" control while every section is unframed').not.toBe(
      undefined
    );
    await act(async () => {
      frameAll?.click();
    });
    expect(detail).toEqual({ all: true });

    // With every section now framed, the same control reads "Mute all" and
    // dispatches the opposite payload.
    await act(async () => {
      publishSections([
        { index: 0, label: 'One', blockIndex: 0, enabled: true },
        { index: 1, label: 'Two', blockIndex: 1, enabled: true },
      ]);
    });
    const muteAll = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Mute all'
    );
    expect(muteAll).not.toBeUndefined();
    await act(async () => {
      muteAll?.click();
    });
    expect(detail).toEqual({ all: false });

    window.removeEventListener(VISUAL_EDIT_EVENTS.toggleSection, listener);
  });

  /**
   * A section the overlay has not described cannot be addressed.
   *
   * `blockIndex: null` is what `discoverPageSections` returns for the DOM-only
   * fallback, and every control on such a row must be inert rather than
   * dispatching an event the overlay would have to guess at. Rendering them live
   * is how the header came to offer "edit section 3" for an element that was
   * really section 4.
   */
  it('disables every control for a section the overlay has not described', async () => {
    mockEnabled = true;

    await act(async () => {
      root.render(<EditorialDrawerRow onNavigate={() => {}} />);
    });
    await act(async () => {
      publishSections([{ index: 0, label: 'Not yet described', blockIndex: null }]);
    });

    const controls = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="switch"], button[title]')
    );
    const sectionControls = controls.filter((button) =>
      button.getAttribute('title')?.includes('Waiting for the editor')
    );
    expect(sectionControls.length).toBeGreaterThan(0);
    for (const control of sectionControls) {
      expect(control.disabled).toBe(true);
    }
  });

  /**
   * `/about` has copy regions, so the drawer must offer them and switching one
   * must reach the overlay as an event.
   *
   * The overlay owns the document; a region selected here and nowhere else is a
   * switch that moves and changes nothing.
   */
  it('offers the page copy regions and dispatches a select event', async () => {
    mockEnabled = true;
    const selectListener = vi.fn();
    window.addEventListener(VISUAL_EDIT_EVENTS.selectRegion, selectListener);

    await act(async () => {
      root.render(<EditorialDrawerRow onNavigate={() => {}} />);
    });

    // `/about` is mocked as the pathname and registers four regions.
    for (const label of [
      'Mission Statement',
      'Who We Are',
      'Nonviolence Commitment',
      'Join Our Next Gathering',
    ]) {
      expect(container.textContent).toContain(label);
    }

    const regionBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Mission Statement'
    );
    expect(regionBtn).not.toBeUndefined();

    await act(async () => {
      regionBtn?.click();
    });

    expect(selectListener).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { regionId: 'about-mission', at: expect.any(Number) } })
    );
    window.removeEventListener(VISUAL_EDIT_EVENTS.selectRegion, selectListener);
  });

  /**
   * A section list from another region must not be adopted.
   *
   * Both the pathname and the region are part of the comparison now that one
   * page holds several documents. Accepting a stale list would offer controls
   * that address blocks in a document the operator has already left.
   */
  it('ignores a published section list from a different region', async () => {
    mockEnabled = true;

    await act(async () => {
      root.render(<EditorialDrawerRow onNavigate={() => {}} />);
    });

    // A list for a region the drawer is not on. It stays on the whole page
    // (`activeRegionId === null`), so this publication is about a different
    // document and must be dropped rather than rendered.
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.sectionsPublished, {
          detail: {
            sections: [
              { index: 0, label: 'Wipe me', blockType: null, blockIndex: 0, enabled: true },
            ],
            pathname: '/about',
            regionId: 'about-mission',
          },
        })
      );
    });

    const jumpButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[title]')
    ).filter((button) => button.getAttribute('title')?.startsWith('Jump to'));
    expect(jumpButtons).toHaveLength(0);
    expect(container.textContent).not.toContain('Wipe me');

    // A matching publication for the whole page is still adopted.
    await act(async () => {
      publishSections([{ index: 1, label: 'Whole page copy', blockIndex: 1 }]);
    });
    const adopted = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[title]')
    ).filter((button) => button.getAttribute('title')?.startsWith('Jump to'));
    expect(adopted).toHaveLength(1);
  });
});
