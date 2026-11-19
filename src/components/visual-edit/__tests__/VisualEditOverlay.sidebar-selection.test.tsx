// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';
import {
  container,
  getContentBySlugForEdit,
  mount,
  pageChildren,
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

describe('VisualEditOverlay — sidebar and batch selection', () => {
  it('does not hijack interactive controls like tabs, audio players, or civic buttons into contentEditable', async () => {
    await withPage();

    const tabButton = document.createElement('button');
    tabButton.setAttribute('role', 'tab');
    tabButton.textContent = 'Agenda Tab';
    document.querySelector('main')?.appendChild(tabButton);

    await act(async () => {
      tabButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(tabButton.contentEditable).not.toBe('true');
    expect(container.querySelector('[data-inline-toolbar="true"]')).toBeNull();
  });

  it('renders the unified right sidebar instead of a bottom dock', async () => {
    await withPage();

    // The sidebar is an <aside> with role complementary — no bottom-bar element
    const sidebar = container.querySelector<HTMLElement>(
      'aside[aria-label="Visual Editor Toolbar"]'
    );
    expect(sidebar).not.toBeNull();

    // It is fixed to the right, not the bottom
    const classList = sidebar?.className ?? '';
    expect(classList).toContain('right-0');
    expect(classList).not.toContain('bottom-3');
    expect(classList).not.toContain('inset-x-3');
  });

  it('collapses the sidebar to an icon strip and restores it', async () => {
    await withPage();

    const sidebar = container.querySelector<HTMLElement>(
      'aside[aria-label="Visual Editor Toolbar"]'
    );
    expect(sidebar).not.toBeNull();

    // Expanded by default — collapse button is present
    const collapseBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse Visual Editor Sidebar"]'
    );
    expect(collapseBtn).not.toBeNull();

    await act(async () => {
      collapseBtn?.click();
    });

    // Collapsed: expand button appears, sidebar is narrower (w-12)
    const expandBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Expand Visual Editor Sidebar"]'
    );
    expect(expandBtn).not.toBeNull();

    const collapsedSidebar = container.querySelector<HTMLElement>(
      'aside[aria-label="Visual Editor Toolbar"]'
    );
    expect(collapsedSidebar?.className).toContain('w-12');

    // Expand again
    await act(async () => {
      expandBtn?.click();
    });

    const expandedSidebar = container.querySelector<HTMLElement>(
      'aside[aria-label="Visual Editor Toolbar"]'
    );
    expect(expandedSidebar?.className).toContain('w-72');
  });

  it('sidebar shows document title and saved/unsaved state', async () => {
    await withPage();

    const toolbar = container.querySelector('[data-testid="visual-edit-overlay"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar?.getAttribute('data-document-state')).toBe('ready');
    // The "saved" text comes from the sidebar's document info line
    expect(toolbar?.textContent).toContain('saved');
    // No unsaved indicator on a fresh load
    expect(toolbar?.textContent).not.toContain('unsaved changes');
  });

  it('reports a failed document read instead of presenting the DOM fallback as editable', async () => {
    renderPage(rendered);
    getContentBySlugForEdit.mockRejectedValue(new Error('database offline'));
    await mount();

    const toolbar = container.querySelector('[data-testid="visual-edit-overlay"]');
    expect(toolbar?.getAttribute('data-document-state')).toBe('degraded');

    const banner = container.querySelector<HTMLElement>('[data-testid="composer-document-error"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Document not loaded');

    // The canvas is read-only: no section action pills invite edits that can
    // only be refused.
    expect(container.querySelector('[role="toolbar"][aria-label^="Actions for"]')).toBeNull();

    const save = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim().startsWith('Connect')
    );
    expect(save?.disabled).toBe(true);
  });

  it('refuses structural edits while the saved document is unreadable', async () => {
    renderPage(rendered);
    getContentBySlugForEdit.mockRejectedValue(new Error('database offline'));
    await mount();
    toast.error.mockClear();

    const before = pageChildren().children.length;
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail: { blockIndex: 0 } })
      );
    });

    // The guard runs before the local commit, so the canvas cannot show a
    // deletion that autosave would have to refuse and roll back later.
    expect(pageChildren().children.length).toBe(before);
    expect(saveContent).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('could not be read'));
  });

  it('sidebar context zone switches to inline-edit mode on text click and back to default when dismissed', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    expect(heading).not.toBeNull();

    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    // Inline-edit zone is now active inside the sidebar
    const inlineZone = container.querySelector('[data-inline-toolbar="true"]');
    expect(inlineZone).not.toBeNull();
    expect(inlineZone?.getAttribute('aria-label')).toBe('Direct in-place text editor controls');

    // Cancel button dismisses the inline zone
    const cancelBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Cancel')
    );
    expect(cancelBtn).not.toBeNull();

    await act(async () => {
      cancelBtn?.click();
    });

    // Back to default context zone — no inline toolbar visible
    const inlineZoneAfter = container.querySelector('[data-inline-toolbar="true"]');
    expect(inlineZoneAfter).toBeNull();
  });

  it('refuses a region switch while an inline text edit is uncommitted', async () => {
    await withPage();
    const heading = document.querySelector<HTMLElement>('h2');
    expect(heading).not.toBeNull();
    const original = heading?.innerHTML;

    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[data-inline-toolbar="true"]')).not.toBeNull();

    await act(async () => {
      if (heading) {
        heading.innerHTML = 'Edited in place';
        heading.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
          detail: { regionId: 'about-mission' },
        })
      );
    });

    // The header selector fires the same event as the sidebar. The edit is still
    // in the DOM, not in `blocks`, so the switch must stop before it loads.
    expect(toast.info).toHaveBeenCalledWith(
      'Save or cancel the inline text edit before switching regions.'
    );
    expect(document.body.textContent).toContain('Edited in place');
    expect(container.querySelector('[data-inline-toolbar="true"]')).not.toBeNull();
    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');
    expect(new URLSearchParams(window.location.search).get('region')).toBeNull();

    const cancel = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-inline-toolbar] button')
    ).find((button) => button.textContent?.includes('Cancel'));
    expect(cancel).not.toBeUndefined();
    await act(async () => {
      cancel?.click();
    });
    expect(heading?.innerHTML).toBe(original);

    // Once the edit is explicitly cancelled, the same request is safe and
    // follows the normal region path.
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
    expect(getContentBySlugForEdit).toHaveBeenCalledWith('copy-about-mission');
    expect(new URLSearchParams(window.location.search).get('region')).toBe('about-mission');
  });

  it('selects two section chips and opens the composer in batch mode', async () => {
    await withPage();

    const chips = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[title^="Select this block"]')
    );
    expect(chips.length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      chips[0].click();
    });
    await act(async () => {
      chips[1].dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
      );
    });

    expect(document.body.textContent).toContain('2 blocks selected');

    const composerButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        'button[aria-label="Visual Composer Inspector"]'
      )
    );
    expect(composerButtons.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      composerButtons[0].click();
    });

    // The composer opened for a selected block, so both are the target.
    expect(document.body.textContent).toContain('2 blocks · batch styling');
    expect(document.body.textContent).toContain('Apply to 2 blocks');
    expect(
      Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Content'
      )
    ).toBeUndefined();
  });

  it('opens the batch from the selection bar in block mode, where the design tabs live', async () => {
    await withPage();

    const chips = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[title^="Select this block"]')
    );
    expect(chips.length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      chips[0].click();
    });
    await act(async () => {
      chips[1].dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
      );
    });

    const styleTogether = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Style together'
    );
    expect(styleTogether).toBeDefined();

    await act(async () => {
      styleTogether?.click();
    });

    // The tab strip only exists in block mode. Opening the batch in section
    // mode showed section controls and hid every design tab the batch is for.
    expect(document.body.textContent).toContain('2 blocks · batch styling');
    expect(
      Array.from(document.querySelectorAll('button')).some(
        (b) => b.textContent?.trim() === 'Box Model'
      )
    ).toBe(true);
  });

  it('refuses an anchor id another block already holds', async () => {
    // Block 2 is preserved markup that already owns `id="mission"`.
    const collisionBody = '<p class="cw">Intro copy.</p><div id="mission">Anchored</div>';
    renderPage(collisionBody);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: collisionBody,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    const openComposer = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Visual Composer Inspector"]'
    );
    expect(openComposer).not.toBeNull();
    await act(async () => {
      openComposer?.click();
    });

    // The Advanced tab carries the anchor field.
    await act(async () => {
      Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((b) => b.textContent?.trim() === 'Advanced')
        ?.click();
    });

    const anchorInput = document.getElementById('block-anchor-id-input') as HTMLInputElement | null;
    expect(anchorInput).not.toBeNull();
    if (!anchorInput) return;

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(anchorInput, 'mission');
      anchorInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // The conflict is visible while the id is being typed — before any click.
    // The panel reads the page's other ids, so it can say so without a save.
    expect(document.body.textContent).toContain('already used by another block');

    await act(async () => {
      Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((b) => b.textContent?.trim() === 'Save Block')
        ?.click();
    });

    // Refused, and named: a duplicate id breaks the #mission link and the
    // composer's own accessibility audit.
    const anchorErrors = toast.error.mock.calls
      .map((call) => String(call[0]))
      .filter((message) => message.includes('Anchor id'));
    expect(anchorErrors).toHaveLength(1);
    expect(anchorErrors[0]).toContain('mission');
    expect(anchorErrors[0]).toContain('block #2');

    // The panel survives the refusal with the operator's id still typed, so the
    // fix is an edit rather than a re-entry.
    expect(document.body.textContent).toContain('Visual Composer Inspector');
    expect(anchorInput.value).toBe('mission');
  });
  it('names the blocks a batch will style, not just how many', async () => {
    await withPage();

    const chips = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[title^="Select this block"]')
    );
    expect(chips.length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      chips[0].click();
    });
    await act(async () => {
      chips[1].dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
      );
    });

    const composer = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Visual Composer Inspector"]'
    );
    await act(async () => {
      composer?.click();
    });

    // The panel used to name only the count. A count is not a scope.
    const targets = Array.from(document.querySelectorAll('[data-testid="batch-target"]'));
    expect(targets).toHaveLength(2);
    expect(targets[0].textContent).toContain('Intro copy.');
    expect(targets[1].textContent).toContain('Mission');
  });

  it('locates the edited block without collapsing the batch selection', async () => {
    const scrollIntoView = vi.fn();
    const animated: { element: Element | null } = { element: null };
    const proto = Element.prototype as unknown as {
      animate?: (this: Element, keyframes: unknown, options?: unknown) => unknown;
    };
    const originalAnimate = proto.animate;
    const originalScroll = Element.prototype.scrollIntoView;

    // jsdom has neither, and the locate path requires an animated element.
    proto.animate = function (this: Element) {
      animated.element = this;
      return { cancel: () => {} };
    };
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;

    try {
      await withPage();

      const chips = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[title^="Select this block"]')
      );
      await act(async () => {
        chips[0].click();
      });
      await act(async () => {
        chips[1].dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
        );
      });

      const composer = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Visual Composer Inspector"]'
      );
      await act(async () => {
        composer?.click();
      });

      const locate = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Show this block on the page"]'
      );
      expect(locate).not.toBeNull();
      await act(async () => {
        locate?.click();
      });

      // The paragraph the composer was opened for, scrolled into view and
      // flashed — that is the block being edited, not an ordinal.
      expect(animated.element?.tagName).toBe('P');
      expect(scrollIntoView).toHaveBeenCalledTimes(1);

      // And the two-block selection is still a two-block selection: locating
      // is a view action, not `jumpTo` with its silent re-selection. A selected
      // chip announces the opposite action ("Deselect …"), which is how it is
      // addressed here — its title changes while the composer is open.
      expect(container.querySelectorAll('button[aria-label^="Deselect "]')).toHaveLength(2);
    } finally {
      proto.animate = originalAnimate;
      Element.prototype.scrollIntoView = originalScroll;
    }
  });

  it('walks the page from the composer without closing it', async () => {
    await withPage();

    const composer = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Visual Composer Inspector"]'
    );
    expect(composer).not.toBeNull();
    await act(async () => {
      composer?.click();
    });

    // Opened on the first frame: the paragraph at block 0.
    expect(document.body.textContent).toContain('Block #1 ·');
    const previous = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Previous block"]'
    );
    expect(previous?.disabled).toBe(true);

    await act(async () => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Next block"]')?.click();
    });
    expect(document.body.textContent).toContain('Block #2 ·');

    await act(async () => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Next block"]')?.click();
    });
    expect(document.body.textContent).toContain('Block #3 ·');
    expect(document.body.textContent).toContain('Mission');

    // The panel stayed open the whole way, and the last block is the end of it.
    expect(document.body.textContent).toContain('Visual Composer Inspector');
    expect(
      document.querySelector<HTMLButtonElement>('button[aria-label="Next block"]')?.disabled
    ).toBe(true);
  });
});
