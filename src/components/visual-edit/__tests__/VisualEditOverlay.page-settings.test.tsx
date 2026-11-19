// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  openRevisionsVisual,
  openSettingsVisual,
  VISUAL_EDIT_EVENTS,
} from '@/lib/visual-edit-events';
import {
  body,
  byText,
  changeComposerCopy,
  container,
  dirtyThePage,
  getContentBySlugForEdit,
  getContentRevisions,
  mount,
  openComposerOnFirstBlock,
  rendered,
  renderPage,
  restoreContentRevision,
  saveContent,
  setContentStatus,
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

describe('VisualEditOverlay — page settings and publication', () => {
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
});
