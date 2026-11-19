// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';
import {
  asRect,
  attemptHardLeave,
  body,
  byText,
  changeComposerCopy,
  changeCornerRadius,
  container,
  getContentBySlugForEdit,
  getContentForEdit,
  mount,
  openComposerOn,
  openComposerOnFirstBlock,
  pageChildren,
  pathname,
  rendered,
  renderPage,
  saveContent,
  toast,
  withPage,
} from './VisualEditOverlay.harness';
import { type OverlayMediaSelection, overlayMocks } from './VisualEditOverlay.mocks';

vi.mock('@/lib/actions/content', async () => {
  const { overlayMocks } = await import('./VisualEditOverlay.mocks');
  return overlayMocks.content;
});
vi.mock('@/lib/actions/crm', async () => {
  const { overlayMocks } = await import('./VisualEditOverlay.mocks');
  return overlayMocks.crm;
});
vi.mock('../CRMPanel', () => ({ CRMPanel: () => null }));
vi.mock('@/lib/actions/visual', async () => {
  const { overlayMocks } = await import('./VisualEditOverlay.mocks');
  return overlayMocks.visual;
});
vi.mock('sonner', async () => {
  const { overlayMocks } = await import('./VisualEditOverlay.mocks');
  return { toast: overlayMocks.toast };
});
vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: () => overlayMocks.editContext,
}));
vi.mock('@/components/admin/crm/composer/CRMMediaLibraryModal', () => ({
  CRMMediaLibraryModal: (props: {
    isOpen: boolean;
    onSelectMedia: (media: OverlayMediaSelection) => void | Promise<void>;
  }) => {
    if (props.isOpen) overlayMocks.mediaLibrary.onSelectMedia = props.onSelectMedia;
    return null;
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => overlayMocks.router,
  usePathname: () => overlayMocks.pathname.value,
}));
vi.mock('@/components/layout/visual-edit-store', () => ({
  registerVisualEditExitGuard: vi.fn(),
  useVisualEditMode: () => ({
    enabled: overlayMocks.visualMode.enabled,
    toggle: () => {
      overlayMocks.visualMode.enabled = !overlayMocks.visualMode.enabled;
    },
  }),
}));

describe('VisualEditOverlay — document lifecycle and regions', () => {
  it('preserves a published page’s original date when visual-saving', async () => {
    renderPage(rendered);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body,
      featured_image: null,
      metadata: {},
      published_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    const paragraph = pageChildren().children[0] as HTMLElement;
    await act(async () => {
      paragraph.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      paragraph.innerHTML = 'Updated intro.';
      paragraph.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
      );
    });

    const written = saveContent.mock.calls.at(-1)?.[0];
    expect(written?.publishedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('does not retry a definitive 4xx edge save through the server action', async () => {
    await withPage();
    const saveButton = container.querySelector<HTMLButtonElement>(
      'button[title^="Write this document to Supabase"]'
    );
    expect(saveButton).not.toBeNull();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: 'Validation failed' }),
        } as unknown as Response;
      }
      return { ok: false, status: 404 } as unknown as Response;
    }) as unknown as typeof fetch;

    try {
      await act(async () => {
        saveButton?.click();
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(saveContent).not.toHaveBeenCalled();
  });

  it('keeps typed copy on the page when it is applied', async () => {
    await withPage();
    const paragraph = pageChildren().children[0] as HTMLElement;

    await openComposerOnFirstBlock();
    await changeComposerCopy('Applied intro.');
    await act(async () => {
      byText('Save Block')?.click();
    });

    // The panel is gone; the page already shows what was applied rather than
    // snapping back to the old sentence until the autosave refresh lands.
    expect(document.body.textContent).not.toContain('Visual Composer Inspector');
    expect(paragraph.textContent).toBe('Applied intro.');
    expect(paragraph.hasAttribute('data-vc-draft-preview')).toBe(false);
  });

  it('keeps the page’s own structural classes on the heading root', async () => {
    /*
     * The save writes the design on the heading itself, beside `cw--h2` — the
     * site's typography, not the composer's. The preview paints that same root:
     * design plus structural classes, never a replacement that drops the
     * heading's typography while a draft is being tuned.
     */
    const wrappedBody = '<p>Intro copy.</p><h2 class="cw cw--h2">Mission</h2>';
    renderPage(wrappedBody);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: wrappedBody,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    const heading = pageChildren().children[1] as HTMLElement;
    expect(heading.getAttribute('class')).toBe('cw cw--h2');

    await openComposerOn(1);
    await changeCornerRadius();

    expect(heading.getAttribute('class')).toContain('cw--h2');
    expect(heading.getAttribute('class')).toContain('rounded-2xl');

    await act(async () => {
      byText('Cancel')?.click();
    });
    await act(async () => {
      byText('Discard')?.click();
    });

    // Byte-for-byte, not merely "the cw class is still there".
    expect(heading.getAttribute('class')).toBe('cw cw--h2');
  });

  it('keeps the applied design on the page instead of flashing back to the old one', async () => {
    await withPage();
    const paragraph = pageChildren().children[0] as HTMLElement;

    await openComposerOnFirstBlock();
    await changeCornerRadius();
    expect(paragraph.getAttribute('class')).toContain('rounded-2xl');

    await act(async () => {
      byText('Save Block')?.click();
    });

    /*
     * The panel is gone and the page is already wearing what was applied. The
     * autosave's refresh will replace this wrapper with identical classes; a
     * restore here would show the old design for the seconds in between.
     */
    expect(document.body.textContent).not.toContain('Visual Composer Inspector');
    expect(paragraph.getAttribute('class')).toContain('rounded-2xl');
    expect(paragraph.hasAttribute('data-vc-draft-preview')).toBe(false);
  });

  it('reorders blocks by dragging the handle and writes the order once', async () => {
    await withPage();
    const page = pageChildren();
    const paragraph = page.children[0] as HTMLElement;
    const heading = page.children[1] as HTMLElement;

    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      if (this === paragraph) return asRect(0, 100);
      if (this === heading) return asRect(100, 300);
      return asRect(0, 0);
    });

    try {
      const handle = container.querySelector<HTMLButtonElement>(
        'button[aria-label^="Reorder Intro copy"]'
      );
      expect(handle).not.toBeNull();

      await act(async () => {
        handle?.dispatchEvent(
          new MouseEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientY: 50,
          })
        );
      });
      await act(async () => {
        window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: 220 }));
      });

      // The gap the block would land in is drawn while the pointer moves.
      expect(document.querySelector('[data-testid="block-drop-indicator"]')).not.toBeNull();

      await act(async () => {
        window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: 220 }));
      });

      const confirmDialog = document.querySelector('[data-testid="block-reorder-confirm-dialog"]');
      if (confirmDialog) {
        const confirmBtn = confirmDialog.querySelector<HTMLButtonElement>('button:last-child');
        await act(async () => {
          confirmBtn?.click();
        });
      }
    } finally {
      spy.mockRestore();
    }

    expect(saveContent).toHaveBeenCalledTimes(1);
    const written = saveContent.mock.calls[0][0].body as string;
    expect(written.indexOf('Mission')).toBeLessThan(written.indexOf('Intro copy.'));
  });

  it('moves a block from the same handle with the arrow keys', async () => {
    await withPage();
    const page = pageChildren();
    const paragraph = page.children[0] as HTMLElement;
    const heading = page.children[1] as HTMLElement;

    // The keyboard move is the drag's visible-neighbour rule: it steps over the
    // form block that is in the document but not on the page.
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      if (this === paragraph) return asRect(0, 100);
      if (this === heading) return asRect(100, 300);
      return asRect(0, 0);
    });

    try {
      const handle = container.querySelector<HTMLButtonElement>(
        'button[aria-label^="Reorder Intro copy"]'
      );
      expect(handle).not.toBeNull();

      await act(async () => {
        handle?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
        );
      });
    } finally {
      spy.mockRestore();
    }

    expect(saveContent).toHaveBeenCalledTimes(1);
    const written = saveContent.mock.calls[0][0].body as string;
    expect(written.indexOf('Mission')).toBeLessThan(written.indexOf('Intro copy.'));
  });

  it('offers an insert-after control on the block being worked on', async () => {
    await withPage();

    const chip = container.querySelector<HTMLButtonElement>('button[title^="Select this block"]');
    await act(async () => {
      chip?.click();
    });

    const addAfter = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add a block after Intro copy."]'
    );
    expect(addAfter).not.toBeNull();
    await act(async () => {
      addAfter?.click();
    });

    expect(document.body.textContent).toContain('Visual Composer Element Library');
    // The library is aimed at the gap after block #1, which reads as "above the
    // block that comes next".
    expect(document.body.textContent).toContain('Insert element above block #2');

    /*
     * One way to add a block at the frame, not three. The pill's duplicate
     * insert-after and the dropdown's second add menu both went away; the dock
     * and the element-library shortcut still own the general add paths.
     */
    expect(container.querySelector('button[aria-label="Add block below"]')).toBeNull();
    expect(
      Array.from(container.querySelectorAll('button')).some(
        (button) => button.textContent?.trim() === 'Insert Element'
      )
    ).toBe(false);
  });

  it('loads the row the composer workspace names, even when the path names no slug', async () => {
    /*
     * `/compose/42` is not a CMS path: it has two segments, so `cmsSlugForPath`
     * returns null and the old loader would have fallen back to extracting the
     * DOM and saving under a slug invented from the admin URL. The row id in the
     * markup is the only address that survives that shape, and it has to win
     * over the path-derived slug.
     */
    const page = renderPage(rendered);
    page.setAttribute('data-visual-edit-content-id', '42');
    pathname.value = '/compose/42';
    getContentForEdit.mockResolvedValue({
      id: 42,
      title: 'Composed Row',
      slug: 'composed-row',
      excerpt: null,
      type: 'page',
      status: 'draft',
      body,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });

    await mount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(getContentForEdit).toHaveBeenCalledWith(42);
    expect(getContentBySlugForEdit).not.toHaveBeenCalled();
  });

  it('loads and pairs a composer row when the overlay mounts before the page body', async () => {
    /*
     * The overlay is in the root layout; the page body streams in after it.
     * Resolving the document or the root only once leaves the editor calling a
     * loading skeleton ready. The route id has to be enough to load the row,
     * and the later body has to replace the cached root so its blocks get
     * frames.
     */
    const main = document.createElement('main');
    document.body.appendChild(main);
    pathname.value = '/compose/42';
    getContentForEdit.mockResolvedValue({
      id: 42,
      title: 'Composed Row',
      slug: 'composed-row',
      excerpt: null,
      type: 'page',
      status: 'draft',
      body,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });

    await mount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(getContentForEdit).toHaveBeenCalledWith(42);
    expect(
      container
        .querySelector('[data-testid="visual-edit-overlay"]')
        ?.getAttribute('data-document-state')
    ).toBe('ready');

    // The page's ContentSurface arrives only now. The row was already read.
    const page = document.createElement('div');
    page.setAttribute('data-visual-edit-root', '');
    page.setAttribute('data-visual-edit-content-id', '42');
    page.innerHTML = rendered;
    main.appendChild(page);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(container.textContent).toContain('3 blocks in the document');
  });

  it('waits for a rowless region container instead of adopting the host page', async () => {
    /*
     * A region's document is its own subtree. If a `?region=` load runs before
     * the page streams that subtree in, the only apparent root is the host
     * page; extracting it would make the region's first save replace the
     * region with the whole page. Stay loading until the real container
     * appears, then extract that.
     */
    const main = document.createElement('main');
    const host = document.createElement('div');
    host.setAttribute('data-visual-edit-root', '');
    host.innerHTML = '<p>Host copy.</p><h2>Host heading</h2>';
    main.appendChild(host);
    document.body.appendChild(main);
    window.history.replaceState({}, '', '/?visual-edit=1&region=home-hero');
    pathname.value = '/';
    getContentBySlugForEdit.mockResolvedValue(null);

    await mount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    const overlay = container.querySelector<HTMLElement>('[data-testid="visual-edit-overlay"]');
    expect(overlay?.getAttribute('data-document-state')).toBe('loading');

    const region = document.createElement('div');
    region.setAttribute('data-copy-region', 'home-hero');
    region.innerHTML = '<h2 class="cw cw--h2">Region heading</h2>';
    main.appendChild(region);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    expect(overlay?.getAttribute('data-document-state')).toBe('ready');
    expect(container.textContent).toContain('1 block in the document');
    expect(container.textContent).toContain('Region heading');
    expect(container.textContent).not.toContain('Host heading');
  });

  it('reports a declared composer row that reads back empty instead of adopting the DOM', async () => {
    const page = renderPage(rendered);
    page.setAttribute('data-visual-edit-content-id', '42');
    pathname.value = '/compose/42';
    getContentForEdit.mockResolvedValue(null);

    await mount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const toolbar = container.querySelector<HTMLElement>('[data-testid="visual-edit-overlay"]');
    expect(toolbar?.getAttribute('data-document-state')).toBe('degraded');
    expect(container.querySelector('[data-testid="composer-document-error"]')).not.toBeNull();
    expect(getContentBySlugForEdit).not.toHaveBeenCalled();
  });

  it('opens the region a ?region= link names', async () => {
    /*
     * A region is not a page, so a link to it cannot be a path. The composer's
     * link carries `?region=home-hero` on the host page, and the overlay has to
     * turn that into the region's own `copy-` row. Without this the host page
     * opened on the whole-page document and the operator edited `/`, not the
     * region they clicked.
     */
    window.history.replaceState({}, '', '/?visual-edit=1&region=home-hero');
    pathname.value = '/';
    renderPage('<div data-copy-region="home-hero"><h2 class="cw cw--h2">Mission</h2></div>');
    getContentBySlugForEdit.mockImplementation(async (slug: string) =>
      slug === 'copy-home-hero'
        ? {
            id: 23,
            title: 'Hero & Headline',
            slug: 'copy-home-hero',
            excerpt: null,
            type: 'page',
            status: 'publish',
            body: '<h2 class="cw cw--h2">Mission</h2>',
            featured_image: null,
            metadata: {},
            updated_at: '2026-10-09T00:00:00Z',
          }
        : null
    );

    await mount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(getContentBySlugForEdit).toHaveBeenCalledWith('copy-home-hero');
    // Other pages' regions are not addressable from here: region slugs are
    // unique site-wide, and anchoring by pathname is what keeps a hand-edited
    // URL from editing a different page's row while framing this one.
    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');
  });

  it('ignores a region id that belongs to a different page', async () => {
    window.history.replaceState({}, '', '/?visual-edit=1&region=about-mission');
    pathname.value = '/';
    renderPage('<div data-copy-region="home-hero"><h2 class="cw cw--h2">Mission</h2></div>');

    await mount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');
  });

  it('keeps the selected region in the address bar', async () => {
    /*
     * Selection used to be React state alone. The address bar kept the old id,
     * so a refresh — or a bookmark — reopened a different document from the one
     * being edited. The sidebar's tabs and the event bus both go through the
     * same selection path, and that path now owns the URL.
     */
    window.history.replaceState({}, '', '/?visual-edit=1');
    pathname.value = '/';
    renderPage('<div data-copy-region="home-hero"><h2 class="cw cw--h2">Mission</h2></div>');
    await mount();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
          detail: { regionId: 'home-hero' },
        })
      );
    });
    expect(new URLSearchParams(window.location.search).get('region')).toBe('home-hero');

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, { detail: { regionId: null } })
      );
    });
    expect(new URLSearchParams(window.location.search).get('region')).toBeNull();
    // The mode parameter is not the region's to remove.
    expect(new URLSearchParams(window.location.search).get('visual-edit')).toBe('1');
  });

  it('does not let a superseded region load overwrite the newest one', async () => {
    await withPage();

    let releaseMission!: () => void;
    const missionGate = new Promise<void>((resolve) => {
      releaseMission = resolve;
    });
    const row = (id: number, title: string, slug: string, body: string) => ({
      id,
      title,
      slug,
      excerpt: null,
      type: 'page',
      status: 'publish',
      body,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });

    getContentBySlugForEdit.mockImplementation(async (slug: string) => {
      if (slug === 'copy-about-mission') {
        await missionGate;
        return row(31, 'Loaded mission', 'copy-about-mission', '<h2>Mission body</h2>');
      }
      if (slug === 'copy-about-who') {
        return row(32, 'Loaded who', 'copy-about-who', '<h2>Who body</h2>');
      }
      return null;
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false } as unknown as Response) as unknown as typeof fetch;
    try {
      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
            detail: { regionId: 'about-mission' },
          })
        );
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(getContentBySlugForEdit).toHaveBeenCalledWith('copy-about-mission');

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
            detail: { regionId: 'about-who' },
          })
        );
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(container.textContent).toContain('Loaded who');

      // The earlier read now finishes. It belongs to a region the operator has
      // left, so it must not put "Loaded mission" over the active document.
      releaseMission();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(container.textContent).toContain('Loaded who');
      expect(container.textContent).not.toContain('Loaded mission');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('refuses a region id from another page on the event bus', async () => {
    window.history.replaceState({}, '', '/?visual-edit=1');
    pathname.value = '/';
    renderPage('<div data-copy-region="home-hero"><h2 class="cw cw--h2">Mission</h2></div>');
    await mount();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
          detail: { regionId: 'about-mission' },
        })
      );
    });

    // Region ids are unique site-wide. Accepting one from another page would
    // load that row while framing this page.
    expect(new URLSearchParams(window.location.search).get('region')).toBeNull();
    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');
  });

  it('turns a document read that never settles into a recoverable degraded state', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false } as Response) as unknown as typeof fetch;
    getContentBySlugForEdit.mockReturnValue(new Promise(() => {}));
    renderPage(rendered);

    vi.useFakeTimers();
    try {
      await mount();
      const sidebar = document.querySelector<HTMLElement>('[data-testid="visual-edit-overlay"]');
      expect(sidebar?.getAttribute('data-document-state')).toBe('loading');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_001);
      });

      expect(sidebar?.getAttribute('data-document-state')).toBe('degraded');
      expect(toast.error).toHaveBeenCalledWith(
        'The saved document took too long to open. Retry the document load.'
      );
      // A document that was never read is not unsaved work; reloading the
      // failed editor must not trigger the browser's leave prompt.
      expect(attemptHardLeave().defaultPrevented).toBe(false);
    } finally {
      vi.useRealTimers();
      globalThis.fetch = originalFetch;
    }
  });

  it('recovers from a timed-out document read through the sidebar retry', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false } as Response) as unknown as typeof fetch;
    getContentBySlugForEdit.mockReturnValueOnce(new Promise(() => {}));
    renderPage(rendered);

    vi.useFakeTimers();
    try {
      await mount();
      const sidebar = document.querySelector<HTMLElement>('[data-testid="visual-edit-overlay"]');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_001);
      });
      expect(sidebar?.getAttribute('data-document-state')).toBe('degraded');

      getContentBySlugForEdit.mockResolvedValue({
        id: 7,
        title: 'About Us',
        slug: 'about',
        excerpt: null,
        type: 'page',
        status: 'publish',
        body,
        featured_image: null,
        metadata: {},
        updated_at: '2026-10-09T00:00:00Z',
      });
      const retry = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.includes('Retry document load')
      );
      expect(retry).not.toBeNull();

      await act(async () => {
        retry?.click();
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(
        container
          .querySelector('[data-testid="visual-edit-overlay"]')
          ?.getAttribute('data-document-state')
      ).toBe('ready');
      expect(container.querySelector('[data-testid="composer-document-error"]')).toBeNull();
    } finally {
      vi.useRealTimers();
      globalThis.fetch = originalFetch;
    }
  });
});
