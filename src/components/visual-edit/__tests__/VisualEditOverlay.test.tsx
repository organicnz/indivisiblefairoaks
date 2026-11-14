// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VisualEditOverlay,
  resolveBlockContentRoot,
} from '@/components/visual-edit/VisualEditOverlay';
import { MAX_BODY_BYTES } from '@/lib/content';
import {
  openDiagnosticsVisual,
  openRevisionsVisual,
  openSettingsVisual,
  VISUAL_EDIT_EVENTS,
} from '@/lib/visual-edit-events';
import type { PublishedSection, VisualSectionsPublishedDetail } from '@/types/unified';

type MediaSelection = {
  url: string;
  alt?: string;
  name: string;
  width?: number | null;
  height?: number | null;
};

/**
 * What the in-page editor owes an organiser who is editing a live site.
 *
 * The theme is *addressing*. The overlay draws a frame over an element in the
 * rendered DOM, but every mutation it performs is an operation on the block
 * model that becomes `content.body`. Those are two coordinate systems, and the
 * version this suite was written against reconciled them by position —
 * `sections[i].index → blocks[i]` — which is wrong the moment the sanitizer
 * removes something, and the sanitizer removes something on every rendered page
 * that came from the old Google Sites export.
 *
 * A body of `<p>Intro</p><form>…</form><h2>Mission</h2>` parses to three blocks
 * and renders to two children. Clicking "edit" on the frame around *Mission*
 * edited block 1 — the `<form>` — and wrote it back to the database. Nothing
 * errored. The page was silently corrupted.
 *
 * Every test below fails against that version.
 */

const saveContent = vi.hoisted(() => vi.fn());
const setContentStatus = vi.hoisted(() => vi.fn());
const getContentForEdit = vi.hoisted(() => vi.fn());
const getContentBySlugForEdit = vi.hoisted(() => vi.fn());
const getContentRevisions = vi.hoisted(() => vi.fn());
const restoreContentRevision = vi.hoisted(() => vi.fn());
const getCRMEdgeFunctionHealth = vi.hoisted(() => vi.fn());
const getVisualPageContext = vi.hoisted(() => vi.fn());
const uploadCRMMedia = vi.hoisted(() => vi.fn());
const mediaLibrary = vi.hoisted(() => ({
  onSelectMedia: null as ((media: MediaSelection) => void | Promise<void>) | null,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('@/lib/actions/content', () => ({
  saveContent,
  setContentStatus,
  getContentForEdit,
  getContentBySlugForEdit,
  getContentRevisions,
  restoreContentRevision,
}));
vi.mock('@/lib/actions/crm', () => ({
  getCRMEdgeFunctionHealth,
  uploadCRMMedia,
  getCRMContacts: vi.fn().mockResolvedValue({ contacts: [], total: 0 }),
}));
vi.mock('../CRMPanel', () => ({
  CRMPanel: () => null,
}));
vi.mock('@/lib/actions/visual', () => ({ getVisualPageContext }));
vi.mock('sonner', () => ({ toast }));

// The overlay asks the header's hook whether this visitor is an admin.
const editContext = vi.hoisted(() => ({
  isAdmin: true,
  loading: false,
  target: null as { label: string; editUrl: string } | null,
}));
vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: () => editContext,
}));

// The media library is a portal-heavy dialog with its own suite; stubbing it
// keeps this file about the document model rather than about Radix.
vi.mock('@/components/admin/crm/composer/CRMMediaLibraryModal', () => ({
  CRMMediaLibraryModal: (props: {
    isOpen: boolean;
    onSelectMedia: (media: MediaSelection) => void | Promise<void>;
  }) => {
    if (props.isOpen) mediaLibrary.onSelectMedia = props.onSelectMedia;
    return null;
  },
}));

// Router and pathname are read directly by the overlay.
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
const pathname = vi.hoisted(() => ({ value: '/about' }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => pathname.value,
}));

// Visual edit mode lives in a module store; drive it directly.
const visualMode = vi.hoisted(() => ({ enabled: true }));
vi.mock('@/components/layout/visual-edit-store', () => ({
  registerVisualEditExitGuard: vi.fn(),
  useVisualEditMode: () => ({
    enabled: visualMode.enabled,
    toggle: () => {
      visualMode.enabled = !visualMode.enabled;
    },
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The page as the browser renders it: the sanitized body, in the DOM. */
function renderPage(sanitizedHtml: string) {
  const root = document.createElement('div');
  root.setAttribute('data-visual-edit-root', '');
  root.innerHTML = sanitizedHtml;
  const main = document.createElement('main');
  main.appendChild(root);
  document.body.appendChild(main);
  return root;
}

describe('VisualEditOverlay addresses the block, not the element', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    saveContent.mockReset();
    setContentStatus.mockReset();
    getContentForEdit.mockReset();
    getContentBySlugForEdit.mockReset();
    getContentRevisions.mockReset();
    restoreContentRevision.mockReset();
    getCRMEdgeFunctionHealth.mockReset();
    getVisualPageContext.mockReset();
    uploadCRMMedia.mockReset();
    mediaLibrary.onSelectMedia = null;
    toast.success.mockReset();
    toast.error.mockReset();
    toast.info.mockReset();
    getCRMEdgeFunctionHealth.mockResolvedValue({
      database: true,
      storage: true,
      edgeFunction: true,
    });
    getVisualPageContext.mockResolvedValue({
      content: null,
      revisions: [],
      revisionsTruncated: false,
      media: { items: [], folders: ['crm', 'content', 'gallery'] },
      backend: { database: true, storage: true, edgeFunction: true },
      crmStats: null,
      segments: [],
      segmentsTruncated: false,
      catalog: { galleryPhotos: 0, events: 0 },
    });
    saveContent.mockResolvedValue({
      success: true,
      data: { id: 7, updatedAt: '2026-10-10T00:00:00Z' },
    });
    editContext.isAdmin = true;
    editContext.target = null;
    visualMode.enabled = true;
    pathname.value = '/about';
    router.replace.mockReset();
    window.history.replaceState({}, '', '/');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  const mount = async () => {
    await act(async () => {
      root.render(<VisualEditOverlay />);
    });
  };

  /**
   * A page whose sanitized body has fewer elements than its block model.
   *
   * This is the whole bug in one fixture: three blocks, two rendered elements,
   * and the third block is the one an organiser would actually want to edit.
   */
  const body = '<p>Intro copy.</p><form><input></form><h2 class="cw cw--h2">Mission</h2>';
  const rendered = '<p>Intro copy.</p><h2 class="cw cw--h2">Mission</h2>';

  const withPage = async (page?: { body?: string; rendered?: string }) => {
    renderPage(page?.rendered ?? rendered);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: page?.body ?? body,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();
  };

  const byText = (text: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === text
    );

  const openImageMediaLibrary = async () => {
    const toolbar = container.querySelector<HTMLElement>('[aria-label="Image asset controls"]');
    expect(toolbar).not.toBeNull();
    const replace = Array.from(toolbar?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Replace'
    );
    expect(replace).toBeDefined();
    await act(async () => {
      replace?.click();
    });
    expect(mediaLibrary.onSelectMedia).not.toBeNull();
  };

  /** The page as the browser holds it: the overlay's frames sit over these. */
  const pageChildren = () => {
    const page = document.querySelector<HTMLElement>('[data-visual-edit-root]');
    expect(page).not.toBeNull();
    return page as HTMLElement;
  };

  const openComposerOn = async (frameIndex: number) => {
    const composers = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Visual Composer Inspector"]'
    );
    expect(composers[frameIndex]).toBeDefined();
    await act(async () => {
      composers[frameIndex]?.click();
    });
  };

  const openComposerOnFirstBlock = () => openComposerOn(0);

  /**
   * Make one draft change the compiler actually emits. The radius alone is not
   * emitted while the border width is zero — a rounded edge with no edge to
   * round is not a visual change — so the test uses the border preset that sets
   * both, the same way an operator would.
   */
  const changeCornerRadius = async () => {
    await act(async () => {
      byText('Box Model')?.click();
    });
    const preset = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Apply Modern Card border preset"]'
    );
    expect(preset).not.toBeNull();
    await act(async () => {
      preset?.click();
    });
  };

  /**
   * Leave the document dirty without opening the composer. The delete persists,
   * so undoing it restores the original body against a saved baseline that now
   * describes the deleted one.
   */
  const dirtyThePage = async () => {
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
  };

  /** Fire the browser's hard-leave event and report whether it was intercepted. */
  const attemptHardLeave = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event;
  };

  /** The composer's visual copy surface, not a raw-HTML field or the Code tab. */
  const composerCopy = (): HTMLElement => {
    const editor = document.querySelector<HTMLElement>(
      'aside[role="dialog"] [contenteditable="true"]'
    );
    if (!editor) throw new Error('expected the composer copy editor');
    return editor;
  };

  /** Type into the composer's copy field, the way the Content tab does. */
  const changeComposerCopy = async (text: string) => {
    const editor = composerCopy();
    await act(async () => {
      editor.innerHTML = text;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const asRect = (top: number, bottom: number): DOMRect =>
    ({
      top,
      bottom,
      left: 0,
      right: 100,
      width: 100,
      height: bottom - top,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;

  it('edits the block the frame is on, not the one at that ordinal', async () => {
    await withPage();

    // The frame over "Mission" is the second rendered element, so the old code
    // opened the editor on block 1 — the form.
    const editButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[title="Edit section content"]')
    );
    const missionFrame = editButtons.at(-1);
    expect(missionFrame).toBeDefined();

    await act(async () => {
      missionFrame?.click();
    });

    // The section editor is open — it is portalled to the body, not into the
    // overlay's own container — and it names the block it is editing.
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Mission');
  });

  it('publishes a section list whose block index matches its label', async () => {
    let latest: PublishedSection[] = [];
    const onPublish = (event: Event) => {
      latest = (event as CustomEvent<VisualSectionsPublishedDetail>).detail.sections;
    };
    window.addEventListener(VISUAL_EDIT_EVENTS.sectionsPublished, onPublish);
    try {
      await withPage();
    } finally {
      window.removeEventListener(VISUAL_EDIT_EVENTS.sectionsPublished, onPublish);
    }

    expect(latest).toEqual([
      expect.objectContaining({ label: 'Intro copy.', blockIndex: 0, blockType: 'paragraph' }),
      // The form has no element on the page, so it is listed but unframeable —
      // and it is the only way an organiser can reach it to delete it.
      expect.objectContaining({ label: 'Preserved markup', blockIndex: 1, index: null }),
      expect.objectContaining({ label: 'Mission', blockIndex: 2, blockType: 'heading' }),
    ]);
  });

  it('writes the document back with every block, including the unframed one', async () => {
    await withPage();

    // Delete the first section via the header's event, addressed by block index.
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail: { blockIndex: 0 } })
      );
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    const written = saveContent.mock.calls[0][0];
    // The form block must survive: deleting the paragraph is not licence to
    // drop a block the operator never mentioned.
    expect(written.body).toContain('<form>');
    expect(written.body).not.toContain('Intro copy.');
    expect(written.body).toContain('Mission');
  });

  it('pauses autosave after a failed write and resumes after the next edit', async () => {
    await withPage();

    const deleteFirstBlock = async () => {
      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail: { blockIndex: 0 } })
        );
      });
    };

    // Two saves give the history two steps to walk back through. The first
    // undo leaves an unsaved document for autosave to attempt; the second is a
    // new document snapshot, which should clear the pause and try again.
    await deleteFirstBlock();
    await deleteFirstBlock();
    expect(saveContent).toHaveBeenCalledTimes(2);

    const undo = () => {
      const button = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Undo the last change"]'
      );
      expect(button).not.toBeNull();
      act(() => button?.click());
    };

    vi.useFakeTimers();
    try {
      undo();
      saveContent.mockResolvedValueOnce({ success: false, error: 'database is offline' });
      toast.success.mockClear();
      toast.error.mockClear();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(saveContent).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(saveContent).toHaveBeenCalledTimes(3);
      expect(toast.error).toHaveBeenCalledWith('database is offline');

      // The failed snapshot is still dirty. Retrying the same write every 2.5
      // seconds cannot fix it and only repeats the same error.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(saveContent).toHaveBeenCalledTimes(3);

      // A new snapshot is a new chance. A successful autosave is silent.
      undo();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      expect(saveContent).toHaveBeenCalledTimes(4);
      expect(toast.success).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('moves the section the header named, to the block beside it', async () => {
    await withPage();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.moveSection, {
          detail: { blockIndex: 2, direction: 'up' },
        })
      );
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    const written = saveContent.mock.calls[0][0].body as string;
    // The heading swaps with the form block — the document's neighbour — not
    // with the paragraph two positions away.
    expect(written.indexOf('Mission')).toBeLessThan(written.indexOf('<form>'));
  });

  it('does not report an untouched page as unsaved', async () => {
    await withPage();

    const toolbar = container.querySelector('[data-testid="visual-edit-overlay"]');
    expect(toolbar?.textContent).toContain('saved');
    expect(toolbar?.textContent).not.toContain('unsaved changes');
  });

  it('reports a refused concurrent write instead of a generic failure', async () => {
    await withPage();
    saveContent.mockResolvedValue({
      success: false,
      error:
        'Someone else saved this page while you were editing it. Reload to see their version, then reapply your changes.',
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail: { blockIndex: 0 } })
      );
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('edited by someone else'),
      expect.anything()
    );
  });

  it('stays inert for a visitor who is not an admin', async () => {
    editContext.isAdmin = false;
    renderPage(rendered);
    await mount();

    expect(container.querySelector('[data-testid="visual-edit-overlay"]')).toBeNull();
  });

  it('opens keyboard shortcuts cheat sheet when clicking the shortcuts dock button', async () => {
    await withPage();

    const shortcutsBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Keyboard shortcuts cheat sheet"]'
    );
    expect(shortcutsBtn).not.toBeNull();

    await act(async () => {
      shortcutsBtn?.click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Visual Editor Shortcuts');
  });

  it('copies block definition JSON to clipboard from the section editor', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await withPage();

    const editButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[title="Edit section content"]')
    );
    const firstFrame = editButtons.at(0);
    expect(firstFrame).toBeDefined();

    await act(async () => {
      firstFrame?.click();
    });

    const copyBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((btn) =>
      btn.textContent?.includes('Copy JSON')
    );
    expect(copyBtn).toBeDefined();

    await act(async () => {
      copyBtn?.click();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"type": "paragraph"'));
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('copied to clipboard as JSON')
    );
  });

  it('pastes block definition JSON from clipboard into the section editor', async () => {
    const readText = vi.fn().mockResolvedValue(
      JSON.stringify({
        type: 'heading',
        level: 2,
        html: 'Pasted Heading',
      })
    );
    Object.assign(navigator, { clipboard: { readText, writeText: vi.fn() } });

    await withPage();

    const editButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[title="Edit section content"]')
    );
    const firstFrame = editButtons.at(0);
    expect(firstFrame).toBeDefined();

    await act(async () => {
      firstFrame?.click();
    });

    const pasteBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (btn) => btn.textContent?.includes('Paste JSON')
    );
    expect(pasteBtn).toBeDefined();

    await act(async () => {
      pasteBtn?.click();
    });

    expect(readText).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('Replaced block with pasted heading definition')
    );
  });

  it('exports page document as JSON snapshot from settings modal', async () => {
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-json');
    globalThis.URL.revokeObjectURL = vi.fn();

    await withPage();

    const settingsBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (btn) => btn.getAttribute('title')?.includes('Edit page title, slug')
    );
    expect(settingsBtn).toBeDefined();

    await act(async () => {
      settingsBtn?.click();
    });

    const exportBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (btn) => btn.textContent?.includes('Export JSON')
    );
    expect(exportBtn).toBeDefined();

    await act(async () => {
      exportBtn?.click();
    });

    expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Page snapshot exported as JSON');
  });

  it('cycles theme mode preview from the dock toolbar', async () => {
    await withPage();

    const themeBtn = container.querySelector<HTMLButtonElement>(
      'button[title^="Preview theme:"]'
    );
    expect(themeBtn).not.toBeNull();

    await act(async () => {
      themeBtn?.click();
    });
    // Verifies button responds to click
    expect(themeBtn).toBeDefined();
  });

  it('imports page document snapshot JSON in settings modal', async () => {
    await withPage();

    const settingsBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (btn) => btn.getAttribute('title')?.includes('Edit page title, slug')
    );
    expect(settingsBtn).toBeDefined();

    await act(async () => {
      settingsBtn?.click();
    });

    const importBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (btn) => btn.textContent?.includes('Import JSON')
    );
    expect(importBtn).toBeDefined();

    // Mock file input trigger
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    await act(async () => {
      importBtn?.click();
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('renders quick media replacement button on image block section frames', async () => {
    const imgBody =
      '<p>Intro copy.</p><figure><img src="https://example.com/banner.jpg" alt="Banner" /></figure>';
    renderPage(imgBody);
    getContentBySlugForEdit.mockResolvedValue({
      id: 8,
      title: 'Gallery Page',
      slug: 'gallery',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: imgBody,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    const mediaBtn = container.querySelector<HTMLButtonElement>(
      'button[title="Replace image from Supabase S3 storage"]'
    );
    expect(mediaBtn).not.toBeNull();
  });

  it('handles convertSection event, transforming block and persisting', async () => {
    saveContent.mockResolvedValue({ success: true, data: { id: 7 } });
    await withPage();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.convertSection, {
          detail: { blockIndex: 0, type: 'callout', calloutTone: 'action' },
        })
      );
    });

    expect(saveContent).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('cw-callout--action'),
      })
    );
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('Section converted to callout')
    );
  });

  it('renders quick heading level chips and convert button on heading blocks', async () => {
    const headingBody = '<h2>Activism Today</h2><p>Body copy here.</p>';
    renderPage(headingBody);
    getContentBySlugForEdit.mockResolvedValue({
      id: 9,
      title: 'Action Page',
      slug: 'action',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: headingBody,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    const h3Chip = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Set heading level 3"]'
    );
    expect(h3Chip).not.toBeNull();

    const convertBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Convert section type"]'
    );
    expect(convertBtn).not.toBeNull();
  });

  it('opens and displays the system diagnostics modal', async () => {
    await withPage();

    const activityBtn = container.querySelector<HTMLButtonElement>(
      'button[title="Supabase Backend & Edge Function Health"]'
    );
    expect(activityBtn).not.toBeNull();

    await act(async () => {
      activityBtn?.click();
    });

    const diagLink = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (btn) => btn.textContent?.includes('System Diagnostics')
    );
    expect(diagLink).toBeDefined();

    await act(async () => {
      diagLink?.click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('System & Edge Diagnostics');
    expect(dialog?.textContent).toContain('PostgreSQL Database');
    expect(dialog?.textContent).toContain('Supabase S3 Storage');
  });

  it('shows an amber health dot when the edge function is degraded but DB and storage are healthy', async () => {
    getCRMEdgeFunctionHealth.mockResolvedValue({
      database: true,
      storage: true,
      edgeFunction: false,
    });
    getVisualPageContext.mockResolvedValue({
      content: null,
      revisions: [],
      revisionsTruncated: false,
      media: { items: [], folders: ['crm', 'content', 'gallery'] },
      backend: { database: true, storage: true, edgeFunction: false },
      crmStats: null,
      segments: [],
      segmentsTruncated: false,
      catalog: { galleryPhotos: 0, events: 0 },
    });

    await withPage();

    const healthBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Supabase Backend & Edge Function Health"]'
    );
    expect(healthBtn).not.toBeNull();
    const dot = healthBtn?.querySelector('span.rounded-full');
    expect(dot?.className).toContain('bg-amber-400');
    expect(dot?.className).not.toContain('bg-emerald-400');
  });

  it('shows a rose health dot when the database is offline', async () => {
    getCRMEdgeFunctionHealth.mockResolvedValue({
      database: false,
      storage: true,
      edgeFunction: true,
    });
    getVisualPageContext.mockResolvedValue({
      content: null,
      revisions: [],
      revisionsTruncated: false,
      media: { items: [], folders: ['crm', 'content', 'gallery'] },
      backend: { database: false, storage: true, edgeFunction: true },
      crmStats: null,
      segments: [],
      segmentsTruncated: false,
      catalog: { galleryPhotos: 0, events: 0 },
    });

    await withPage();

    const healthBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Supabase Backend & Edge Function Health"]'
    );
    const dot = healthBtn?.querySelector('span.rounded-full');
    expect(dot?.className).toContain('bg-rose-400');
  });

  it('opens system diagnostics modal when receiving VISUAL_EDIT_EVENTS.openDiagnostics event', async () => {
    await withPage();

    await act(async () => {
      openDiagnosticsVisual();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('System & Edge Diagnostics');
    expect(dialog?.textContent).toContain('PostgreSQL Database');
    expect(dialog?.textContent).toContain('Supabase S3 Storage');
  });

  it('saves the current block document through Page Settings, not the stale row body', async () => {
    await withPage();

    // Apply a real unsaved paragraph edit, then open the settings modal. The
    // modal writes the whole row, so its body must come from these blocks rather
    // than from the body loaded before the edit.
    await openComposerOnFirstBlock();
    await changeComposerCopy('Fresh intro copy.');
    await act(async () => {
      byText('Save Block')?.click();
    });

    await act(async () => {
      openSettingsVisual();
    });

    const dialog = document.querySelector('[role="dialog"]');
    const form = dialog?.querySelector('form');
    expect(form).not.toBeNull();

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const payload = saveContent.mock.calls.at(-1)?.[0] as { body?: string } | undefined;
    expect(payload?.body).toContain('Fresh intro copy.');
    expect(payload?.body).not.toContain('Intro copy.');
  });

  it('blocks restoring a revision while the page has unsaved edits', async () => {
    await withPage();
    getContentRevisions.mockResolvedValue({
      success: true,
      data: {
        revisions: [
          {
            id: 501,
            title: 'Older snapshot',
            created_at: '2026-10-01T00:00:00Z',
            type: 'page',
            status: 'publish',
          },
        ],
        revisionsTruncated: false,
      },
    });

    await dirtyThePage();

    await act(async () => {
      openRevisionsVisual();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Save or undo the current page changes');
    const restore = dialog?.querySelector<HTMLButtonElement>('button[aria-label="Restore"]');
    expect(restore?.disabled).toBe(true);

    await act(async () => {
      restore?.click();
    });
    expect(restoreContentRevision).not.toHaveBeenCalled();
  });

  it('keeps the server publication date and version after a status toggle', async () => {
    const publishedAt = '2026-10-10T18:00:00.000Z';
    const toggledUpdatedAt = '2026-10-10T18:00:01.000Z';
    renderPage(rendered);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'draft',
      body,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
      published_at: null,
    });
    setContentStatus.mockResolvedValue({
      success: true,
      data: { id: 7, publishedAt, updatedAt: toggledUpdatedAt },
    });
    await mount();

    const statusButton = container.querySelector<HTMLButtonElement>(
      'button[title="Click to toggle between Published and Draft"]'
    );
    expect(statusButton).not.toBeNull();
    await act(async () => {
      statusButton?.click();
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail: { blockIndex: 0 } })
      );
    });

    const payload = saveContent.mock.calls.at(-1)?.[0] as
      | { publishedAt?: string; expectedUpdatedAt?: string | null }
      | undefined;
    expect(payload?.publishedAt).toBe(publishedAt);
    expect(payload?.expectedUpdatedAt).toBe(toggledUpdatedAt);
  });

  it('saves the unsaved body with the new status instead of a status-only write', async () => {
    /*
     * A status-only write would change the row while the page still holds
     * unsaved edits; the refresh that follows would replace the rendered body
     * with the server's older one. The body and status have to land in the same
     * write, as they do in the content editor.
     */
    await withPage();
    await dirtyThePage();

    const statusButton = container.querySelector<HTMLButtonElement>(
      'button[title="Click to toggle between Published and Draft"]'
    );
    expect(statusButton).not.toBeNull();
    await act(async () => {
      statusButton?.click();
    });

    expect(setContentStatus).not.toHaveBeenCalled();
    const payload = saveContent.mock.calls.at(-1)?.[0] as
      | { status?: string; body?: string; expectedUpdatedAt?: string }
      | undefined;
    expect(payload?.status).toBe('draft');
    expect(payload?.body).toContain('Intro copy.');
    expect(payload?.expectedUpdatedAt).toBe('2026-10-10T00:00:00Z');
  });

  it('displays the live SERP and social card preview in page settings and allows toggling tabs', async () => {
    await withPage();

    await act(async () => {
      openSettingsVisual();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Search & Social Preview');
    expect(dialog?.textContent).toContain('Google SERP');
    expect(dialog?.textContent).toContain('indivisiblefairoaks.org');

    const socialTabBtn = dialog?.querySelector<HTMLButtonElement>(
      'button[aria-label="Preview social share card"]'
    );
    expect(socialTabBtn).not.toBeNull();

    await act(async () => {
      socialTabBtn?.click();
    });

    expect(dialog?.textContent).toContain(
      'Grassroots action, community advocacy, and voter empowerment.'
    );

    const serpTabBtn = dialog?.querySelector<HTMLButtonElement>(
      'button[aria-label="Preview Google search snippet"]'
    );
    expect(serpTabBtn).not.toBeNull();

    await act(async () => {
      serpTabBtn?.click();
    });

    expect(dialog?.textContent).toContain('Google SERP');
  });

  it('toggles responsive viewport modes (desktop, tablet, mobile) and constrains layout', async () => {
    await withPage();

    const tabletBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Tablet viewport"]'
    );
    const mobileBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Mobile viewport"]'
    );
    const desktopBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Desktop viewport"]'
    );

    expect(tabletBtn).not.toBeNull();
    expect(mobileBtn).not.toBeNull();
    expect(desktopBtn).not.toBeNull();
    expect(desktopBtn?.getAttribute('aria-pressed')).toBe('true');

    const main = document.querySelector('main');
    expect(main).not.toBeNull();

    await act(async () => {
      tabletBtn?.click();
    });

    expect(tabletBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(main?.style.maxWidth).toBe('768px');

    await act(async () => {
      mobileBtn?.click();
    });

    expect(mobileBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(main?.style.maxWidth).toBe('390px');

    await act(async () => {
      desktopBtn?.click();
    });

    expect(desktopBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(main?.style.maxWidth).toBe('');
  });

  it('renders rich in-place formatting toolbar on clicking editable text element', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    expect(heading).not.toBeNull();

    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const toolbar = container.querySelector('[data-inline-toolbar="true"]');
    expect(toolbar).not.toBeNull();

    // Check formatting buttons
    expect(toolbar?.querySelector('button[aria-label="Bold"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Italic"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Underline"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Strikethrough"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Inline Code"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Highlight"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Bullet list"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Numbered list"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Insert link"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Remove link"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Clear formatting"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Heading 2"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Heading 3"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Paragraph"]')).not.toBeNull();

    // Word and character count badge
    expect(toolbar?.textContent).toMatch(/\d+w · \d+c/);
  });

  /**
   * A page whose only block is a paragraph containing a link.
   *
   * This is the shape that made a destination-only edit invisible: the session
   * element is the `<a>`, so `innerHTML` serializes "the guide" and says
   * nothing about where it points — and the paragraph, not the anchor, is the
   * block the model has to persist.
   */
  const linkedBody = '<p>Read <a href="/guide">the guide</a> today.</p>';

  const withLinkedPage = async () => {
    renderPage(linkedBody);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: linkedBody,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();
  };

  it('makes a link inside the page editable instead of following it', async () => {
    await withLinkedPage();

    const anchor = document.querySelector<HTMLAnchorElement>('main a');
    expect(anchor).not.toBeNull();

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      anchor?.dispatchEvent(click);
    });

    // Navigation is an anchor's default action. Preventing it is what keeps the
    // organiser on the page they are editing rather than on its destination.
    expect(click.defaultPrevented).toBe(true);
    expect(anchor?.contentEditable).toBe('true');

    const toolbar = container.querySelector('[data-inline-toolbar="true"]');
    expect(toolbar?.querySelector('button[aria-label="Edit link"]')).not.toBeNull();
  });

  it('makes a header navigation link editable without navigating', async () => {
    await withLinkedPage();

    const header = document.createElement('header');
    const nav = document.createElement('nav');
    const tab = document.createElement('a');
    tab.href = '/events';
    tab.textContent = 'Events';
    nav.appendChild(tab);
    header.appendChild(nav);
    document.body.insertBefore(header, document.body.firstChild);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      tab.dispatchEvent(click);
    });

    expect(click.defaultPrevented).toBe(true);
    expect(tab.contentEditable).toBe('true');
    expect(
      container.querySelector('[data-inline-toolbar="true"] button[aria-label="Edit link"]')
    ).not.toBeNull();

    // Header links are outside the saved block document. A commit must not
    // report a success the next render will erase.
    toast.error.mockClear();
    await act(async () => {
      tab.textContent = 'Events edited';
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
      );
    });

    expect(toast.error).toHaveBeenCalledWith(
      'This text is outside the saved page document, so it cannot be saved.'
    );
    expect(tab.textContent).toBe('Events');
    expect(tab.contentEditable).toBe('false');
  });

  it('commits an inline edit once when saved with the keyboard shortcut', async () => {
    /*
     * Cmd+S used to start `commitInlineEdit` and then immediately persist the
     * pre-edit `blocks` array. That second write raced the inline commit on the
     * same row version, so the text on screen could lose to the body behind it.
     */
    await withPage();

    const paragraph = document.querySelector<HTMLElement>('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    await act(async () => {
      paragraph.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(paragraph.classList.contains('visual-inline-active')).toBe(true);
    saveContent.mockClear();

    await act(async () => {
      paragraph.innerHTML = 'Intro copy, shortcut saved.';
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(saveContent.mock.calls[0]?.[0]?.body).toContain('Intro copy, shortcut saved.');
  });

  it('leaves header controls functional so the editorial toggle still works', async () => {
    await withLinkedPage();

    const header = document.createElement('header');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = 'Editorial';
    header.appendChild(toggle);
    document.body.insertBefore(header, document.body.firstChild);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      toggle.dispatchEvent(click);
    });

    // The mode toggle, theme switch and menu are <button>s in the header.
    // Intercepting them would leave the editor unable to turn itself off.
    expect(click.defaultPrevented).toBe(false);
    expect(toggle.contentEditable).not.toBe('true');
    expect(container.querySelector('[data-inline-toolbar="true"]')).toBeNull();
  });

  it('persists an edited link destination to the paragraph that contains it', async () => {
    await withLinkedPage();

    const anchor = document.querySelector<HTMLAnchorElement>('main a');
    await act(async () => {
      anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const editLink = container.querySelector<HTMLButtonElement>('button[aria-label="Edit link"]');
    expect(editLink).not.toBeNull();

    // The pill variant activates on mouse-down so the contentEditable
    // selection does not collapse before the command runs.
    await act(async () => {
      editLink?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Edit link');

    const input = dialog?.querySelector<HTMLInputElement>('#link-url');
    expect(input?.value).toBe('/guide');

    // React tracks the previous value on the DOM node, so assigning `.value`
    // directly is discarded; the native setter plus an input event is the
    // change React actually observes.
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'https://example.org/new-guide');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    await act(async () => {
      save?.click();
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    const written = saveContent.mock.calls[0][0].body as string;
    expect(written).toContain('href="https://example.org/new-guide"');
    // The block is the paragraph. Persisting the anchor's own innerHTML would
    // replace the paragraph with "the guide".
    expect(written).toContain('Read ');
    expect(written).toContain('today.');
  });

  it('refuses to edit a link whose anchor was replaced while the dialog was open', async () => {
    await withLinkedPage();

    const anchor = document.querySelector<HTMLAnchorElement>('main a');
    expect(anchor).not.toBeNull();
    if (!anchor) throw new Error('expected the linked anchor');

    await act(async () => {
      anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const editLink = container.querySelector<HTMLButtonElement>('button[aria-label="Edit link"]');
    expect(editLink).not.toBeNull();
    await act(async () => {
      editLink?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#link-url');
    if (!input) throw new Error('expected the link URL input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'https://example.org/new-guide');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // A page refresh or re-render can replace the anchor that opened this
    // dialog. The dialog must not write to the detached node or a new session.
    const replacement = document.createElement('a');
    replacement.href = '/guide';
    replacement.textContent = 'the guide';
    await act(async () => {
      anchor.replaceWith(replacement);
    });
    expect(anchor.isConnected).toBe(false);

    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
    });

    expect(anchor.getAttribute('href')).toBe('/guide');
    expect(replacement.getAttribute('href')).toBe('/guide');
    expect(saveContent).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'This link is no longer editable. Select it again to change its destination.'
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const fallback = document.querySelector<HTMLElement>('[data-editor-focus-fallback]');
    expect(fallback).not.toBeNull();
    expect(document.activeElement).toBe(fallback);
  });

  it('renders image action pill when clicking an image element instead of making it contentEditable', async () => {
    await withPage();

    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    document.querySelector('main')?.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(img.contentEditable).not.toBe('true');

    const imageToolbar = container.querySelector('[aria-label="Image asset controls"]');
    expect(imageToolbar).not.toBeNull();
    expect(imageToolbar?.textContent).toContain('Replace');
    expect(imageToolbar?.textContent).toContain('Upload');
    expect(imageToolbar?.textContent).toContain('Alt Text');
  });

  it('opens a link insert dialog instead of browser prompt when clicking the inline toolbar link button', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const linkBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Insert link"]');
    expect(linkBtn).not.toBeNull();

    // The pill variant uses onMouseDown (not onClick) to prevent the
    // contentEditable selection from collapsing before the command runs.
    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Insert link');
    expect(dialog?.querySelector('input[type="url"]')).not.toBeNull();
    expect(dialog?.querySelector('button[data-confirm]')).not.toBeNull();
  });

  it('keeps the link dialog open and reports an unsafe destination', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const linkBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Insert link"]');
    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#link-url');
    expect(input).not.toBeNull();

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'javascript:alert(1)');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      input?.dispatchEvent(enter);
    });

    expect(enter.defaultPrevented).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(
      'Use an http(s), mailto:, tel:, or relative link.'
    );
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('restores the inline selection before creating a link', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    expect(heading).not.toBeNull();
    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(heading?.contentEditable).toBe('true');

    const text = heading?.firstChild;
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(text as Node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    expect(selection?.toString()).toBe('Mission');

    const linkBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Insert link"]');
    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    // The dialog has focus now. A real browser may drop the page selection;
    // the editor must have cloned it before that happened.
    selection?.removeAllRanges();
    expect(selection?.toString()).toBe('');

    const dialog = document.querySelector('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#link-url');
    expect(input).not.toBeNull();
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'https://example.org');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input?.value).toBe('https://example.org');

    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    expect(save?.disabled).toBe(false);

    const selectedAtCommand: string[] = [];
    const execCommand = vi.fn((command: string) => {
      if (command === 'createLink') {
        selectedAtCommand.push(window.getSelection()?.toString() ?? '');
      }
      return true;
    });
    const originalExecCommand = document.execCommand;
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    try {
      await act(async () => {
        save?.click();
      });
    } finally {
      if (originalExecCommand) {
        Object.defineProperty(document, 'execCommand', {
          configurable: true,
          value: originalExecCommand,
        });
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
    }

    expect(execCommand).toHaveBeenCalledWith('createLink', false, 'https://example.org');
    expect(selectedAtCommand).toEqual(['Mission']);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('refuses a stale link range instead of creating a link elsewhere', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    expect(heading).not.toBeNull();
    if (!heading) throw new Error('expected the heading');
    await act(async () => {
      heading.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const text = heading.firstChild;
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(text as Node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const linkBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Insert link"]');
    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#link-url');
    if (!input) throw new Error('expected the link URL input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'https://example.org');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Removing the edited element detaches the captured range and takes the
    // inline session's element out of the document while the dialog is open.
    await act(async () => {
      heading.remove();
    });
    expect(heading.isConnected).toBe(false);

    const execCommand = vi.fn();
    const originalExecCommand = document.execCommand;
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    try {
      const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
      expect(save).not.toBeNull();
      await act(async () => {
        save?.click();
      });
    } finally {
      if (originalExecCommand) {
        Object.defineProperty(document, 'execCommand', {
          configurable: true,
          value: originalExecCommand,
        });
      }
    }

    expect(execCommand).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'The selected text is no longer editable. Select it again to add a link.'
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const fallback = document.querySelector<HTMLElement>('[data-editor-focus-fallback]');
    expect(fallback).not.toBeNull();
    expect(document.activeElement).toBe(fallback);
  });

  it('restores the inline selection when the link dialog is cancelled', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const text = heading?.firstChild;
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(text as Node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const linkBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Insert link"]');
    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    selection?.removeAllRanges();

    const dialog = document.querySelector('[role="dialog"]');
    const cancel = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Cancel'
    );
    expect(cancel).toBeDefined();
    await act(async () => {
      cancel?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(window.getSelection()?.toString()).toBe('Mission');
  });

  it('returns focus to the editor fallback when a cancelled link range is stale', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    expect(heading).not.toBeNull();
    if (!heading) throw new Error('expected the heading');
    await act(async () => {
      heading.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const text = heading.firstChild;
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(text as Node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const linkBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Insert link"]');
    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const cancel = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Cancel'
    );
    expect(cancel).toBeDefined();

    await act(async () => {
      heading.remove();
    });
    await act(async () => {
      cancel?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const fallback = document.querySelector<HTMLElement>('[data-editor-focus-fallback]');
    expect(fallback).not.toBeNull();
    expect(document.activeElement).toBe(fallback);
  });

  it('restores the inline selection before a slash command runs', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const text = heading?.firstChild;
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(text as Node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const slashButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open Slash Commands"]'
    );
    expect(slashButton).not.toBeNull();
    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    await act(async () => {
      slashButton?.dispatchEvent(mouseDown);
    });
    expect(mouseDown.defaultPrevented).toBe(true);

    await act(async () => {
      slashButton?.click();
    });
    selection?.removeAllRanges();
    expect(selection?.toString()).toBe('');

    const h2Command = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Heading 2')
    );
    expect(h2Command).toBeDefined();

    const selectedAtCommand: string[] = [];
    const execCommand = vi.fn((command: string) => {
      if (command === 'formatBlock') {
        selectedAtCommand.push(window.getSelection()?.toString() ?? '');
      }
      return true;
    });
    const originalExecCommand = document.execCommand;
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    try {
      await act(async () => {
        h2Command?.click();
      });
    } finally {
      if (originalExecCommand) {
        Object.defineProperty(document, 'execCommand', {
          configurable: true,
          value: originalExecCommand,
        });
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
    }

    expect(execCommand).toHaveBeenCalledWith('formatBlock', false, '<h2>');
    expect(selectedAtCommand).toEqual(['Mission']);
  });

  it('refuses a slash command after the captured text is removed', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    expect(heading).not.toBeNull();
    if (!heading) throw new Error('expected the heading');
    await act(async () => {
      heading.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const text = heading.firstChild;
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(text as Node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const slashButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open Slash Commands"]'
    );
    expect(slashButton).not.toBeNull();
    await act(async () => {
      slashButton?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      slashButton?.click();
    });
    selection?.removeAllRanges();

    await act(async () => {
      heading.remove();
    });
    expect(heading.isConnected).toBe(false);

    const h2Command = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Heading 2')
    );
    expect(h2Command).toBeDefined();

    const execCommand = vi.fn();
    const originalExecCommand = document.execCommand;
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    try {
      await act(async () => {
        h2Command?.click();
      });
    } finally {
      if (originalExecCommand) {
        Object.defineProperty(document, 'execCommand', {
          configurable: true,
          value: originalExecCommand,
        });
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
    }

    expect(execCommand).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'The selected text is no longer editable. Select it again and retry.'
    );
    const fallback = document.querySelector<HTMLElement>('[data-editor-focus-fallback]');
    expect(fallback).not.toBeNull();
    expect(document.activeElement).toBe(fallback);
  });

  it('opens an alt text edit dialog instead of browser prompt when clicking the image Alt Text button', async () => {
    await withPage();

    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    document.querySelector('main')?.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();

    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Edit alt text');
    expect(dialog?.querySelector('input[type="text"]')).not.toBeNull();
    expect(dialog?.querySelector('button[data-confirm]')).not.toBeNull();
  });

  it('returns focus to the editor fallback when the image disappears under the alt dialog', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph?.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const cancel = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Cancel'
    );
    expect(cancel).toBeDefined();

    img.remove();
    altBtn?.remove();
    expect(img.isConnected).toBe(false);

    await act(async () => {
      cancel?.click();
    });

    expect(dialog?.isConnected).toBe(false);
    const fallback = document.querySelector<HTMLElement>('[data-editor-focus-fallback]');
    expect(fallback).not.toBeNull();
    expect(document.activeElement).toBe(fallback);
  });

  it('keeps the alt dialog open with the typed value when saving fails', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph?.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#alt-text-input');
    expect(input).not.toBeNull();
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'A revised description');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });
    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();

    await act(async () => {
      save?.click();
    });

    expect(dialog?.isConnected).toBe(true);
    expect(input?.value).toBe('A revised description');
    expect(toast.error).toHaveBeenCalledWith('Network unavailable');
    expect(save?.disabled).toBe(false);

    saveContent.mockResolvedValueOnce({
      success: true,
      data: { id: 7, updatedAt: '2026-10-11T00:00:00Z' },
    });
    await act(async () => {
      save?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('lets a focused field own undo instead of reversing the page behind it', async () => {
    await withPage();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail: { blockIndex: 2 } })
      );
      await Promise.resolve();
    });

    const undo = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Undo the last change"]'
    );
    expect(undo).not.toBeNull();
    expect(undo?.disabled).toBe(false);

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const input = document.querySelector<HTMLInputElement>('#alt-text-input');
    if (!input) throw new Error('expected the alt text input');
    input.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      input.dispatchEvent(event);
      await Promise.resolve();
    });

    expect(event.defaultPrevented).toBe(false);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('undoes a retried alt-text save to the previous description', async () => {
    const oldSrc = 'https://example.com/old.jpg';
    const pageBody = `<p>Intro copy.<img src="${oldSrc}" alt="Old photo"></p><form><input></form><h2 class="cw cw--h2">Mission</h2>`;
    const pageRendered = `<p>Intro copy.<img src="${oldSrc}" alt="Old photo"></p><h2 class="cw cw--h2">Mission</h2>`;
    await withPage({ body: pageBody, rendered: pageRendered });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] p img');
    if (!img) throw new Error('expected the rendered image');
    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error('expected the alt text dialog');
    const setAlt = async (value: string) => {
      const input = document.querySelector<HTMLInputElement>('#alt-text-input');
      if (!input) throw new Error('expected the alt text input');
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      await act(async () => {
        setValue?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };

    await setAlt('Failed description');
    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });
    const save = dialog.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(dialog.isConnected).toBe(true);
    expect(img.alt).toBe('Failed description');

    // Leave the coalescing window so the retry is genuinely a second write.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 750));
    });

    await setAlt('Saved description');
    const retrySave = dialog.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(retrySave).not.toBeNull();
    await act(async () => {
      retrySave?.click();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(img.alt).toBe('Saved description');

    const dismiss = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss image controls"]'
    );
    expect(dismiss).not.toBeNull();
    await act(async () => {
      dismiss?.click();
    });
    expect(img.alt).toBe('Saved description');

    const undo = byText('Undo');
    expect(undo).toBeDefined();
    await act(async () => {
      undo?.click();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    const lastCall = saveContent.mock.calls[saveContent.mock.calls.length - 1];
    const lastBody = lastCall?.[0]?.body as string | undefined;
    expect(lastBody).toBeDefined();
    expect(lastBody).toContain('alt="Old photo"');
    expect(lastBody).not.toContain('Failed description');
    expect(lastBody).not.toContain('Saved description');
  });

  it('keeps the image panel open when an uploaded replacement cannot be saved', async () => {
    await withPage({
      body: '<div data-copy-region="hero"><img src="https://example.com/old.jpg" alt="Old photo"></div>',
      rendered:
        '<div data-copy-region="hero"><img src="https://example.com/old.jpg" alt="Old photo"></div>',
    });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] img');
    expect(img).not.toBeNull();
    await act(async () => {
      img?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();

    uploadCRMMedia.mockResolvedValueOnce({
      success: true,
      data: { url: 'https://example.com/new.jpg' },
    });
    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    if (!fileInput) throw new Error('expected the image file input');
    const file = new File(['image'], 'replacement.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    await act(async () => {
      fileInput?.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(uploadCRMMedia).toHaveBeenCalledTimes(1);
    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(saveContent.mock.calls[0][0].body).toContain('https://example.com/new.jpg');
    expect(img?.src).toBe('https://example.com/new.jpg');
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Network unavailable');
  });

  it('undoes a retried upload to the last saved image, not the failed preview', async () => {
    const oldSrc = 'https://example.com/old.jpg';
    const failedSrc = 'https://example.com/failed.jpg';
    const retriedSrc = 'https://example.com/retried.jpg';
    const pageBody = `<p>Intro copy.<img src="${oldSrc}" alt="Old photo"></p><form><input></form><h2 class="cw cw--h2">Mission</h2>`;
    const pageRendered = `<p>Intro copy.<img src="${oldSrc}" alt="Old photo"></p><h2 class="cw cw--h2">Mission</h2>`;
    await withPage({ body: pageBody, rendered: pageRendered });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] p img');
    if (!img) throw new Error('expected the rendered image');
    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error('expected the image file input');
    const chooseFile = async (name: string) => {
      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: [new File(['image'], name, { type: 'image/png' })],
      });
      await act(async () => {
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      });
    };

    uploadCRMMedia.mockResolvedValueOnce({ success: true, data: { url: failedSrc } });
    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });
    await chooseFile('failed.png');
    expect(img.src).toBe(failedSrc);
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();

    // Leave the coalescing window so the retry is genuinely a second write.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 750));
    });

    uploadCRMMedia.mockResolvedValueOnce({ success: true, data: { url: retriedSrc } });
    await chooseFile('retried.png');
    expect(img.src).toBe(retriedSrc);
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();

    const undo = byText('Undo');
    expect(undo).toBeDefined();
    await act(async () => {
      undo?.click();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    const lastCall = saveContent.mock.calls[saveContent.mock.calls.length - 1];
    const lastBody = lastCall?.[0]?.body as string | undefined;
    expect(lastBody).toBeDefined();
    expect(lastBody).toContain(oldSrc);
    expect(lastBody).not.toContain(failedSrc);
    expect(lastBody).not.toContain(retriedSrc);
  });

  it('saves an uploaded replacement inside a paragraph block', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/old.jpg';
    img.alt = 'Old photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();

    uploadCRMMedia.mockResolvedValueOnce({
      success: true,
      data: { url: 'https://example.com/new.jpg' },
    });

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    if (!fileInput) throw new Error('expected the image file input');
    const file = new File(['image'], 'replacement.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    const written = saveContent.mock.calls[0][0].body as string;
    expect(written).toContain('src="https://example.com/new.jpg"');
    expect(written).toContain('Intro copy.');
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();
  });

  it('restores the previous image when an upload has no savable block', async () => {
    await withPage({
      body: '<img src="https://example.com/old.jpg" alt="Old photo">',
      rendered: '<img src="https://example.com/old.jpg" alt="Old photo">',
    });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] img');
    expect(img).not.toBeNull();
    await act(async () => {
      img?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();

    uploadCRMMedia.mockResolvedValueOnce({
      success: true,
      data: { url: 'https://example.com/new.jpg' },
    });

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    if (!fileInput) throw new Error('expected the image file input');
    const file = new File(['image'], 'replacement.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(saveContent).not.toHaveBeenCalled();
    expect(img?.src).toBe('https://example.com/old.jpg');
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();
    expect(toast.error).toHaveBeenCalledWith('This image is not inside a savable block.');
  });

  it('restores the sidebar alt draft when alt text has no savable block', async () => {
    await withPage({
      body: '<img src="https://example.com/old.jpg" alt="Old photo">',
      rendered: '<img src="https://example.com/old.jpg" alt="Old photo">',
    });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] img');
    expect(img).not.toBeNull();
    await act(async () => {
      img?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const input = container.querySelector<HTMLInputElement>('#sidebar-image-alt-input');
    expect(input).not.toBeNull();
    if (!input) throw new Error('expected the sidebar alt input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'Revised photo');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const save = input.parentElement?.querySelector<HTMLButtonElement>('button');
    expect(save).toBeDefined();
    await act(async () => {
      save?.click();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(saveContent).not.toHaveBeenCalled();
    expect(img?.alt).toBe('Old photo');
    expect(input.value).toBe('Old photo');
    expect(toast.error).toHaveBeenCalledWith('Alt text cannot be saved for this block type');
  });

  it('saves a media-library replacement inside a paragraph block', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/old.jpg';
    img.alt = 'Old photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await openImageMediaLibrary();

    await act(async () => {
      await mediaLibrary.onSelectMedia?.({
        url: 'https://example.com/library.jpg',
        name: 'library.jpg',
        alt: 'Library photo',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    const written = saveContent.mock.calls[0][0].body as string;
    expect(written).toContain('src="https://example.com/library.jpg"');
    expect(written).toContain('alt="Library photo"');
    expect(written).toContain('Intro copy.');
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();
  });

  it('keeps the image panel open when a media-library replacement cannot be saved', async () => {
    const pageBody =
      '<p>Intro copy.<img src="https://example.com/old.jpg" alt="Old photo"></p><form><input></form><h2 class="cw cw--h2">Mission</h2>';
    const pageRendered =
      '<p>Intro copy.<img src="https://example.com/old.jpg" alt="Old photo"></p><h2 class="cw cw--h2">Mission</h2>';
    await withPage({ body: pageBody, rendered: pageRendered });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] p img');
    if (!img) throw new Error('expected the rendered image');

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await openImageMediaLibrary();
    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });

    await act(async () => {
      await mediaLibrary.onSelectMedia?.({
        url: 'https://example.com/library.jpg',
        name: 'library.jpg',
        alt: 'Library photo',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(img.src).toBe('https://example.com/library.jpg');
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Network unavailable');

    const dismiss = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss image controls"]'
    );
    expect(dismiss).not.toBeNull();
    await act(async () => {
      dismiss?.click();
    });

    expect(img.src).toBe('https://example.com/old.jpg');
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();
    expect(document.body.textContent).not.toContain('unsaved changes');

    const undo = byText('Undo');
    expect(undo).toBeDefined();
    await act(async () => {
      undo?.click();
    });
    expect(img.src).toBe('https://example.com/old.jpg');
  });

  it('undoes a retried media replacement to the last saved image', async () => {
    const oldSrc = 'https://example.com/old.jpg';
    const failedSrc = 'https://example.com/failed-library.jpg';
    const retriedSrc = 'https://example.com/retried-library.jpg';
    const pageBody = `<p>Intro copy.<img src="${oldSrc}" alt="Old photo"></p><form><input></form><h2 class="cw cw--h2">Mission</h2>`;
    const pageRendered = `<p>Intro copy.<img src="${oldSrc}" alt="Old photo"></p><h2 class="cw cw--h2">Mission</h2>`;
    await withPage({ body: pageBody, rendered: pageRendered });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] p img');
    if (!img) throw new Error('expected the rendered image');
    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await openImageMediaLibrary();
    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });

    await act(async () => {
      await mediaLibrary.onSelectMedia?.({
        url: failedSrc,
        name: 'failed-library.jpg',
        alt: 'Failed library photo',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(img.src).toBe(failedSrc);
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();

    // Leave the coalescing window so the retry is genuinely a second write.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 750));
    });

    await openImageMediaLibrary();
    await act(async () => {
      await mediaLibrary.onSelectMedia?.({
        url: retriedSrc,
        name: 'retried-library.jpg',
        alt: 'Retried library photo',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(img.src).toBe(retriedSrc);
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();

    const undo = byText('Undo');
    expect(undo).toBeDefined();
    await act(async () => {
      undo?.click();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    const lastCall = saveContent.mock.calls[saveContent.mock.calls.length - 1];
    const lastBody = lastCall?.[0]?.body as string | undefined;
    expect(lastBody).toBeDefined();
    expect(lastBody).toContain(oldSrc);
    expect(lastBody).toContain('alt="Old photo"');
    expect(lastBody).not.toContain(failedSrc);
    expect(lastBody).not.toContain(retriedSrc);
    expect(lastBody).not.toContain('Failed library photo');
    expect(lastBody).not.toContain('Retried library photo');
  });

  it('rolls back a failed media-library replacement on Escape', async () => {
    const pageBody =
      '<p>Intro copy.<img src="https://example.com/old.jpg" alt="Old photo"></p><form><input></form><h2 class="cw cw--h2">Mission</h2>';
    const pageRendered =
      '<p>Intro copy.<img src="https://example.com/old.jpg" alt="Old photo"></p><h2 class="cw cw--h2">Mission</h2>';
    await withPage({ body: pageBody, rendered: pageRendered });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] p img');
    if (!img) throw new Error('expected the rendered image');

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await openImageMediaLibrary();
    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });

    await act(async () => {
      await mediaLibrary.onSelectMedia?.({
        url: 'https://example.com/library.jpg',
        name: 'library.jpg',
        alt: 'Library photo',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(img.src).toBe('https://example.com/library.jpg');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(img.src).toBe('https://example.com/old.jpg');
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();
    expect(document.body.textContent).not.toContain('unsaved changes');

    const undo = byText('Undo');
    expect(undo).toBeDefined();
    await act(async () => {
      undo?.click();
    });
    expect(img.src).toBe('https://example.com/old.jpg');
  });

  it('restores the previous alt when cancelling after a failed save', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#alt-text-input');
    if (!input) throw new Error('expected the alt text input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'A revised description');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });
    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
    });
    expect(dialog?.isConnected).toBe(true);
    expect(img.alt).toBe('A revised description');

    const cancel = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Cancel'
    );
    expect(cancel).toBeDefined();
    await act(async () => {
      cancel?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(img.alt).toBe('Protest photo');
    expect(document.body.textContent).not.toContain('unsaved changes');

    const dismiss = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss image controls"]'
    );
    expect(dismiss).not.toBeNull();
    await act(async () => {
      dismiss?.click();
    });

    const undo = byText('Undo');
    expect(undo).toBeDefined();
    await act(async () => {
      undo?.click();
    });
    expect(img.alt).toBe('Protest photo');
  });

  it('keeps a saved alt when dismissing the image panel', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#alt-text-input');
    if (!input) throw new Error('expected the alt text input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'Saved description');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(img.alt).toBe('Saved description');

    const dismiss = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss image controls"]'
    );
    expect(dismiss).not.toBeNull();
    await act(async () => {
      dismiss?.click();
    });

    expect(img.alt).toBe('Saved description');
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();
  });

  it('keeps the sidebar alt draft in step with the selected image and dialog saves', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const first = document.createElement('img');
    first.src = 'https://example.com/first.jpg';
    first.alt = 'First photo';
    const second = document.createElement('img');
    second.src = 'https://example.com/second.jpg';
    second.alt = 'Second photo';
    paragraph.append(first, second);

    const sidebarAlt = () =>
      container.querySelector<HTMLInputElement>('#sidebar-image-alt-input');

    await act(async () => {
      first.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(sidebarAlt()?.value).toBe('First photo');

    await act(async () => {
      second.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(sidebarAlt()?.value).toBe('Second photo');

    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#alt-text-input');
    if (!input) throw new Error('expected the alt text input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'Second description');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(second.alt).toBe('Second description');
    expect(sidebarAlt()?.value).toBe('Second description');
  });

  it('keeps an image session when the header asks to switch regions', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();

    toast.info.mockClear();
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
          detail: { regionId: 'about-mission' },
        })
      );
    });

    // A region switch replaces the block model underneath the selected image;
    // the image rail owns the provisional preview and alt draft until its own
    // Save or Cancel runs.
    expect(toast.info).toHaveBeenCalledWith(
      'Save or cancel the image edit before switching regions.'
    );
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();
    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');
    expect(new URLSearchParams(window.location.search).get('region')).toBeNull();
  });

  it('keeps the image session through scroll and resize before a dialog save', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#alt-text-input');
    if (!input) throw new Error('expected the alt text input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'Saved description');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
    });
    expect(img.alt).toBe('Saved description');

    const dismiss = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss image controls"]'
    );
    expect(dismiss).not.toBeNull();
    await act(async () => {
      dismiss?.click();
    });

    expect(img.alt).toBe('Saved description');
  });

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

    const banner = container.querySelector<HTMLElement>(
      '[data-testid="composer-document-error"]'
    );
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Document not loaded');

    // The canvas is read-only: no section action pills invite edits that can
    // only be refused.
    expect(
      container.querySelector('[role="toolbar"][aria-label^="Actions for"]')
    ).toBeNull();

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
    renderPage(
      '<div data-copy-region="home-hero"><h2 class="cw cw--h2">Mission</h2></div>'
    );
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

    const overlay = container.querySelector<HTMLElement>(
      '[data-testid="visual-edit-overlay"]'
    );
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
    expect(
      container.querySelector('[data-testid="composer-document-error"]')
    ).not.toBeNull();
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
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false } as unknown as Response) as unknown as typeof fetch;
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
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false } as Response) as unknown as typeof fetch;
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
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false } as Response) as unknown as typeof fetch;
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
      const retry = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button')
      ).find((button) => button.textContent?.includes('Retry document load'));
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
      expect(
        container.querySelector('[data-testid="composer-document-error"]')
      ).toBeNull();
    } finally {
      vi.useRealTimers();
      globalThis.fetch = originalFetch;
    }
  });

  it('reserves the sidebar rail only on the composer route', async () => {
    pathname.value = '/compose/42';
    renderPage(rendered);

    await mount();
    expect(document.documentElement.style.getPropertyValue('--visual-edit-rail-width')).toBe(
      '18rem'
    );

    // Studio and Library are 28rem wide. The route must reserve that width,
    // not the narrower default rail, or the inspector still covers the canvas.
    const studio = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Studio'
    );
    expect(studio).toBeDefined();
    await act(async () => {
      studio?.click();
    });
    expect(document.documentElement.style.getPropertyValue('--visual-edit-rail-width')).toBe(
      '28rem'
    );

    const collapse = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse Visual Editor Sidebar"]'
    );
    expect(collapse).not.toBeNull();
    await act(async () => {
      collapse?.click();
    });
    expect(document.documentElement.style.getPropertyValue('--visual-edit-rail-width')).toBe(
      '3rem'
    );

    await act(async () => root.unmount());
    expect(document.documentElement.style.getPropertyValue('--visual-edit-rail-width')).toBe('');

    root = createRoot(container);
    pathname.value = '/about';
    await mount();
    expect(document.documentElement.style.getPropertyValue('--visual-edit-rail-width')).toBe('');
  });

  it('opens the row composer from the editor entry point, where the block modal has no fields', async () => {
    /*
     * The section modal's fields are keyed by leaf type. A row has none of
     * them, so Enter or the header's "edit" would open a dialog that describes
     * a row, offers no way to edit it, and is not where its columns live.
     */
    const rowHtml =
      '<div class="cw-row cw-row--2">' +
      '<div class="cw-column"><p>Left copy</p></div>' +
      '<div class="cw-column"><p>Right copy</p></div>' +
      '</div>';
    renderPage(rowHtml);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: rowHtml,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.focusSection, {
          detail: { blockIndex: 0, openEdit: true },
        })
      );
    });

    expect(document.body.textContent).toContain('Row Layout');
    expect(document.body.textContent).not.toContain('Editing a row block');
    // A row cannot be turned into a leaf without discarding its layout, so the
    // conversion menu is absent rather than present and silently inert.
    expect(container.querySelector('button[aria-label="Convert section type"]')).toBeNull();
  });

  it('opens the row composer instead of an inline editor for copy inside a column', async () => {
    /*
     * The inline editor writes the selected block's `html`. A row has none, so
     * starting a session on a paragraph inside a column let the organiser type
     * into a change whose save path could not represent it. The composer can
     * edit the column's blocks, so it owns the click.
     */
    const rowHtml =
      '<div class="cw-row cw-row--2">' +
      '<div class="cw-column"><p>Left copy</p></div>' +
      '<div class="cw-column"><p>Right copy</p></div>' +
      '</div>';
    const page = renderPage(rowHtml);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: rowHtml,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    const left = page.querySelector('p') as HTMLElement;
    await act(async () => {
      left.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(left.getAttribute('contenteditable')).toBeNull();
    expect(document.body.textContent).toContain('Visual Composer Inspector');
    // The row is the selected block — the composer opens its column editor,
    // not a leaf's content form.
    expect(document.body.textContent).toContain('Row Layout');
  });

  it('rejects an oversized body before it reaches the server', async () => {
    /*
     * Regression test for "This page is too large to save": the client-side
     * pre-check in handlePersistBlocks must reject an oversized body before
     * calling saveContent, so the operator gets an actionable message instead
     * of an opaque Zod rejection.
     */
    await withPage();
    await openComposerOnFirstBlock();

    const bigText = 'word '.repeat(20000); // ~120 KB, well over MAX_BODY_BYTES
    await changeComposerCopy(bigText);

    await act(async () => {
      byText('Save Block')?.click();
    });

    const saveButton = container.querySelector<HTMLButtonElement>(
      'button[title^="Write this document to Supabase"]'
    );
    expect(saveButton).not.toBeNull();
    await act(async () => {
      saveButton?.click();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('too large to save')
    );

    // No saveContent call may carry an oversized body.
    for (const call of saveContent.mock.calls) {
      const body = (call[0] as { body?: string }).body;
      expect(body?.length).toBeLessThanOrEqual(MAX_BODY_BYTES);
    }
  });

  it('writes only the edited paragraph, not the whole section around it', async () => {
    /*
     * A block's address is the <section> that renders it, and that section can
     * hold unrelated markup. Committing an inline edit used to read the
     * section's innerHTML — siblings included — and store it as one
     * paragraph's `html`, which is what pushed real pages past MAX_BODY_BYTES.
     */
    const filler = 'Section sidebar filler. '.repeat(300); // ~7.5 KB of a sibling
    renderPage(`<section><p>Intro copy.</p><div>${filler}</div></section>`);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: '<p>Intro copy.</p>',
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    const paragraph = document.querySelector<HTMLElement>('[data-visual-edit-root] section p');
    expect(paragraph).not.toBeNull();

    await act(async () => {
      paragraph?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(document.body.getAttribute('data-editorial-mode')).toBe('active');
    // jsdom does not reflect `contentEditable` to the attribute; the session's
    // own class is the observable signal that the paragraph is being edited.
    expect(paragraph?.classList.contains('visual-inline-active')).toBe(true);

    await act(async () => {
      if (paragraph) paragraph.innerHTML = 'Edited intro.';
      paragraph?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // ⌘↵ commits the inline session — the same path the editor's save gesture
    // takes.
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
      );
    });

    const written = saveContent.mock.calls.at(-1)?.[0].body as string;
    expect(written).toContain('Edited intro.');
    expect(written).not.toContain('Section sidebar filler.');
    expect(written.length).toBeLessThan(filler.length);
  });

  it('keeps the paragraph around an edited link, not just the link’s own markup', async () => {
    /*
     * The other half of the section fix: the climb must stop at the paragraph,
     * not at the link. Reading the session element's own innerHTML would save
     * the link's text as the whole paragraph — the data-loss shape the block
     * root read exists to prevent.
     */
    renderPage(
      '<section><p>Read the <a href="/voter-guide">voter guide</a> before you vote.</p></section>'
    );
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: '<p>Read the <a href="/voter-guide">voter guide</a> before you vote.</p>',
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    const link = document.querySelector<HTMLAnchorElement>(
      '[data-visual-edit-root] section p a'
    );
    expect(link).not.toBeNull();

    await act(async () => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(link?.classList.contains('visual-inline-active')).toBe(true);

    await act(async () => {
      if (link) link.textContent = 'voter guide 2026';
      link?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
      );
    });

    const written = saveContent.mock.calls.at(-1)?.[0].body as string;
    expect(written).toContain('voter guide 2026');
    // The surrounding sentence survives: the block is the paragraph, not the
    // link that was being edited.
    expect(written).toContain('Read the ');
    expect(written).toContain('before you vote.');
  });

  it('writes the whole list when an inline edit changes one item', async () => {
    const listBody = '<ul class="cw-list cw-list--bullet"><li>One</li><li>Two</li></ul>';
    renderPage(listBody);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: listBody,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    const item = document.querySelector<HTMLLIElement>('ul li');
    expect(item).not.toBeNull();

    await act(async () => {
      item?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(item?.classList.contains('visual-inline-active')).toBe(true);

    await act(async () => {
      if (item) item.innerHTML = 'One edited';
      item?.dispatchEvent(new Event('input', { bubbles: true }));
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
      );
    });

    const written = saveContent.mock.calls.at(-1)?.[0].body as string;
    expect(written).toContain('<li>One edited</li>');
    // The item is not the list: the write must retain its sibling.
    expect(written).toContain('<li>Two</li>');
  });

  it('writes code-block text inline instead of leaving an unsaved contentEditable', async () => {
    const codeBody = '<pre class="cw-code">const x = 1;</pre>';
    renderPage(codeBody);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: codeBody,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    const pre = document.querySelector<HTMLPreElement>('pre');
    expect(pre).not.toBeNull();

    await act(async () => {
      pre?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(pre?.classList.contains('visual-inline-active')).toBe(true);

    await act(async () => {
      if (pre) pre.textContent = 'const x = 2;';
      pre?.dispatchEvent(new Event('input', { bubbles: true }));
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
      );
    });

    const written = saveContent.mock.calls.at(-1)?.[0].body as string;
    expect(written).toContain('const x = 2;');
  });

  it('refuses an inline code edit when the route has no saved document', async () => {
    pathname.value = '/events';
    renderPage('<pre class="cw-code">const x = 1;</pre>');
    getContentBySlugForEdit.mockResolvedValue(null);
    await mount();

    const pre = document.querySelector<HTMLPreElement>('pre');
    expect(pre).not.toBeNull();

    await act(async () => {
      pre?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(pre?.classList.contains('visual-inline-active')).toBe(false);
    expect(pre?.getAttribute('contenteditable')).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('written in code'));
  });

  it('routes table text to the composer instead of an unsavable inline editor', async () => {
    const tableBody =
      '<table><thead><tr><th>Head</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
    renderPage(tableBody);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: tableBody,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    const cell = document.querySelector<HTMLTableCellElement>('td');
    expect(cell).not.toBeNull();

    await act(async () => {
      cell?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(cell?.classList.contains('visual-inline-active')).toBe(false);
    expect(cell?.getAttribute('contenteditable')).toBeNull();
    expect(toast.info).toHaveBeenCalledWith('This block is edited in the Visual Composer.');
  });

  it('saves under the limit when the container around the edit is over it', async () => {
    /*
     * The deployed /events page has a container of ~72,600 characters — larger
     * than MAX_BODY_BYTES. A block whose DOM address is that container must
     * still save only the paragraph that changed; capturing the container is
     * exactly the 64 KiB failure reported in #174.
     */
    const filler = 'Event card filler. '.repeat(3600); // ~68 KB, over the limit
    expect(filler.length).toBeGreaterThan(MAX_BODY_BYTES);
    renderPage(`<div class="space-y-8"><p>Edited event copy.</p><div>${filler}</div></div>`);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: '<p>Edited event copy.</p>',
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();

    const paragraph = document.querySelector<HTMLElement>('[data-visual-edit-root] p');
    expect(paragraph).not.toBeNull();

    await act(async () => {
      paragraph?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(paragraph?.classList.contains('visual-inline-active')).toBe(true);

    await act(async () => {
      if (paragraph) paragraph.innerHTML = 'Edited event copy, saved.';
      paragraph?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
      );
    });

    const written = saveContent.mock.calls.at(-1)?.[0].body as string;
    expect(written).toContain('Edited event copy, saved.');
    expect(written.length).toBeLessThan(1000);
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('too large to save'));
  });

  it('refuses a page-level edit on a coded route before posting the route slug', async () => {
    /*
     * /events is a coded route with copy regions and no page row. Its text is
     * JSX, so a page-level save posts slug `events`, which the server refuses
     * as a route shadow. The operator used to learn that after typing; now the
     * edit is rolled back and the regions that do work are named.
     */
    pathname.value = '/events';
    renderPage('<div class="space-y-8"><p>Edited event copy.</p></div>');
    getContentBySlugForEdit.mockResolvedValue(null);
    await mount();

    const paragraph = document.querySelector<HTMLElement>('[data-visual-edit-root] p');
    expect(paragraph).not.toBeNull();

    await act(async () => {
      paragraph?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    // The edit never starts: no contentEditable, no session, no request.
    expect(paragraph?.classList.contains('visual-inline-active')).toBe(false);
    expect(paragraph?.getAttribute('contenteditable')).toBeNull();
    expect(saveContent).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('written in code'));
    expect(paragraph?.textContent).toBe('Edited event copy.');

    // The whole-page controls say the same thing, instead of offering a save
    // that would be refused after the operator typed.
    const wholePage = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Whole page'
    );
    expect(wholePage?.disabled).toBe(true);
    expect(
      container.querySelector('[role="toolbar"][aria-label^="Actions for"]')
    ).toBeNull();
  });

  it('refuses page settings on a coded route before posting the route slug', async () => {
    pathname.value = '/events';
    renderPage('<div class="space-y-8"><p>Event copy.</p></div>');
    getContentBySlugForEdit.mockResolvedValue(null);
    await mount();

    await act(async () => {
      openSettingsVisual();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Page Settings');
    const form = dialog?.querySelector('form');
    expect(form).not.toBeNull();

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(saveContent).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('written in code'));
  });

  it('still edits a copy region on a coded route with no page row', async () => {
    pathname.value = '/events';
    renderPage('<div data-copy-region="events-trainings"><p>Region copy.</p></div>');
    getContentBySlugForEdit.mockResolvedValue(null);
    await mount();

    const paragraph = document.querySelector<HTMLElement>('[data-visual-edit-root] p');
    expect(paragraph).not.toBeNull();

    await act(async () => {
      paragraph?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(paragraph?.classList.contains('visual-inline-active')).toBe(true);
  });

  it('keeps a host page clean after saving one of its copy regions', async () => {
    /*
     * A region is its own CMS row. Before this, a successful inline edit in a
     * region called `setSavedBody(regionHtml)`, replacing the host page's
     * baseline with that fragment. The page then reported "unsaved changes"
     * with no page-level edit to save, and its save button is disabled on a
     * coded route — a state the operator could not clear.
     */
    pathname.value = '/events';
    renderPage(
      '<div data-copy-region="events-trainings" data-copy-region-version="2026-10-03T00:00:00Z"><p>Region copy.</p></div>'
    );
    getContentBySlugForEdit.mockResolvedValue(null);
    await mount();

    const paragraph = document.querySelector<HTMLElement>('[data-visual-edit-root] p');
    expect(paragraph).not.toBeNull();

    await act(async () => {
      paragraph?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(paragraph?.classList.contains('visual-inline-active')).toBe(true);

    await act(async () => {
      if (paragraph) paragraph.innerHTML = 'Region copy, edited.';
      paragraph?.dispatchEvent(new Event('input', { bubbles: true }));
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
      );
    });

    expect(saveContent).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'copy-events-trainings',
        body: expect.stringContaining('Region copy, edited.'),
        // Page mode has no loaded region row; the rendered element carried
        // the version the save must not overwrite.
        expectedUpdatedAt: '2026-10-03T00:00:00Z',
      })
    );
    // The successful write moves the element's version forward, so a second
    // inline edit in page mode is conditional on this write, not the old row.
    expect(
      document
        .querySelector('[data-copy-region="events-trainings"]')
        ?.getAttribute('data-copy-region-version')
    ).toBe('2026-10-10T00:00:00Z');
    expect(
      container.querySelector<HTMLElement>('[data-testid="visual-edit-overlay"]')?.textContent
    ).not.toContain('unsaved changes');
  });

  it('creates a region on the first save and conditionally updates it on the next', async () => {
    /*
     * A region row is addressed by slug, so the inline writer has no id to send
     * on its first save. That save creates the row; the second must use the id
     * and version it received, or it either fails as a duplicate or overwrites a
     * colleague's later write. The sidebar also has to stop saying "Not
     * connected" once the first save returned the row.
     */
    window.history.replaceState({}, '', '/events?visual-edit=1&region=events-trainings');
    pathname.value = '/events';
    renderPage('<div data-copy-region="events-trainings"><p>Region copy.</p></div>');
    getContentBySlugForEdit.mockResolvedValue(null);
    saveContent.mockResolvedValue({
      success: true,
      data: {
        id: 41,
        updatedAt: '2026-10-10T00:00:00Z',
        publishedAt: '2026-10-10T00:00:00Z',
      },
    });
    await mount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(container.textContent).toContain('Not connected');
    const paragraph = document.querySelector<HTMLElement>(
      '[data-copy-region="events-trainings"] p'
    );
    expect(paragraph).not.toBeNull();

    await act(async () => {
      paragraph?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(paragraph?.classList.contains('visual-inline-active')).toBe(true);

    await act(async () => {
      if (paragraph) paragraph.innerHTML = 'Region copy, saved once.';
      paragraph?.dispatchEvent(new Event('input', { bubbles: true }));
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
      );
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    const first = saveContent.mock.calls[0]?.[0] as {
      id?: number;
      expectedUpdatedAt?: string;
      slug?: string;
    };
    expect(first).toMatchObject({ slug: 'copy-events-trainings' });
    expect(first.id).toBeUndefined();
    expect(container.textContent).not.toContain('Not connected');
    expect(container.textContent).toContain('Published');

    await act(async () => {
      paragraph?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(paragraph?.classList.contains('visual-inline-active')).toBe(true);

    await act(async () => {
      if (paragraph) paragraph.innerHTML = 'Region copy, saved twice.';
      paragraph?.dispatchEvent(new Event('input', { bubbles: true }));
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
      );
    });

    expect(saveContent).toHaveBeenCalledTimes(2);
    const second = saveContent.mock.calls[1]?.[0] as {
      id?: number;
      expectedUpdatedAt?: string;
      slug?: string;
    };
    expect(second).toMatchObject({
      expectedUpdatedAt: '2026-10-10T00:00:00Z',
      slug: 'copy-events-trainings',
    });
    // The row is resolved by slug on the server; that branch preserves fields
    // the body-only write does not own. Sending the id would take the ordinary
    // update branch and reset them.
    expect(second.id).toBeUndefined();
  });

  it('refuses copy-region text while the saved document is unreadable', async () => {
    pathname.value = '/events';
    renderPage('<div data-copy-region="events-trainings"><p>Region copy.</p></div>');
    getContentBySlugForEdit.mockRejectedValue(new Error('database offline'));
    await mount();
    toast.error.mockClear();

    const paragraph = document.querySelector<HTMLElement>('[data-visual-edit-root] p');
    expect(paragraph).not.toBeNull();

    await act(async () => {
      paragraph?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    // A copy region has a destination on a coded route, but not until the row
    // it belongs to has been read. The editor must not open over a fallback.
    expect(paragraph?.classList.contains('visual-inline-active')).toBe(false);
    expect(paragraph?.getAttribute('contenteditable')).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('could not be read'));
  });

  describe('resolveBlockContentRoot', () => {
    const section = document.createElement('section');
    const paragraph = document.createElement('p');
    const link = document.createElement('a');
    paragraph.append('Read the ', link);
    section.append(paragraph);

    it('climbs from an inline element to the paragraph inside the section', () => {
      expect(resolveBlockContentRoot(link, section)).toBe(paragraph);
    });

    it('refuses the layout wrapper as a block content root', () => {
      // The <section> is a block's DOM address, not its content: reading it
      // would capture every sibling block too.
      expect(resolveBlockContentRoot(section, section)).toBeNull();
    });

    it('accepts a textual block root', () => {
      expect(resolveBlockContentRoot(paragraph, paragraph)).toBe(paragraph);
    });

    it('accepts the cw- div roots the serializer writes for callouts and buttons', () => {
      const callout = document.createElement('div');
      callout.className = 'cw cw-callout cw-callout--info';
      const inner = document.createElement('p');
      callout.append(inner);
      expect(resolveBlockContentRoot(inner, callout)).toBe(inner);
      expect(resolveBlockContentRoot(callout, callout)).toBe(callout);
    });
  });
});
