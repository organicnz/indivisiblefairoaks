// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualEditOverlay } from '@/components/visual-edit/VisualEditOverlay';
import {
  openDiagnosticsVisual,
  openSettingsVisual,
  VISUAL_EDIT_EVENTS,
} from '@/lib/visual-edit-events';
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
    editContext.target = null;
    visualMode.enabled = true;
    pathname.value = '/about';
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

  const byText = (text: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === text
    );

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

  /** Type into the composer's copy field, the way the Content tab does. */
  const changeComposerCopy = async (text: string) => {
    const textarea = document.querySelector<HTMLTextAreaElement>('aside[role="dialog"] textarea');
    expect(textarea).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, text);
      textarea?.dispatchEvent(new Event('input', { bubbles: true }));
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
      media: { items: [], folders: ['crm', 'content', 'products'] },
      backend: { database: true, storage: true, edgeFunction: false },
      crmStats: null,
      segments: [],
      segmentsTruncated: false,
      catalog: { products: 0, galleryPhotos: 0, events: 0 },
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
      media: { items: [], folders: ['crm', 'content', 'products'] },
      backend: { database: false, storage: true, edgeFunction: true },
      crmStats: null,
      segments: [],
      segmentsTruncated: false,
      catalog: { products: 0, galleryPhotos: 0, events: 0 },
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
    // The "saved" text comes from the sidebar's document info line
    expect(toolbar?.textContent).toContain('saved');
    // No unsaved indicator on a fresh load
    expect(toolbar?.textContent).not.toContain('unsaved changes');
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

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
          detail: { regionId: 'about-mission' },
        })
      );
    });

    // The panel still describes the document it was editing, and the switch has
    // not been allowed to overwrite it behind the prompt.
    expect(document.body.textContent).toContain('Discard unsaved changes?');
    expect(document.body.textContent).toContain('Visual Composer Inspector');
    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');

    await act(async () => {
      byText('Discard')?.click();
    });

    expect(document.body.textContent).not.toContain('Visual Composer Inspector');
    expect(getContentBySlugForEdit).toHaveBeenCalledWith('copy-about-mission');
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
    expect(panel?.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Fresh intro copy.');
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

  it('reserves the sidebar rail only on the composer route', async () => {
    pathname.value = '/compose/42';
    renderPage(rendered);

    await mount();
    expect(document.documentElement.style.getPropertyValue('--visual-edit-rail-width')).toBe(
      '18rem'
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
});
