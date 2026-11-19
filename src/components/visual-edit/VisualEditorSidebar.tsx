'use client';

import {
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Loader2,
  PenLine,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { Block } from '@/lib/blocks';
import type { CopyRegionDefinition } from '@/lib/copy-regions';
import type { History as EditorHistory } from '@/lib/editor-history';
import type { EffectiveTheme, ThemeMode } from '@/lib/theme';
import type { VisualSection } from '@/lib/visual-sections';
import type { BackendStatus, BackendSummary, MediaTarget, VisualContentRow } from '@/types/unified';
import type { BlockTemplate } from './BlockLibraryModal';
import { BlockLibraryPanel } from './BlockLibraryPanel';
import { DefaultContextZone } from './DefaultContextZone';
import { type DocumentLoadState, DocumentReadBanner } from './DocumentReadBanner';
import { ImageContextZone } from './ImageContextZone';
import { InlineContextZone } from './InlineContextZone';
import type { ViewportMode } from './useVisualEditViewport';
import {
  VisualComposerInspector,
  type VisualComposerInspectorProps,
} from './VisualComposerInspector';
import type { ModifiedBlockItem, ModifiedDataPointItem } from './VisualDiffModal';
import type { ImageEditSession, InlineEditSession } from './VisualEditOverlay';

const SIDEBAR_TAB_ORDER = ['composer', 'blocks', 'library'] as const;
type SidebarTab = (typeof SIDEBAR_TAB_ORDER)[number];

export interface VisualEditorSidebarProps {
  // ── Layout ──────────────────────────────────────────────────────────────
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isVisualComposerOpen: boolean;

  // ── Document ────────────────────────────────────────────────────────────
  documentTitle: string;
  contentRow: VisualContentRow | null;
  /**
   * The saved CMS document's own state. `loading` blocks edits so the operator
   * cannot type into the DOM fallback and then have the real body replace it;
   * `degraded` blocks them because the row could not be read at all.
   */
  documentLoadState?: DocumentLoadState;
  onRetryDocumentLoad?: () => void;
  blocks: Block[];
  sections: VisualSection[];
  enabledSectionKeys: Set<string>;
  dirty: boolean;
  savingBackend: boolean;
  history: EditorHistory;
  activeBlockIndex: number | null;

  // ── Copy regions ────────────────────────────────────────────────────────
  pageRegions: readonly CopyRegionDefinition[];
  activeRegionId: string | null;
  activeRegionLabel: string | null;
  onSetRegion: (id: string | null) => void;
  /**
   * Why the whole-page document cannot be saved — a coded route has no row, so
   * its page-level text is JSX. Regions stay selectable; the whole-page save
   * controls are disabled and say why.
   */
  unsaveableReason?: string | null;

  // ── Display toggles ─────────────────────────────────────────────────────
  showSectionBadges: boolean;
  showAllSectionBorders: boolean;
  showInspector: boolean;
  /**
   * The dedicated `/compose/[id]` workspace. On that route the Visual Composer
   * is the only block editor: a canvas click opens it, and this sidebar says
   * so instead of offering a second path.
   */
  isComposerWorkspace: boolean;
  onToggleBadges: () => void;
  onToggleFrames: () => void;
  onToggleInspector: () => void;

  // ── Viewport ────────────────────────────────────────────────────────────
  viewportMode: ViewportMode;
  deviceOrientation: 'portrait' | 'landscape';
  onSetViewportMode: (mode: ViewportMode) => void;
  onRotateOrientation: () => void;

  // ── Theme ───────────────────────────────────────────────────────────────
  themeMode: ThemeMode;
  effectiveTheme: EffectiveTheme;
  onCycleTheme: () => void;

  // ── Health ──────────────────────────────────────────────────────────────
  backendStatus: BackendStatus | null;
  backendSummary: BackendSummary | null;
  showHealthDetails: boolean;
  statusLoading: boolean;
  onToggleHealthDetails: () => void;
  onProbeBackendHealth: () => void;
  onOpenDiagnostics: () => void;

  // ── Diff ────────────────────────────────────────────────────────────────
  modifiedBlocks: ModifiedBlockItem[];
  modifiedDataPoints: ModifiedDataPointItem[];

  // ── Inline edit session ─────────────────────────────────────────────────
  inlineSession: InlineEditSession | null;
  inlineCounts: { chars: number; words: number };
  onCommitInlineEdit: (session: InlineEditSession) => void;
  onCancelInlineEdit: (session: InlineEditSession) => void;
  onSetLinkModal: (state: {
    textareaId: string | null;
    url: string;
    text: string;
    editAnchor?: HTMLAnchorElement | null;
  }) => void;
  onToggleSlashMenu: () => void;
  onInlineTextUpdated: (text: string) => void;

  // ── Image edit session ──────────────────────────────────────────────────
  imageSession: ImageEditSession | null;
  isUploadingImage: boolean;
  onUploadClick: () => void;
  onSetAltTextModal: (state: { session: ImageEditSession; value: string }) => void;
  onSaveImageAlt?: (
    session: ImageEditSession,
    value: string
  ) => Promise<boolean | void> | boolean | void;
  onCancelImageEdit: (session: ImageEditSession) => void;

  // ── Action handlers ─────────────────────────────────────────────────────
  onToggle: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenCommandPalette: () => void;
  onOpenDataPointDrawer: () => void;
  onOpenA11yAuditor: () => void;
  onOpenDiffModal: () => void;
  onOpenVisualComposer: (mode: 'block' | 'section', blockIndex: number) => void;
  onOpenPageNavigator: () => void;
  onOpenMedia: (target: MediaTarget) => void;
  onOpenSettings: () => void;
  onOpenRevisions: () => void;
  onOpenShortcuts: () => void;
  onOpenCRM: (tab?: 'constituents' | 'events' | 'news' | 'links') => void;
  onNewPost: () => void;
  onTogglePageStatus: () => void;
  onInitializeCMSPage: () => void;
  onAddBlock: (type: Block['type']) => void;
  onOpenBlockLibrary: (insertAfterIndex: number | null) => void;
  onJumpToBlock: (blockIndex: number) => void;
  onToggleSectionFrame: (blockIndex: number) => void;
  onOpenEditSection: (blockIndex: number) => void;
  onDuplicateSection: (blockIndex: number) => void;
  onMoveSection: (blockIndex: number, direction: 'up' | 'down') => void;
  onReorderSection?: (fromIndex: number, toIndex: number) => void;
  onDeleteSection?: (blockIndex: number) => void;

  // ── Constants ───────────────────────────────────────────────────────────
  blockTypeOptions: ReadonlyArray<{ type: Block['type']; label: string }>;

  // ── Admin link ──────────────────────────────────────────────────────────
  adminEditUrl: string | null;

  // ── Composer Studio ─────────────────────────────────────────────────────
  composerProps?: VisualComposerInspectorProps | null;

  // ── Block Library & Full Sidebar Editor ──────────────────────────────────
  onAddBlockTemplate?: (template: BlockTemplate, targetIndex?: number) => void;
  libraryTargetIndex?: number | null;
  activeSidebarTab?: SidebarTab;
  onSidebarTabChange?: (tab: SidebarTab) => void;
}

/**
 * A unified right sidebar that replaces the bottom dock, the amber inline-edit
 * floating panel, and the sky image-edit floating panel.
 *
 * The sidebar is a single fixed panel on the right edge. Its context zone
 * switches between three modes based on what the operator is doing:
 *
 *  - inline-edit (amber):  a `contentEditable` element is being edited inline
 *  - image-edit  (sky):    an image element was clicked for replacement
 *  - default:              the block list, toolbar, and viewport switcher
 *
 * The `<aside>` carries `data-testid="visual-edit-overlay"` so the existing
 * test suite — which keys off that attribute — finds the toolbar without
 * change. It offsets to the left when the Visual Composer Inspector is open,
 * matching the behaviour the old floating panels had.
 */
export function VisualEditorSidebar(props: VisualEditorSidebarProps) {
  const { collapsed, onToggleCollapsed, isVisualComposerOpen } = props;

  const isComposerActive =
    isVisualComposerOpen && Boolean(props.composerProps?.open && props.composerProps?.block);

  const documentLoadState = props.documentLoadState ?? 'idle';
  const documentReady = documentLoadState === 'ready';
  const documentOpening = documentLoadState === 'idle' || documentLoadState === 'loading';
  const documentUnavailable = documentLoadState === 'degraded';
  /**
   * One status dot for both the collapsed strip and the expanded header.
   * Amber means loading, unsaved, uncoupled from a CMS row, or region-only;
   * rose means the saved row could not be read; sky means a write is in
   * flight; emerald is the settled saved state. Only transient work pulses: a
   * steady green dot is the truthful signal that the editor is not waiting on
   * anything, and a green dot must never sit beside a page with no saved row.
   */
  const documentStatusLabel = documentOpening
    ? 'Opening the saved document'
    : documentUnavailable
      ? 'Saved document unavailable — editing is locked'
      : props.savingBackend
        ? 'Saving changes'
        : props.dirty
          ? 'Unsaved changes'
          : props.unsaveableReason
            ? 'Page-level copy is not savable — edit inline text or a copy region'
            : !props.contentRow
              ? 'Not connected to Supabase'
              : 'Saved';
  const documentStatusDotClass = documentUnavailable
    ? 'bg-rose-400'
    : documentOpening
      ? 'bg-amber-400 animate-pulse motion-reduce:animate-none'
      : props.savingBackend
        ? 'bg-sky-400 animate-pulse motion-reduce:animate-none'
        : props.dirty || props.unsaveableReason || !props.contentRow
          ? 'bg-amber-400'
          : 'bg-emerald-400';

  const sidebarStyle: React.CSSProperties = {
    right: '0',
  };

  // Hooks must run before the collapsed early return. The collapsed and
  // expanded views are the same mounted component, so a `collapsed` toggle
  // that skipped these would change the hook order mid-life and tear down
  // React state (the sidebar tabs and composer sync).
  const { inlineSession, imageSession } = props;
  const [uncontrolledTab, setUncontrolledTab] = useState<SidebarTab>(
    isComposerActive ? 'composer' : 'blocks'
  );

  useEffect(() => {
    if (isComposerActive && !props.activeSidebarTab) {
      setUncontrolledTab('composer');
    }
  }, [isComposerActive, props.activeSidebarTab]);

  // ── Collapsed: a narrow icon strip ──────────────────────────────────────
  if (collapsed && !isComposerActive && !props.inlineSession && !props.imageSession) {
    return (
      <aside
        aria-label="Visual Editor Toolbar"
        data-testid="visual-edit-overlay"
        data-document-state={documentLoadState}
        data-editor-focus-fallback
        tabIndex={-1}
        style={sidebarStyle}
        className="fixed inset-y-0 right-0 z-[9998] flex w-12 flex-col items-center gap-3 border-l border-white/20 bg-secondary/95 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-ink-on-dark shadow-float backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-gold/70"
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Expand Visual Editor Sidebar"
          aria-label="Expand Visual Editor Sidebar"
          className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>

        <span
          role="status"
          aria-label={documentStatusLabel}
          title={documentStatusLabel}
          className={`size-2 rounded-full ${documentStatusDotClass}`}
        />

        {props.dirty && (
          <button
            type="button"
            onClick={props.onSave}
            disabled={props.savingBackend || Boolean(props.unsaveableReason) || !documentReady}
            title={
              !documentReady
                ? documentUnavailable
                  ? 'Reload the saved document before saving'
                  : 'Wait for the saved document to open before saving'
                : (props.unsaveableReason ?? 'Save changes to Supabase (⌘S)')
            }
            aria-label="Save changes to Supabase"
            className="inline-flex items-center justify-center rounded-md bg-accent p-1.5 text-ink-strong hover:bg-accent-gold cursor-pointer disabled:opacity-50"
          >
            {props.savingBackend ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
          </button>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={props.onToggle}
          title="Turn off visual editing"
          aria-label="Turn off visual editing"
          className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 cursor-pointer"
        >
          <X size={14} />
        </button>
      </aside>
    );
  }

  // ── Expanded: full sidebar with context zone ────────────────────────────
  const sidebarTab = props.activeSidebarTab ?? uncontrolledTab;
  const handleSetTab = (tab: SidebarTab) => {
    setUncontrolledTab(tab);
    props.onSidebarTabChange?.(tab);
  };

  /**
   * The tab strip is one Tab stop. Arrow keys walk it, Home and End jump to
   * its ends, and selection follows focus because the three views are cheap
   * to switch and the tab itself already has a visible focus ring.
   */
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Modified arrows belong to the page and to the composer inspector
    // (Alt+ArrowLeft/Right cycles its tabs). A tablist owns only the plain keys.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const current = SIDEBAR_TAB_ORDER.indexOf(sidebarTab);
    if (current < 0) return;
    const last = SIDEBAR_TAB_ORDER.length - 1;
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % SIDEBAR_TAB_ORDER.length;
    else if (event.key === 'ArrowLeft') {
      next = (current - 1 + SIDEBAR_TAB_ORDER.length) % SIDEBAR_TAB_ORDER.length;
    } else if (event.key === 'Home') next = 0;
    else next = last;

    event.preventDefault();
    const tab = SIDEBAR_TAB_ORDER[next];
    handleSetTab(tab);
    // Focus by stable id: the selected tab's tabIndex is stale until the next
    // render lands, but programmatic focus does not need tabIndex 0.
    document.getElementById(`sidebar-tab-button-${tab}`)?.focus();
  };

  const isWide = isComposerActive || sidebarTab === 'composer' || sidebarTab === 'library';

  return (
    <aside
      aria-label="Visual Editor Toolbar"
      data-testid="visual-edit-overlay"
      data-document-state={documentLoadState}
      data-editor-focus-fallback
      tabIndex={-1}
      style={sidebarStyle}
      className={`fixed inset-y-0 right-0 z-[9998] flex flex-col border-l border-white/20 bg-secondary/95 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-ink-on-dark shadow-float backdrop-blur-md transition-[width,background-color,border-color] duration-200 ${
        isWide ? 'w-[28rem] max-w-[100vw]' : 'w-72'
      } focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-gold/70`}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            role="status"
            aria-label={documentStatusLabel}
            title={documentStatusLabel}
            className={`size-2 shrink-0 rounded-full ${documentStatusDotClass}`}
          />
          <PenLine size={14} className="shrink-0 text-accent-gold" aria-hidden="true" />
          <span className="truncate text-xs font-black uppercase tracking-wider text-white">
            {props.documentTitle}
          </span>
        </div>
        <div
          role="tablist"
          aria-label="Editor views"
          aria-orientation="horizontal"
          onKeyDown={handleTabKeyDown}
          className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5 text-[10px] font-bold"
        >
          <button
            type="button"
            role="tab"
            id="sidebar-tab-button-composer"
            aria-selected={sidebarTab === 'composer'}
            aria-controls="sidebar-tab-composer"
            tabIndex={sidebarTab === 'composer' ? 0 : -1}
            onClick={() => handleSetTab('composer')}
            className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold ${
              sidebarTab === 'composer'
                ? 'bg-accent-gold text-ink-strong'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Studio
          </button>
          <button
            type="button"
            role="tab"
            id="sidebar-tab-button-blocks"
            aria-selected={sidebarTab === 'blocks'}
            aria-controls="sidebar-tab-blocks"
            tabIndex={sidebarTab === 'blocks' ? 0 : -1}
            onClick={() => handleSetTab('blocks')}
            className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold ${
              sidebarTab === 'blocks'
                ? 'bg-accent-gold text-ink-strong'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Blocks
          </button>
          <button
            type="button"
            role="tab"
            id="sidebar-tab-button-library"
            aria-selected={sidebarTab === 'library'}
            aria-controls="sidebar-tab-library"
            tabIndex={sidebarTab === 'library' ? 0 : -1}
            onClick={() => handleSetTab('library')}
            className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold ${
              sidebarTab === 'library'
                ? 'bg-accent-gold text-ink-strong'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Library
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void props.onOpenShortcuts()}
            title="Keyboard shortcuts cheat sheet"
            aria-label="Keyboard shortcuts cheat sheet"
            className="shrink-0 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-accent-gold"
          >
            <Keyboard size={14} />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse Visual Editor Sidebar"
            aria-label="Collapse Visual Editor Sidebar"
            className="shrink-0 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-accent-gold"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <DocumentReadBanner
        state={props.documentLoadState ?? 'idle'}
        onRetry={props.onRetryDocumentLoad}
      />
      {/* ── Context zone ─────────────────────────────────────────────────── */}
      <div
        id="sidebar-tab-composer"
        role="tabpanel"
        aria-labelledby="sidebar-tab-button-composer"
        tabIndex={0}
        className={`flex-1 flex flex-col min-h-0 overflow-hidden overscroll-contain ${
          sidebarTab === 'composer' ? 'flex' : 'hidden'
        }`}
      >
        {props.composerProps && props.composerProps.open && props.composerProps.block ? (
          <VisualComposerInspector {...props.composerProps} embedded={true} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-gold/20 text-accent-gold shadow-inner">
              <SlidersHorizontal size={22} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white tracking-wide">Visual Composer Studio</h3>
              <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                Select any block on the page or tree to edit its styles, box model, colors, and
                animations.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
              <button
                type="button"
                onClick={() => handleSetTab('library')}
                className="w-full rounded-xl bg-accent-gold hover:bg-accent-gold/90 px-3 py-2 text-xs font-black text-ink-strong transition-colors cursor-pointer shadow-md"
              >
                Add Element from Library →
              </button>
              <button
                type="button"
                onClick={() => handleSetTab('blocks')}
                className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
              >
                Browse Document Blocks →
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        id="sidebar-tab-blocks"
        role="tabpanel"
        aria-labelledby="sidebar-tab-button-blocks"
        tabIndex={0}
        className={`flex-1 overflow-y-auto overscroll-contain ${
          sidebarTab === 'blocks' ? 'block' : 'hidden'
        }`}
      >
        {inlineSession ? (
          <InlineContextZone {...props} inlineSession={inlineSession} />
        ) : imageSession ? (
          <ImageContextZone key={imageSession.historyKey} {...props} imageSession={imageSession} />
        ) : (
          <DefaultContextZone
            {...props}
            onOpenBlockLibrary={(targetIndex) => {
              props.onOpenBlockLibrary(targetIndex);
              handleSetTab('library');
            }}
          />
        )}
      </div>

      <div
        id="sidebar-tab-library"
        role="tabpanel"
        aria-labelledby="sidebar-tab-button-library"
        tabIndex={0}
        className={`flex-1 flex flex-col min-h-0 overflow-hidden overscroll-contain ${
          sidebarTab === 'library' ? 'flex' : 'hidden'
        }`}
      >
        <BlockLibraryPanel
          embedded={true}
          insertTargetIndex={props.libraryTargetIndex ?? props.activeBlockIndex}
          onInsertBlock={(template, targetIdx) => {
            if (props.onAddBlockTemplate) {
              props.onAddBlockTemplate(
                template,
                targetIdx ?? props.libraryTargetIndex ?? props.activeBlockIndex ?? undefined
              );
            } else {
              props.onOpenBlockLibrary(targetIdx ?? null);
            }
            handleSetTab('composer');
          }}
        />
      </div>
    </aside>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Inline-edit context zone (amber)
// ══════════════════════════════════════════════════════════════════════════
