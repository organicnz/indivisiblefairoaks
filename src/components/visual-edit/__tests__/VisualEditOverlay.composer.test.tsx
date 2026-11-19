// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';
import {
  attemptHardLeave,
  body,
  byText,
  changeComposerCopy,
  changeCornerRadius,
  composerCopy,
  container,
  dirtyThePage,
  editContext,
  getContentBySlugForEdit,
  getContentForEdit,
  mount,
  openComposerOnFirstBlock,
  pageChildren,
  pathname,
  renderPage,
  root,
  router,
  saveContent,
  VisualEditOverlay,
  withPage,
} from './VisualEditOverlay.harness';
import { type OverlayMediaSelection, overlayMocks } from './VisualEditOverlay.mocks';

vi.mock('@/lib/actions/content', () => overlayMocks.content);
vi.mock('@/lib/actions/crm', () => overlayMocks.crm);
vi.mock('../CRMPanel', () => ({ CRMPanel: () => null }));
vi.mock('@/lib/actions/visual', () => overlayMocks.visual);
vi.mock('sonner', () => ({ toast: overlayMocks.toast }));
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

describe('VisualEditOverlay — composer drafts and route guards', () => {
  it('opens from a block row and keeps its draft when the page reloads the same document', async () => {
    await withPage();

    /*
     * The dock's per-block row is the entry point an operator browsing a page
     * reaches first. It addresses the same block its frame does; the panel used
     * to open and then be closed a moment later by an in-flight content load.
     */
    const rowButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Visual Composer for "]')
    );
    expect(rowButtons.length).toBeGreaterThan(0);
    await act(async () => {
      rowButtons[0].click();
    });

    expect(document.body.textContent).toContain('Visual Composer Inspector');
    expect(document.body.textContent).toContain('Block #1 ·');

    await changeCornerRadius();
    const paragraph = pageChildren().children[0] as HTMLElement;
    expect(paragraph.getAttribute('class')).toContain('rounded-2xl');

    /*
     * A late edit-context response makes the overlay load the same row again:
     * it is still the `/about` document, but now the loader knows its content
     * id. That used to close the panel and take the unapplied draft with it.
     */
    getContentForEdit.mockResolvedValue({
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
    editContext.target = { label: 'About Us', editUrl: '/admin/content/7' };
    await act(async () => {
      // Any overlay state update re-renders it; the loader itself re-runs
      // because its `target` dependency changed.
      document
        .querySelector<HTMLButtonElement>('button[aria-label="Collapse Visual Editor Sidebar"]')
        ?.click();
    });

    expect(getContentForEdit).toHaveBeenCalledWith(7);
    expect(document.body.textContent).toContain('Visual Composer Inspector');
    expect(document.body.textContent).toContain('Block #1 ·');
    // The draft is still the live design, not the row's original markup.
    expect(paragraph.getAttribute('class')).toContain('rounded-2xl');
    expect(paragraph.getAttribute('data-vc-draft-preview')).toBe('true');
  });

  it('asks before replacing the document under an unsaved draft', async () => {
    await withPage();
    await openComposerOnFirstBlock();
    await changeCornerRadius();

    const selectMission = async () => {
      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
            detail: { regionId: 'about-mission' },
          })
        );
      });
    };

    await selectMission();

    // The panel still describes the document it was editing, the active region
    // has not moved, and the URL still addresses the whole page. A switch that
    // waits for the panel guard must not become a half-switch.
    expect(document.body.textContent).toContain('Discard unsaved changes?');
    expect(document.body.textContent).toContain('Visual Composer Inspector');
    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');
    expect(new URLSearchParams(window.location.search).get('region')).toBeNull();

    // Back to editing cancels the staged switch as well as the panel close.
    await act(async () => {
      byText('Back to editing')?.click();
    });
    expect(document.body.textContent).toContain('Visual Composer Inspector');
    expect(document.body.textContent).not.toContain('Discard unsaved changes?');
    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');
    expect(new URLSearchParams(window.location.search).get('region')).toBeNull();

    await selectMission();
    await act(async () => {
      byText('Discard')?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(document.body.textContent).not.toContain('Visual Composer Inspector');
    expect(getContentBySlugForEdit).toHaveBeenCalledWith('copy-about-mission');
    expect(new URLSearchParams(window.location.search).get('region')).toBe('about-mission');
  });

  it('returns to the loaded route when the operator keeps an unsaved composer draft', async () => {
    await withPage();
    await openComposerOnFirstBlock();
    await changeCornerRadius();

    // A Next navigation changes the pathname before the loader can ask the open
    // panel to close. The blocks on screen still belong to /about.
    pathname.value = '/events';
    await act(async () => {
      root.render(<VisualEditOverlay />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(document.body.textContent).toContain('Discard unsaved changes?');
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => {
      byText('Back to editing')?.click();
    });

    // Keeping the draft restores the document's own address and drops the
    // queued load; it does not leave /events over an /about page.
    expect(router.replace).toHaveBeenCalledWith('/about');
    expect(document.body.textContent).toContain('Visual Composer Inspector');
    expect(document.body.textContent).not.toContain('Discard unsaved changes?');
    expect((pageChildren().children[0] as HTMLElement).getAttribute('class')).toContain(
      'rounded-2xl'
    );
  });

  it('does not load a previous route’s region while restoring that route', async () => {
    window.history.replaceState({}, '', '/?visual-edit=1&region=home-hero');
    pathname.value = '/';
    renderPage('<div data-copy-region="home-hero"><h2 class="cw cw--h2">Mission</h2></div>');
    getContentBySlugForEdit.mockResolvedValue({
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
    });

    await mount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await openComposerOnFirstBlock();
    await changeCornerRadius();

    const regionLoads = () =>
      getContentBySlugForEdit.mock.calls.filter((call) => call[0] === 'copy-home-hero').length;
    const loadsBefore = regionLoads();

    pathname.value = '/events';
    await act(async () => {
      root.render(<VisualEditOverlay />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });

    // The stale region must not be read under /events. The route change is
    // still guarded, and keeping the draft restores the region's full address.
    expect(document.body.textContent).toContain('Discard unsaved changes?');
    expect(regionLoads()).toBe(loadsBefore);

    await act(async () => {
      byText('Back to editing')?.click();
    });

    expect(router.replace).toHaveBeenCalledWith('/?visual-edit=1&region=home-hero');
    expect(document.body.textContent).toContain('Visual Composer Inspector');
  });

  it('asks before a route change discards unsaved page edits', async () => {
    await withPage();
    await dirtyThePage();
    const loadsBefore = getContentBySlugForEdit.mock.calls.length;

    pathname.value = '/team';
    await act(async () => {
      root.render(<VisualEditOverlay />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const routeDialog = document.querySelector<HTMLElement>(
      '[data-testid="route-leave-confirm-dialog"]'
    );
    expect(routeDialog).not.toBeNull();
    // The modal owns the keyboard from the moment it opens.
    expect(routeDialog?.contains(document.activeElement)).toBe(true);
    expect(getContentBySlugForEdit.mock.calls.length).toBe(loadsBefore);
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => {
      byText('Stay on this page')?.click();
    });

    expect(router.replace).toHaveBeenCalledWith('/about');
    expect(document.body.textContent).toContain('unsaved changes');
    expect(document.querySelector('[data-testid="route-leave-confirm-dialog"]')).toBeNull();
  });

  it('loads the new route after the operator confirms discarding page edits', async () => {
    await withPage();
    await dirtyThePage();
    getContentBySlugForEdit.mockImplementation(async (slug) =>
      slug === 'team'
        ? {
            id: 19,
            title: 'Team',
            slug: 'team',
            excerpt: null,
            type: 'page',
            status: 'publish',
            body: '<h2 class="cw cw--h2">Team</h2>',
            featured_image: null,
            metadata: {},
            updated_at: '2026-10-09T00:00:00Z',
          }
        : null
    );

    pathname.value = '/team';
    await act(async () => {
      root.render(<VisualEditOverlay />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(document.querySelector('[data-testid="route-leave-confirm-dialog"]')).not.toBeNull();

    await act(async () => {
      byText('Discard and leave')?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    expect(getContentBySlugForEdit).toHaveBeenCalledWith('team');
    expect(document.querySelector('[data-testid="route-leave-confirm-dialog"]')).toBeNull();
  });

  it('warns before a hard reload while page edits are unsaved', async () => {
    await withPage();
    await dirtyThePage();

    expect(attemptHardLeave().defaultPrevented).toBe(true);
  });

  it('does not warn before a hard reload on a saved page', async () => {
    await withPage();

    expect(attemptHardLeave().defaultPrevented).toBe(false);
  });

  it('does not refresh a same document over unsaved page edits', async () => {
    await withPage();
    await dirtyThePage();
    const loadsBefore = getContentBySlugForEdit.mock.calls.length;
    editContext.target = { label: 'About Us', editUrl: '/admin/content/7' };

    const collapse = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse Visual Editor Sidebar"]'
    );
    expect(collapse).not.toBeNull();
    await act(async () => {
      collapse?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(getContentForEdit).not.toHaveBeenCalled();
    expect(getContentBySlugForEdit.mock.calls.length).toBe(loadsBefore);
    // Collapsing hid the sidebar's unsaved badge; the direct load assertions
    // above are what prove the dirty document was not refreshed.
  });

  it('applies the composer on ⌘S instead of saving the page underneath it', async () => {
    await withPage();
    await openComposerOnFirstBlock();
    await changeCornerRadius();
    expect(document.body.textContent).toContain('Visual Composer Inspector');

    // Dispatch from window: this is the path where the inspector's React tree
    // never sees the event and the overlay's page-level save used to win.
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true })
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    // Applying the draft updates the page model and closes the panel; it must
    // not persist the page without the draft or leave the panel open.
    expect(saveContent).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('Visual Composer Inspector');
  });

  it('asks before switching regions with unsaved page edits', async () => {
    await withPage();

    // Make a real page-level change and then undo it. The delete persists, so
    // the undo leaves the document dirty without opening the composer; this is
    // the state the old switch path silently replaced.
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail: { blockIndex: 0 } })
      );
    });
    const undo = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Undo the last change"]'
    );
    expect(undo).not.toBeNull();
    await act(async () => {
      undo?.click();
    });
    expect(document.body.textContent).toContain('unsaved changes');

    const selectMission = async () => {
      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
            detail: { regionId: 'about-mission' },
          })
        );
      });
    };

    await selectMission();
    expect(document.body.textContent).toContain('You have unsaved page changes.');
    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');
    expect(new URLSearchParams(window.location.search).get('region')).toBeNull();

    // Keeping editing is the safe default: no load and no URL change.
    await act(async () => {
      byText('Keep editing')?.click();
    });
    expect(document.body.textContent).not.toContain('You have unsaved page changes.');
    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');
    expect(new URLSearchParams(window.location.search).get('region')).toBeNull();

    await selectMission();
    await act(async () => {
      byText('Discard and switch')?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(getContentBySlugForEdit).toHaveBeenCalledWith('copy-about-mission');
    expect(new URLSearchParams(window.location.search).get('region')).toBe('about-mission');
  });

  it('hands a deferred switch to the page guard after the composer closes', async () => {
    await withPage();

    // Dirty the page without opening the composer: delete, then undo. The
    // delete persists, so the document is now ahead of its saved baseline.
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail: { blockIndex: 0 } })
      );
    });
    const undo = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Undo the last change"]'
    );
    expect(undo).not.toBeNull();
    await act(async () => {
      undo?.click();
    });
    expect(document.body.textContent).toContain('unsaved changes');

    await openComposerOnFirstBlock();
    expect(document.body.textContent).toContain('Visual Composer Inspector');

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
          detail: { regionId: 'about-mission' },
        })
      );
    });

    // The panel had no unsaved draft, so it closed immediately. The page guard
    // must now own the request instead of silently replacing the document.
    expect(document.body.textContent).not.toContain('Visual Composer Inspector');
    expect(document.body.textContent).toContain('You have unsaved page changes.');
    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');
    expect(new URLSearchParams(window.location.search).get('region')).toBeNull();

    await act(async () => {
      byText('Keep editing')?.click();
    });
    expect(document.body.textContent).not.toContain('You have unsaved page changes.');
    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');
    expect(new URLSearchParams(window.location.search).get('region')).toBeNull();
  });

  it('does not let a save for the previous document clean the region that replaced it', async () => {
    await withPage();

    let releaseSave!: (value: unknown) => void;
    const saveGate = new Promise((resolve) => {
      releaseSave = resolve;
    });
    saveContent.mockReturnValueOnce(saveGate);

    // Delete writes immediately. Hold that write open while the operator
    // switches, so its response lands after the new region is on screen.
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail: { blockIndex: 0 } })
      );
      await Promise.resolve();
    });

    getContentBySlugForEdit.mockImplementation(async (slug: string) =>
      slug === 'copy-about-mission'
        ? {
            id: 31,
            title: 'Mission region',
            slug,
            excerpt: null,
            type: 'page',
            status: 'publish',
            body: '<h2 class="cw cw--h2">Mission region</h2>',
            featured_image: null,
            metadata: {},
            updated_at: '2026-10-09T00:00:00Z',
          }
        : {
            id: 7,
            title: 'About Us',
            slug,
            excerpt: null,
            type: 'page',
            status: 'publish',
            body,
            featured_image: null,
            metadata: {},
            updated_at: '2026-10-09T00:00:00Z',
          }
    );

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
          detail: { regionId: 'about-mission' },
        })
      );
    });
    await act(async () => {
      byText('Discard and switch')?.click();
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container.textContent).toContain('Mission region');

    releaseSave({ success: true, data: { id: 7, updatedAt: '2026-10-10T00:00:00Z' } });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // The old write succeeded on the old row, but it must not become the new
    // region's title or saved baseline.
    expect(container.textContent).toContain('Mission region');
    expect(container.textContent).not.toContain('About Us');
  });

  it('clears undo history when a region replaces the document', async () => {
    await withPage();

    // Build a real undo step, then let the delete persist so the switch itself
    // is clean and does not raise the unrelated unsaved-changes guard.
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail: { blockIndex: 0 } })
      );
    });
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Undo the last change"]')
        ?.disabled
    ).toBe(false);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    getContentBySlugForEdit.mockImplementation(async (slug: string) =>
      slug === 'copy-about-mission'
        ? {
            id: 31,
            title: 'Mission region',
            slug,
            excerpt: null,
            type: 'page',
            status: 'publish',
            body: '<h2 class="cw cw--h2">Mission region</h2>',
            featured_image: null,
            metadata: {},
            updated_at: '2026-10-09T00:00:00Z',
          }
        : {
            id: 7,
            title: 'About Us',
            slug,
            excerpt: null,
            type: 'page',
            status: 'publish',
            body,
            featured_image: null,
            metadata: {},
            updated_at: '2026-10-09T00:00:00Z',
          }
    );

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
          detail: { regionId: 'about-mission' },
        })
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(container.textContent).toContain('Mission region');
    const undo = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Undo the last change"]'
    );
    expect(undo?.disabled).toBe(true);
  });

  it('paints the composer draft onto the page, and takes it back on discard', async () => {
    await withPage();
    const paragraph = pageChildren().children[0] as HTMLElement;

    await openComposerOnFirstBlock();
    // Opening a clean draft is not a design change: the page keeps its markup.
    expect(paragraph.getAttribute('class')).toBeNull();

    await changeCornerRadius();
    expect(paragraph.getAttribute('class')).toContain('rounded-2xl');
    expect(paragraph.getAttribute('data-vc-draft-preview')).toBe('true');

    await act(async () => {
      byText('Cancel')?.click();
    });
    expect(document.body.textContent).toContain('Discard unsaved changes?');
    await act(async () => {
      byText('Discard')?.click();
    });

    // Discard means discard, including on the page itself.
    expect(paragraph.getAttribute('class')).toBeNull();
    expect(paragraph.hasAttribute('data-vc-draft-preview')).toBe(false);
  });

  it('paints typed copy onto the block and takes it back on discard', async () => {
    await withPage();
    const paragraph = pageChildren().children[0] as HTMLElement;

    await openComposerOnFirstBlock();
    await changeComposerCopy('Fresh intro copy.');

    /*
     * The page is the preview, copy included. Typing alone must not restyle the
     * block: the design half of the draft is clean, so the paragraph keeps its
     * own (here, absent) classes while its sentence changes.
     */
    expect(paragraph.textContent).toBe('Fresh intro copy.');
    expect(paragraph.getAttribute('data-vc-draft-preview')).toBe('true');
    expect(paragraph.getAttribute('class')).toBeNull();
    expect(document.body.textContent).toContain('Previewing on the page');

    await act(async () => {
      byText('Cancel')?.click();
    });
    expect(document.body.textContent).toContain('Discard unsaved changes?');
    await act(async () => {
      byText('Discard')?.click();
    });

    expect(paragraph.textContent).toBe('Intro copy.');
    expect(paragraph.hasAttribute('data-vc-draft-preview')).toBe(false);
  });

  it('keeps the composer on the block it is editing when that block moves', async () => {
    /*
     * The panel used to address its block by index. Moving the block behind the
     * open panel then left the panel on the same index — now a different block —
     * so the next Apply wrote the draft onto a block the operator never opened,
     * and the draft that belonged to the moved block was rebuilt from the other
     * block's markup. The panel follows the block's identity, not its slot.
     */
    await withPage();
    const paragraph = pageChildren().children[0] as HTMLElement;

    await openComposerOnFirstBlock();
    await changeComposerCopy('Fresh intro copy.');
    // A design change as well as a copy change: the audit's failure was a draft
    // staying on an index, and a design landing on the wrong block is the
    // expensive version of that.
    await changeCornerRadius();
    expect(paragraph.textContent).toBe('Fresh intro copy.');
    expect(paragraph.getAttribute('class')).toContain('rounded-2xl');
    // Back to the copy tab so the panel still shows the draft that must follow
    // the block across the move.
    await act(async () => {
      byText('Content')?.click();
    });

    // The sidebar's Move down, which is the same document mutation the frame's
    // arrow key and the header's section move dispatch.
    const moveDown = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Move block Intro copy. down"]'
    );
    expect(moveDown).not.toBeNull();
    await act(async () => {
      moveDown?.click();
    });

    // The paragraph swapped with the form block, so it is #2 in the document.
    const panel = document.querySelector<HTMLElement>('aside[role="dialog"]');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('Block #2 ·');
    // Same block, same draft, same preview — design included.
    expect(composerCopy().textContent).toBe('Fresh intro copy.');
    expect(paragraph.textContent).toBe('Fresh intro copy.');
    expect(paragraph.getAttribute('class')).toContain('rounded-2xl');

    // Applying writes the draft onto the block that moved, not onto the block
    // that inherited its old index.
    await act(async () => {
      byText('Save Block')?.click();
    });
    expect(document.body.textContent).not.toContain('Visual Composer Inspector');
    expect(paragraph.textContent).toBe('Fresh intro copy.');

    // Save Block hands the block to the page; the page save writes it. The
    // payload is what proves the draft went to the block that moved rather than
    // to the block that inherited its old index.
    const saveButton = container.querySelector<HTMLButtonElement>(
      'button[title^="Write this document to Supabase"]'
    );
    expect(saveButton).not.toBeNull();
    await act(async () => {
      saveButton?.click();
    });
    const written = saveContent.mock.calls.at(-1)?.[0].body as string;
    expect(written).toContain('Fresh intro copy.');
    expect(written.indexOf('<form>')).toBeLessThan(written.indexOf('Fresh intro copy.'));
    expect(written.indexOf('Fresh intro copy.')).toBeLessThan(written.indexOf('Mission'));

    // The design landed on the moved paragraph's own root, and nowhere else.
    expect(written).toMatch(/<p[^>]*rounded-2xl[^>]*>Fresh intro copy\.<\/p>/);
    expect(written).not.toMatch(/<h2[^>]*rounded-2xl/);
  });
});
