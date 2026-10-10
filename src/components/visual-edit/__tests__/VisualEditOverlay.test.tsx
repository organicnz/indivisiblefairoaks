import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualEditOverlay } from '@/components/visual-edit/VisualEditOverlay';
import type { PublishedSection, VisualSectionsPublishedDetail } from '@/types/visual-edit';

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
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('@/lib/actions/content', () => ({
  saveContent,
  setContentStatus,
  getContentForEdit,
  getContentBySlugForEdit,
  getContentRevisions,
  restoreContentRevision,
}));
vi.mock('@/lib/actions/crm', () => ({ getCRMEdgeFunctionHealth }));
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
    toast.success.mockReset();
    toast.error.mockReset();
    getCRMEdgeFunctionHealth.mockResolvedValue({
      database: true,
      storage: true,
      edgeFunction: true,
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
    window.addEventListener('indivisible:page-sections-updated', onPublish);
    try {
      await withPage();
    } finally {
      window.removeEventListener('indivisible:page-sections-updated', onPublish);
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
        new CustomEvent('indivisible:delete-section', { detail: { blockIndex: 0 } })
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
        new CustomEvent('indivisible:move-section', {
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
        new CustomEvent('indivisible:delete-section', { detail: { blockIndex: 0 } })
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
});
