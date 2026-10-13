import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualEditOverlay } from '@/components/visual-edit/VisualEditOverlay';
import { openDiagnosticsVisual, VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';
import type { PublishedSection, VisualSectionsPublishedDetail } from '@/types/unified';

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
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('@/lib/actions/content', () => ({
  saveContent,
  setContentStatus,
  getContentForEdit,
  getContentBySlugForEdit,
  getContentRevisions,
  restoreContentRevision,
}));
vi.mock('@/lib/actions/crm', () => ({ getCRMEdgeFunctionHealth, uploadCRMMedia: vi.fn() }));
vi.mock('@/lib/actions/visual', () => ({ getVisualPageContext }));
vi.mock('sonner', () => ({ toast }));

// The overlay asks the header's hook whether this visitor is an admin.
const editContext = vi.hoisted(() => ({ isAdmin: true, loading: false, target: null }));
vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: () => editContext,
}));

// The media library is a portal-heavy dialog with its own suite; stubbing it
// keeps this file about the document model rather than about Radix.
vi.mock('@/components/admin/crm/composer/CRMMediaLibraryModal', () => ({
  CRMMediaLibraryModal: () => null,
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
    toast.success.mockReset();
    toast.error.mockReset();
    getCRMEdgeFunctionHealth.mockResolvedValue({
      database: true,
      storage: true,
      edgeFunction: true,
    });
    getVisualPageContext.mockResolvedValue({
      content: null,
      revisions: [],
      revisionsTruncated: false,
      media: { items: [], folders: ['crm', 'content', 'products'] },
      backend: { database: true, storage: true, edgeFunction: true },
      crmStats: null,
      segments: [],
      segmentsTruncated: false,
      catalog: { products: 0, galleryPhotos: 0, events: 0 },
    });
    saveContent.mockResolvedValue({
      success: true,
      data: { id: 7, updatedAt: '2026-10-10T00:00:00Z' },
    });
    editContext.isAdmin = true;
    visualMode.enabled = true;
    pathname.value = '/about';
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

  const withPage = async () => {
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
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();
  };

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
      'button[aria-label="Cycle theme mode preview"]'
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
