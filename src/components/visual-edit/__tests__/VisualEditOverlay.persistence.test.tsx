// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MAX_BODY_BYTES } from '@/lib/content';
import { openSettingsVisual, VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';
import {
  byText,
  changeComposerCopy,
  container,
  getContentBySlugForEdit,
  mount,
  openComposerOnFirstBlock,
  pathname,
  recreateRoot,
  rendered,
  renderPage,
  root,
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

describe('VisualEditOverlay — inline persistence and copy regions', () => {
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

    recreateRoot();
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

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('too large to save'));

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

    const link = document.querySelector<HTMLAnchorElement>('[data-visual-edit-root] section p a');
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
    renderPage(
      '<div class="space-y-8"><p>Edited event copy.</p><div data-copy-region="events-trainings"></div></div>'
    );
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
    expect(container.querySelector('[role="toolbar"][aria-label^="Actions for"]')).toBeNull();
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
});
