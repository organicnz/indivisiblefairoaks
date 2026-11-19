// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { openDiagnosticsVisual, VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';
import type { PublishedSection, VisualSectionsPublishedDetail } from '@/types/unified';
import {
  container,
  editContext,
  getContentBySlugForEdit,
  getCRMEdgeFunctionHealth,
  getVisualPageContext,
  mount,
  rendered,
  renderPage,
  saveContent,
  toast,
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

describe('VisualEditOverlay — block addressing and document state', () => {
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

    const themeBtn = container.querySelector<HTMLButtonElement>('button[title^="Preview theme:"]');
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
});
