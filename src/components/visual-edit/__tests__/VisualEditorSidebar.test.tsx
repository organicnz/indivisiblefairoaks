// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VisualEditorSidebar,
  type VisualEditorSidebarProps,
} from '@/components/visual-edit/VisualEditorSidebar';
import type { ImageEditSession, InlineEditSession } from '@/components/visual-edit/VisualEditOverlay';
import type { Block } from '@/lib/blocks';
import { EMPTY_HISTORY } from '@/lib/editor-history';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('VisualEditorSidebar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const sampleBlocks: Block[] = [
    { id: 'b1', type: 'heading', level: 1, html: 'Civic Action' },
    { id: 'b2', type: 'paragraph', html: '<p>Join our newsletter</p>' },
  ];

  function createInlineSession(): InlineEditSession {
    return {
      blockIndex: 1,
      element: document.createElement('p'),
      initialHtml: '<p>Join our newsletter</p>',
      dataPointKey: null,
      copyRegionId: null,
      href: null,
      top: 0,
      left: 0,
    };
  }

  function createImageSession(): ImageEditSession {
    const element = document.createElement('img');
    element.src = 'https://example.com/photo.jpg';
    element.alt = 'Protest photo';
    return {
      element,
      initialSrc: element.src,
      initialAlt: element.alt,
      copyRegionId: null,
      blockIndex: 0,
      blockId: 'b1',
      imageOrdinal: 0,
      historyKey: 'image-history-1',
      writeCount: 0,
      failureKey: null,
      failedImages: [],
      baseSrc: element.src,
      baseAlt: element.alt,
    };
  }

  function createProps(
    overrides: Partial<VisualEditorSidebarProps> = {}
  ): VisualEditorSidebarProps {
    return {
      collapsed: false,
      onToggleCollapsed: vi.fn(),
      isVisualComposerOpen: false,
      documentTitle: 'Action Page',
      contentRow: null,
      blocks: sampleBlocks,
      sections: [
        {
          key: 'sec-0',
          label: 'Civic Action',
          blockIndex: 0,
          blockType: 'heading',
          domIndex: 0,
          ordinal: 1,
        },
        {
          key: 'sec-1',
          label: 'Join our newsletter',
          blockIndex: 1,
          blockType: 'paragraph',
          domIndex: 1,
          ordinal: 2,
        },
      ],
      enabledSectionKeys: new Set(['sec-0', 'sec-1']),
      dirty: false,
      savingBackend: false,
      history: EMPTY_HISTORY,
      activeBlockIndex: 0,
      pageRegions: [],
      activeRegionId: null,
      activeRegionLabel: null,
      onSetRegion: vi.fn(),
      showSectionBadges: true,
      showAllSectionBorders: false,
      showInspector: true,
      isComposerWorkspace: false,
      onToggleBadges: vi.fn(),
      onToggleFrames: vi.fn(),
      onToggleInspector: vi.fn(),
      viewportMode: 'desktop',
      deviceOrientation: 'portrait',
      onSetViewportMode: vi.fn(),
      onRotateOrientation: vi.fn(),
      themeMode: 'system',
      effectiveTheme: 'dark',
      onCycleTheme: vi.fn(),
      backendStatus: null,
      backendSummary: null,
      showHealthDetails: false,
      statusLoading: false,
      onToggleHealthDetails: vi.fn(),
      onProbeBackendHealth: vi.fn(),
      onOpenDiagnostics: vi.fn(),
      modifiedBlocks: [],
      modifiedDataPoints: [],
      inlineSession: null,
      inlineCounts: { chars: 25, words: 4 },
      onCommitInlineEdit: vi.fn(),
      onCancelInlineEdit: vi.fn(),
      onSetLinkModal: vi.fn(),
      onToggleSlashMenu: vi.fn(),
      onInlineTextUpdated: vi.fn(),
      imageSession: null,
      isUploadingImage: false,
      onUploadClick: vi.fn(),
      onSetAltTextModal: vi.fn(),
      onCancelImageEdit: vi.fn(),
      onToggle: vi.fn(),
      onSave: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      onOpenCommandPalette: vi.fn(),
      onOpenDataPointDrawer: vi.fn(),
      onOpenA11yAuditor: vi.fn(),
      onOpenDiffModal: vi.fn(),
      onOpenVisualComposer: vi.fn(),
      onOpenPageNavigator: vi.fn(),
      onOpenMedia: vi.fn(),
      onOpenSettings: vi.fn(),
      onOpenRevisions: vi.fn(),
      onOpenShortcuts: vi.fn(),
      onOpenCRM: vi.fn(),
      onNewPost: vi.fn(),
      onTogglePageStatus: vi.fn(),
      onInitializeCMSPage: vi.fn(),
      onAddBlock: vi.fn(),
      onOpenBlockLibrary: vi.fn(),
      onJumpToBlock: vi.fn(),
      onToggleSectionFrame: vi.fn(),
      onOpenEditSection: vi.fn(),
      onDuplicateSection: vi.fn(),
      onMoveSection: vi.fn(),
      onReorderSection: vi.fn(),
      onDeleteSection: vi.fn(),
      blockTypeOptions: [
        { type: 'heading', label: 'Heading' },
        { type: 'paragraph', label: 'Paragraph' },
      ],
      adminEditUrl: null,
      ...overrides,
    };
  }

  it('renders blocks list with drag handles and atomic delete actions', async () => {
    const props = createProps();
    await act(async () => {
      root.render(<VisualEditorSidebar {...props} />);
    });

    const blockItems = container.querySelectorAll('[data-testid="sidebar-block-item"]');
    expect(blockItems.length).toBe(2);

    const dragHandles = container.querySelectorAll('span[draggable="true"]');
    expect(dragHandles.length).toBe(2);

    const deleteButtons = container.querySelectorAll('button[aria-label^="Delete block"]');
    expect(deleteButtons.length).toBe(2);
  });

  it('invokes onReorderSection when dropping a block item onto another', async () => {
    const onReorder = vi.fn();
    const props = createProps({ onReorderSection: onReorder });
    await act(async () => {
      root.render(<VisualEditorSidebar {...props} />);
    });

    const blockItems = container.querySelectorAll('[data-testid="sidebar-block-item"]');
    const dragHandle = blockItems[0]?.querySelector('span[draggable="true"]');
    expect(dragHandle).toBeDefined();

    // Start drag on block 0
    await act(async () => {
      dragHandle?.dispatchEvent(new MouseEvent('dragstart', { bubbles: true, cancelable: true }));
    });

    // Drop on block 1
    await act(async () => {
      blockItems[1]?.dispatchEvent(new MouseEvent('drop', { bubbles: true, cancelable: true }));
    });

    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it('requires atomic confirmation before executing onDeleteSection', async () => {
    const onDelete = vi.fn();
    const props = createProps({ onDeleteSection: onDelete });
    await act(async () => {
      root.render(<VisualEditorSidebar {...props} />);
    });

    const deleteBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete block Civic Action"]'
    );
    expect(deleteBtn).not.toBeNull();

    // First click enters confirmation state
    await act(async () => {
      deleteBtn?.click();
    });

    expect(onDelete).not.toHaveBeenCalled();

    // The confirmation confirm button should now be rendered
    const confirmBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Delete'
    );
    expect(confirmBtn).toBeDefined();

    // Confirm click executes onDelete
    await act(async () => {
      confirmBtn?.click();
    });

    expect(onDelete).toHaveBeenCalledWith(0);
  });

  it('opens Visual Composer directly when Full Editor is clicked in inline edit mode', async () => {
    const onOpenVisualComposer = vi.fn();
    const props = createProps({
      inlineSession: createInlineSession(),
      onOpenVisualComposer,
    });

    await act(async () => {
      root.render(<VisualEditorSidebar {...props} />);
    });

    const fullEditorBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Full Editor')
    );
    expect(fullEditorBtn).toBeDefined();

    await act(async () => {
      fullEditorBtn?.click();
    });

    expect(onOpenVisualComposer).toHaveBeenCalledWith('block', 1);
    expect(props.onOpenEditSection).not.toHaveBeenCalled();
  });

  it('provides one tab stop and arrow-key navigation for editor views', async () => {
    const onSidebarTabChange = vi.fn();
    const props = createProps({ onSidebarTabChange });
    await act(async () => {
      root.render(<VisualEditorSidebar {...props} />);
    });

    const tablist = container.querySelector<HTMLElement>(
      '[role="tablist"][aria-label="Editor views"]'
    );
    const composerTab = container.querySelector<HTMLButtonElement>(
      '#sidebar-tab-button-composer'
    );
    const blocksTab = container.querySelector<HTMLButtonElement>('#sidebar-tab-button-blocks');
    const libraryTab = container.querySelector<HTMLButtonElement>(
      '#sidebar-tab-button-library'
    );

    expect(tablist?.getAttribute('aria-orientation')).toBe('horizontal');
    expect(blocksTab?.getAttribute('aria-selected')).toBe('true');
    expect(blocksTab?.tabIndex).toBe(0);
    expect(composerTab?.tabIndex).toBe(-1);
    expect(libraryTab?.tabIndex).toBe(-1);

    await act(async () => {
      blocksTab?.focus();
    });
    expect(document.activeElement).toBe(blocksTab);

    const press = async (key: string) => {
      await act(async () => {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        );
      });
    };

    await press('ArrowRight');
    expect(libraryTab?.getAttribute('aria-selected')).toBe('true');
    expect(libraryTab?.tabIndex).toBe(0);
    expect(document.activeElement).toBe(libraryTab);

    await press('ArrowRight');
    expect(composerTab?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(composerTab);

    await press('ArrowLeft');
    expect(libraryTab?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(libraryTab);

    await press('Home');
    expect(composerTab?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(composerTab);

    await press('End');
    expect(libraryTab?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(libraryTab);

    expect(onSidebarTabChange.mock.calls.map(([tab]) => tab)).toEqual([
      'library',
      'composer',
      'library',
      'composer',
      'library',
    ]);
  });

  it('keeps the inline context panel a group with one nested formatting toolbar', async () => {
    const props = createProps({ inlineSession: createInlineSession() });
    await act(async () => {
      root.render(<VisualEditorSidebar {...props} />);
    });

    const zone = container.querySelector<HTMLElement>(
      '[aria-label="Direct in-place text editor controls"]'
    );
    expect(zone?.getAttribute('role')).toBe('group');

    const toolbars = Array.from(zone?.querySelectorAll('[role="toolbar"]') ?? []);
    expect(toolbars).toHaveLength(1);
    expect(toolbars[0]?.getAttribute('aria-label')).toBe('Text formatting');
  });

  it('keeps the image context panel a group rather than a toolbar', async () => {
    const props = createProps({ imageSession: createImageSession() });
    await act(async () => {
      root.render(<VisualEditorSidebar {...props} />);
    });

    const zone = container.querySelector<HTMLElement>('[aria-label="Image asset controls"]');
    expect(zone?.getAttribute('role')).toBe('group');
    expect(zone?.querySelector('[role="toolbar"]')).toBeNull();
  });
});
