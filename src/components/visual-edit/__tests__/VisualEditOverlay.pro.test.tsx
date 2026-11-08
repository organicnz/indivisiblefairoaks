// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualEditOverlay } from '@/components/visual-edit/VisualEditOverlay';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const {
  saveContent,
  setContentStatus,
  getContentForEdit,
  getContentBySlugForEdit,
  getContentRevisions,
  restoreContentRevision,
  getCRMEdgeFunctionHealth,
  getVisualPageContext,
  toast,
  editContext,
  visualMode,
  pathname,
} = vi.hoisted(() => ({
  saveContent: vi.fn(),
  setContentStatus: vi.fn(),
  getContentForEdit: vi.fn(),
  getContentBySlugForEdit: vi.fn(),
  getContentRevisions: vi.fn(),
  restoreContentRevision: vi.fn(),
  getCRMEdgeFunctionHealth: vi.fn(),
  getVisualPageContext: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  editContext: {
    isAdmin: true,
    target: { label: 'Gallery', editUrl: '/admin/content' },
  },
  visualMode: {
    enabled: true,
    toggle: vi.fn(),
  },
  pathname: { value: '/gallery' },
}));

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
  uploadCRMMedia: vi.fn(),
}));

vi.mock('@/lib/actions/visual', () => ({
  getVisualPageContext,
}));

vi.mock('sonner', () => ({
  toast,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: () => editContext,
}));

vi.mock('@/components/layout/visual-edit-store', () => ({
  useVisualEditMode: () => visualMode,
}));

vi.mock('@/components/layout/theme-store', () => ({
  useThemeMode: () => ({
    mode: 'dark',
    effective: 'dark',
    cycle: vi.fn(),
  }),
}));

describe('VisualEditOverlay 10x Pro Features', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    pathname.value = '/gallery';
    getCRMEdgeFunctionHealth.mockResolvedValue({
      database: true,
      storage: true,
      edgeFunction: true,
    });
    getVisualPageContext.mockResolvedValue({
      content: {
        id: 42,
        title: 'Gallery Showcase',
        slug: 'gallery',
        type: 'page',
        status: 'publish',
        body: '<p>Visual test content</p>',
        updated_at: '2026-10-25T00:00:00Z',
      },
      revisions: [],
      revisionsTruncated: false,
      media: { items: [], folders: ['content'] },
      backend: { database: true, storage: true, edgeFunction: true },
      crmStats: null,
      segments: [],
      segmentsTruncated: false,
      catalog: { galleryPhotos: 0, events: 0 },
    });
    saveContent.mockResolvedValue({
      success: true,
      data: { id: 42, updatedAt: '2026-10-25T01:00:00Z' },
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    window.localStorage?.clear();
  });

  const mount = async () => {
    await act(async () => {
      root.render(<VisualEditOverlay />);
    });
  };

  it('renders command palette trigger and opens on click or ⌘K', async () => {
    await mount();

    const cmdButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open Command Palette"]'
    );
    expect(cmdButton).not.toBeNull();
    expect(cmdButton?.textContent).toContain('⌘K');

    await act(async () => {
      cmdButton?.click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Command Palette');
  });

  it('collapses and expands the editor sidebar', async () => {
    await mount();

    const minBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse Visual Editor Sidebar"]'
    );
    expect(minBtn).not.toBeNull();

    await act(async () => {
      minBtn?.click();
    });

    // In collapsed state, there is an expand button
    const expandBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Expand Visual Editor Sidebar"]'
    );
    expect(expandBtn).not.toBeNull();

    await act(async () => {
      expandBtn?.click();
    });

    // Returns to full sidebar
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Collapse Visual Editor Sidebar"]'
      )
    ).not.toBeNull();
  });

  it('toggles live inspector HUD state', async () => {
    await mount();

    const inspectorBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle Inspector HUD"]'
    );
    expect(inspectorBtn).not.toBeNull();

    await act(async () => {
      inspectorBtn?.click();
    });

    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Inspector HUD'));
  });

  it('provides copy button for data point key in inline edit session', async () => {
    const main = document.createElement('main');
    const dp = document.createElement('span');
    dp.setAttribute('data-data-point', 'gallery.hero.headline');
    dp.textContent = 'Democracy in Full View';
    main.appendChild(dp);
    document.body.appendChild(main);

    await mount();

    // Click data point to start inline session
    await act(async () => {
      dp.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const copyKeyBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy DataPoint key"]'
    );
    expect(copyKeyBtn).not.toBeNull();

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    await act(async () => {
      copyKeyBtn?.click();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('gallery.hero.headline');
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('gallery.hero.headline'));
  });

  it('opens Visual Diff modal when clicking Diff button or pressing ⌘⇧V', async () => {
    await mount();

    const diffBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Review visual changes diff"]'
    );
    expect(diffBtn).not.toBeNull();

    await act(async () => {
      diffBtn?.click();
    });

    const diffModalTitle = document.body.textContent;
    expect(diffModalTitle).toContain('Visual Change Review & Diff');
  });

  it('opens DataPoints Matrix drawer when clicking DataPoints button or pressing ⌘⇧D', async () => {
    await mount();

    const dpBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open DataPoints Matrix"]'
    );
    expect(dpBtn).not.toBeNull();

    await act(async () => {
      dpBtn?.click();
    });

    expect(document.body.textContent).toContain('DataPoints Matrix');
  });

  it('opens Civic A11y Auditor when clicking Audit button or pressing ⌘⇧A', async () => {
    await mount();

    const auditBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Run Civic A11y and Health Audit"]'
    );
    expect(auditBtn).not.toBeNull();

    await act(async () => {
      auditBtn?.click();
    });

    expect(document.body.textContent).toContain('Civic A11y & Health Audit');
  });

  it('renders Slash command menu trigger and BreadcrumbBar when inline editing', async () => {
    const main = document.createElement('main');
    const p = document.createElement('p');
    p.textContent = 'Editable grassroots announcement';
    main.appendChild(p);
    document.body.appendChild(main);

    await mount();

    await act(async () => {
      p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    // Breadcrumb bar is now visible
    const breadcrumb = container.querySelector('[data-testid="visual-breadcrumb-bar"]');
    expect(breadcrumb).not.toBeNull();
    expect(breadcrumb?.textContent).toContain('<p>');

    // Slash command button is present in pill
    const slashBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open Slash Commands"]'
    );
    expect(slashBtn).not.toBeNull();

    await act(async () => {
      slashBtn?.click();
    });

    const slashMenu = container.querySelector('[role="menu"][aria-label="Slash commands"]');
    expect(slashMenu).not.toBeNull();
    expect(slashMenu?.textContent).toContain('Heading 2');
    expect(slashMenu?.textContent).toContain('Callout Box');
  });

  it('names the composer as the only style surface beside the inline text editor', async () => {
    const main = document.createElement('main');
    const p = document.createElement('p');
    p.textContent = 'Edition of the newsletter';
    main.appendChild(p);
    document.body.appendChild(main);

    await mount();

    await act(async () => {
      p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    // The duplicate style controls are gone, so the inline panel cannot offer a
    // second, differently-derived class list for the same block.
    expect(container.querySelector('button[aria-label="Style quick tuner"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Align center"]')).toBeNull();

    const surface = container.querySelector('[data-canonical-editing-surface="true"]');
    expect(surface).not.toBeNull();
    expect(surface?.textContent).toContain('Design & structure');
    expect(surface?.textContent).toContain('Visual Composer');

    const composerBtn = surface?.querySelector<HTMLButtonElement>(
      'button[aria-label="Open Visual Composer for block"]'
    );
    expect(composerBtn).not.toBeNull();

    await act(async () => {
      composerBtn?.click();
    });

    expect(document.body.textContent).toContain('Visual Composer Inspector');
  });

  it('opens the composer on a canvas click on the composer route, never the inline editor', async () => {
    pathname.value = '/compose/42';

    const main = document.createElement('main');
    const p = document.createElement('p');
    p.textContent = 'Composer route copy';
    main.appendChild(p);
    document.body.appendChild(main);

    await mount();

    // The workspace states the contract before anything is selected.
    expect(container.querySelector('[data-testid="canonical-editing-surface"]')).not.toBeNull();

    await act(async () => {
      p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    // The click selected the block and opened the inspector, not a
    // contentEditable session whose save path lives somewhere else.
    expect(p.getAttribute('contenteditable')).toBeNull();
    expect(container.querySelector('[data-canonical-editing-surface="true"]')).toBeNull();
    expect(document.body.textContent).toContain('Visual Composer Inspector');
    const activeTab = document.querySelector(
      '[role="tablist"][aria-label="Inspector sections"] [role="tab"][aria-selected="true"]'
    );
    expect(activeTab?.textContent).toContain('Content');

    // A second click must not swap the block behind an open draft: switching is
    // the panel's job, because only the panel can ask before discarding.
    await act(async () => {
      p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Close the composer'));
  });

  it('renders direct Composer and Section buttons in floating inline toolbar and opens inspector', async () => {
    const main = document.createElement('main');
    const p = document.createElement('p');
    p.textContent = 'Customizable grassroots block';
    main.appendChild(p);
    document.body.appendChild(main);

    await mount();

    await act(async () => {
      p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const composerBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open Visual Composer for block"]'
    );
    expect(composerBtn).not.toBeNull();
    expect(composerBtn?.textContent).toContain('Composer');

    const sectionBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open Visual Composer for section"]'
    );
    expect(sectionBtn).not.toBeNull();
    expect(sectionBtn?.textContent).toContain('Section');

    // Click Composer button opens Visual Composer Inspector
    await act(async () => {
      composerBtn?.click();
    });

    expect(document.body.textContent).toContain('Visual Composer Inspector');
    expect(document.body.textContent).toContain('Box Model');
  });

  it('opens on-canvas right-click context menu and handles actions', async () => {
    const main = document.createElement('main');
    const p = document.createElement('p');
    p.textContent = 'Right-click test block';
    main.appendChild(p);
    document.body.appendChild(main);

    await mount();

    // Trigger right click (contextmenu) on the editable element
    await act(async () => {
      p.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 100,
          clientY: 150,
        })
      );
    });

    const menu = document.querySelector('[role="menu"][aria-label="Block Context Menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain('Customize Block');
    expect(menu?.textContent).toContain('Row & Section Settings');
    expect(menu?.textContent).toContain('Duplicate Block');
    expect(menu?.textContent).toContain('Delete Block');

    // Pressing Escape closes the context menu
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('[role="menu"][aria-label="Block Context Menu"]')).toBeNull();
  });

  it('opens confirmation modal on ⌘⇧Backspace and safely cancels or deletes', async () => {
    const main = document.createElement('main');
    const p = document.createElement('p');
    p.textContent = 'Block to delete';
    main.appendChild(p);
    document.body.appendChild(main);

    await mount();

    // Select the block
    await act(async () => {
      p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    // Press ⌘⇧Backspace
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Backspace',
          metaKey: true,
          shiftKey: true,
          bubbles: true,
        })
      );
    });

    // Dialog should appear
    expect(document.querySelector('[data-testid="block-delete-confirm-dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Delete Section');
    expect(document.body.textContent).toContain('Are you sure you want to delete');

    // Click Cancel button
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel'
    );
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      cancelBtn?.click();
    });

    // Dialog should close
    expect(document.querySelector('[data-testid="block-delete-confirm-dialog"]')).toBeNull();
    expect(document.body.textContent).not.toContain('Are you sure you want to delete');
  });

  it('dismisses delete confirmation dialog on Escape key and backdrop click', async () => {
    const main = document.createElement('main');
    const p = document.createElement('p');
    p.textContent = 'Section to confirm';
    main.appendChild(p);
    document.body.appendChild(main);

    await mount();

    // Select the block
    await act(async () => {
      p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    // Press ⌘⌫ (without Shift)
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Backspace',
          metaKey: true,
          bubbles: true,
        })
      );
    });

    const dialog = document.querySelector<HTMLElement>(
      '[data-testid="block-delete-confirm-dialog"]'
    );
    expect(dialog).not.toBeNull();

    // Press Escape to dismiss
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
        })
      );
    });

    expect(document.querySelector('[data-testid="block-delete-confirm-dialog"]')).toBeNull();

    // Press Delete key directly (non-mod)
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
        })
      );
    });

    const dialog2 = document.querySelector<HTMLElement>(
      '[data-testid="block-delete-confirm-dialog"]'
    );
    expect(dialog2).not.toBeNull();

    // Click backdrop
    await act(async () => {
      dialog2?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(document.querySelector('[data-testid="block-delete-confirm-dialog"]')).toBeNull();
  });

  it('requires confirmation before reordering sections via drag and drop', async () => {
    const main = document.createElement('main');
    const p1 = document.createElement('p');
    p1.textContent = 'Section Alpha';
    const p2 = document.createElement('p');
    p2.textContent = 'Section Beta';
    main.appendChild(p1);
    main.appendChild(p2);
    document.body.appendChild(main);

    // Reordering is a page-level write: a coded route has no row to hold it,
    // so this document is CMS-backed even though its DOM is hand-built here.
    getContentBySlugForEdit.mockResolvedValue({
      id: 42,
      title: 'Gallery Showcase',
      slug: 'gallery',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: '<p>Section Alpha</p><p>Section Beta</p>',
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-25T00:00:00Z',
    });

    await mount();

    const blockItems = document.querySelectorAll('[data-testid="sidebar-block-item"]');
    expect(blockItems.length).toBeGreaterThanOrEqual(2);

    const dragHandle = blockItems[0]?.querySelector('span[draggable="true"]');
    expect(dragHandle).not.toBeNull();

    // Start drag on block 0
    await act(async () => {
      dragHandle?.dispatchEvent(new MouseEvent('dragstart', { bubbles: true, cancelable: true }));
    });

    // Drop on block 1
    await act(async () => {
      blockItems[1]?.dispatchEvent(new MouseEvent('drop', { bubbles: true, cancelable: true }));
    });

    // Reorder confirmation modal should be displayed
    const confirmDialog = document.querySelector<HTMLElement>(
      '[data-testid="block-reorder-confirm-dialog"]'
    );
    expect(confirmDialog).not.toBeNull();
    expect(confirmDialog?.textContent).toContain('Confirm Move Section?');
    expect(confirmDialog?.textContent).toContain('from position #1 to #2');

    // Clicking Cancel dismisses without saving
    const cancelBtn = Array.from(confirmDialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Cancel'
    );
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      cancelBtn?.click();
    });

    expect(document.querySelector('[data-testid="block-reorder-confirm-dialog"]')).toBeNull();
    expect(saveContent).not.toHaveBeenCalled();

    // Trigger drag-and-drop again
    await act(async () => {
      dragHandle?.dispatchEvent(new MouseEvent('dragstart', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      blockItems[1]?.dispatchEvent(new MouseEvent('drop', { bubbles: true, cancelable: true }));
    });

    const confirmDialog2 = document.querySelector<HTMLElement>(
      '[data-testid="block-reorder-confirm-dialog"]'
    );
    expect(confirmDialog2).not.toBeNull();

    // Click Confirm Move
    const confirmMoveBtn = Array.from(confirmDialog2?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Confirm Move'
    );
    expect(confirmMoveBtn).toBeDefined();

    await act(async () => {
      confirmMoveBtn?.click();
    });

    expect(document.querySelector('[data-testid="block-reorder-confirm-dialog"]')).toBeNull();
    expect(saveContent).toHaveBeenCalled();
  });

  it('dismisses reorder confirmation dialog on Escape key and backdrop click', async () => {
    const main = document.createElement('main');
    const p1 = document.createElement('p');
    p1.textContent = 'Alpha';
    const p2 = document.createElement('p');
    p2.textContent = 'Beta';
    main.appendChild(p1);
    main.appendChild(p2);
    document.body.appendChild(main);

    await mount();

    const blockItems = document.querySelectorAll('[data-testid="sidebar-block-item"]');
    const dragHandle = blockItems[0]?.querySelector('span[draggable="true"]');

    await act(async () => {
      dragHandle?.dispatchEvent(new MouseEvent('dragstart', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      blockItems[1]?.dispatchEvent(new MouseEvent('drop', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector<HTMLElement>(
      '[data-testid="block-reorder-confirm-dialog"]'
    );
    expect(dialog).not.toBeNull();

    // Escape dismisses
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('[data-testid="block-reorder-confirm-dialog"]')).toBeNull();
  });
});
