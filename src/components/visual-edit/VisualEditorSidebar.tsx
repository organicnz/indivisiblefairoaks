'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FilePlus2,
  FolderOpen,
  History,
  Image as ImageIcon,
  ImagePlus,
  Keyboard,
  Layers,
  LayoutTemplate,
  Link as LinkIcon,
  ListTree,
  Loader2,
  Monitor,
  Moon,
  Newspaper,
  PenLine,
  Plus,
  Redo2,
  RefreshCw,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  Tablet,
  Undo2,
  Upload,
  UsersRound,
  X,
} from 'lucide-react';
import type React from 'react';
import { toast } from 'sonner';
import type { Block } from '@/lib/blocks';
import type { CopyRegionDefinition } from '@/lib/copy-regions';
import { canRedo, canUndo, type History as EditorHistory } from '@/lib/editor-history';
import { type EffectiveTheme, type ThemeMode, themeModeLabel } from '@/lib/theme';
import { sectionLabelForBlock, type VisualSection } from '@/lib/visual-sections';
import type { BackendStatus, BackendSummary, MediaTarget, VisualContentRow } from '@/types/unified';
import { CivicGhostwriter } from './CivicGhostwriter';
import {
  applyInlineFormatCommand,
  type InlineFormatCommand,
  InlineFormatToolbar,
} from './InlineFormatToolbar';
import { StyleQuickTuner } from './StyleQuickTuner';
import type { ModifiedBlockItem, ModifiedDataPointItem } from './VisualDiffModal';
import type { ImageEditSession, InlineEditSession, ViewportMode } from './VisualEditOverlay';

/**
 * Every command the inline-edit pill offers, in run order. This used to live in
 * the overlay; it moved here because the pill — the only consumer — moved into
 * the sidebar's inline context zone.
 */
const INLINE_FORMAT_COMMANDS: readonly InlineFormatCommand[] = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'code',
  'highlight',
  'bulletList',
  'orderedList',
  'link',
  'unlink',
  'clear',
  'h2',
  'h3',
  'paragraph',
];

export interface VisualEditorSidebarProps {
  // ── Layout ──────────────────────────────────────────────────────────────
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isVisualComposerOpen: boolean;

  // ── Document ────────────────────────────────────────────────────────────
  documentTitle: string;
  contentRow: VisualContentRow | null;
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

  // ── Display toggles ─────────────────────────────────────────────────────
  showSectionBadges: boolean;
  showAllSectionBorders: boolean;
  showInspector: boolean;
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
  onSetLinkModal: (state: { textareaId: string | null; url: string; text: string }) => void;
  onToggleSlashMenu: () => void;
  onInlineTextUpdated: (text: string) => void;

  // ── Image edit session ──────────────────────────────────────────────────
  imageSession: ImageEditSession | null;
  isUploadingImage: boolean;
  onUploadClick: () => void;
  onSetAltTextModal: (state: { session: ImageEditSession; value: string }) => void;
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

  // ── Constants ───────────────────────────────────────────────────────────
  blockTypeOptions: ReadonlyArray<{ type: Block['type']; label: string }>;

  // ── Admin link ──────────────────────────────────────────────────────────
  adminEditUrl: string | null;
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

  const sidebarStyle: React.CSSProperties = {
    right: isVisualComposerOpen ? 'min(100vw, 28rem)' : '0',
  };

  // ── Collapsed: a narrow icon strip ──────────────────────────────────────
  if (collapsed) {
    return (
      <aside
        aria-label="Visual Editor Toolbar"
        data-testid="visual-edit-overlay"
        style={sidebarStyle}
        className="fixed inset-y-0 right-0 z-[9998] flex w-12 flex-col items-center gap-3 border-l border-white/20 bg-secondary/95 py-4 text-ink-on-dark shadow-float backdrop-blur-md"
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
          className={`size-2 rounded-full ${props.dirty ? 'bg-amber-400' : 'bg-emerald-400'}`}
        />

        {props.dirty && (
          <button
            type="button"
            onClick={props.onSave}
            disabled={props.savingBackend}
            title="Save changes to Supabase (⌘S)"
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
  const { inlineSession, imageSession } = props;

  return (
    <aside
      aria-label="Visual Editor Toolbar"
      data-testid="visual-edit-overlay"
      style={sidebarStyle}
      className="fixed inset-y-0 right-0 z-[9998] flex w-72 flex-col border-l border-white/20 bg-secondary/95 text-ink-on-dark shadow-float backdrop-blur-md"
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-accent-gold animate-pulse" />
          <PenLine size={14} className="shrink-0 text-accent-gold" aria-hidden="true" />
          <span className="truncate text-xs font-black uppercase tracking-wider text-white">
            {props.documentTitle}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Collapse Visual Editor Sidebar"
          aria-label="Collapse Visual Editor Sidebar"
          className="shrink-0 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 cursor-pointer"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Context zone ─────────────────────────────────────────────────── */}
      {inlineSession ? (
        <InlineContextZone {...props} inlineSession={inlineSession} />
      ) : imageSession ? (
        <ImageContextZone {...props} imageSession={imageSession} />
      ) : (
        <DefaultContextZone {...props} />
      )}
    </aside>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Inline-edit context zone (amber)
// ══════════════════════════════════════════════════════════════════════════

function InlineContextZone(props: VisualEditorSidebarProps & { inlineSession: InlineEditSession }) {
  const { inlineSession } = props;
  const composerIdx = inlineSession.blockIndex ?? props.activeBlockIndex ?? 0;

  return (
    <div
      data-inline-toolbar="true"
      role="toolbar"
      aria-label="Direct in-place text editor controls"
      className="flex flex-1 flex-col gap-2 overflow-y-auto border-t-2 border-accent-gold/40 px-3 py-4 text-xs text-white"
    >
      <div className="flex items-center justify-between border-b border-white/15 pb-2">
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-accent-gold">
          <PenLine size={12} />
          <span>Inline Edit</span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => void props.onCommitInlineEdit(inlineSession)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-accent-gold px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-ink-strong transition-colors hover:bg-amber-400 shadow-xs"
        title="Save changes (⌘+Enter)"
      >
        <Check size={13} className="stroke-[3]" />
        <span>Save</span>
        <kbd className="ml-1 text-[9px] font-mono opacity-60">⌘↵</kbd>
      </button>

      <button
        type="button"
        onClick={() => props.onCancelInlineEdit(inlineSession)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        title="Cancel changes (Escape)"
      >
        <X size={12} />
        <span>Cancel</span>
        <kbd className="ml-0.5 text-[9px] font-mono opacity-50">esc</kbd>
      </button>

      {inlineSession.dataPointKey && (
        <div className="flex items-center gap-1">
          <span
            className="inline-flex select-none items-center gap-1 rounded border border-sky-400/40 bg-sky-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-sky-300 shadow-xs"
            title="Connected directly to Supabase DB public.data_points table"
          >
            <Database size={11} className="text-sky-400" />
            <span>{inlineSession.dataPointKey}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              if (inlineSession.dataPointKey) {
                void navigator.clipboard?.writeText(inlineSession.dataPointKey);
                toast.success(`Copied "${inlineSession.dataPointKey}" to clipboard`);
              }
            }}
            className="cursor-pointer rounded p-1 text-sky-300 transition-colors hover:bg-white/10 hover:text-white"
            title="Copy DataPoint key"
            aria-label="Copy DataPoint key"
          >
            <Copy size={11} />
          </button>
        </div>
      )}

      <div className="my-1 h-px w-full bg-white/15" />

      <InlineFormatToolbar
        variant="pill"
        commands={INLINE_FORMAT_COMMANDS}
        onCommand={(command) => {
          if (command === 'link') {
            props.onSetLinkModal({ textareaId: null, url: '', text: '' });
          } else {
            applyInlineFormatCommand(command);
          }
        }}
      />

      <div className="my-1 h-px w-full bg-white/15" />

      <StyleQuickTuner
        element={inlineSession.element}
        onOpenVisualComposer={() => props.onOpenVisualComposer('block', composerIdx)}
      />

      <div className="my-1 h-px w-full bg-white/15" />

      <CivicGhostwriter
        element={inlineSession.element}
        onTextUpdated={(t) => props.onInlineTextUpdated(t)}
      />

      <span className="ml-0.5 select-none rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-ink-muted-on-dark">
        {props.inlineCounts.words}w · {props.inlineCounts.chars}c
      </span>

      <div className="my-1 h-px w-full bg-white/15" />

      <button
        type="button"
        onClick={props.onToggleSlashMenu}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-accent-gold transition-colors hover:bg-accent-gold/20"
        title="Open Slash Commands (or type /)"
        aria-label="Open Slash Commands"
      >
        <span className="font-mono text-xs">/</span>
        <span className="hidden md:inline">Slash</span>
      </button>

      {(inlineSession.blockIndex !== null || props.blocks.length > 0) && (
        <>
          <div className="my-1 h-px w-full bg-white/15" />
          <button
            type="button"
            onClick={() => props.onOpenVisualComposer('block', composerIdx)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-accent-gold/30 bg-accent-gold/15 px-2 py-1 text-[11px] font-bold text-accent-gold transition-colors hover:bg-accent-gold/25"
            title="Visual Composer: Element Box Model, Effects, Motion & Typography (⌘E)"
            aria-label="Open Visual Composer for block"
          >
            <SlidersHorizontal size={12} />
            <span className="hidden md:inline">Composer</span>
          </button>
          <button
            type="button"
            onClick={() => props.onOpenVisualComposer('section', composerIdx)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-sky-400/30 bg-sky-500/15 px-2 py-1 text-[11px] font-bold text-sky-400 transition-colors hover:bg-sky-500/25"
            title="Section Settings: Viewport Min-Height, Cutout Dividers & Grid Columns"
            aria-label="Open Visual Composer for section"
          >
            <LayoutTemplate size={12} />
            <span className="hidden md:inline">Section</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const idx = inlineSession.blockIndex;
              if (idx !== null) {
                props.onOpenEditSection(idx);
              }
            }}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-slate-300 transition-colors hover:bg-white/10"
            title="Open comprehensive block editor modal"
          >
            <Settings size={12} />
            <span className="hidden md:inline">Full Editor</span>
          </button>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Image-edit context zone (sky)
// ══════════════════════════════════════════════════════════════════════════

function ImageContextZone(props: VisualEditorSidebarProps & { imageSession: ImageEditSession }) {
  const { imageSession } = props;
  // A const, because the onClick closure below cannot inherit the JSX
  // conditional's narrowing — a narrow const does.
  const imageBlockIndex = imageSession.blockIndex;

  return (
    <div
      data-inline-toolbar="true"
      role="toolbar"
      aria-label="Image asset controls"
      className="flex flex-1 flex-col gap-2 overflow-y-auto border-t-2 border-sky-400/40 px-3 py-4 text-xs text-white"
    >
      <div className="flex items-center justify-between border-b border-white/15 pb-2">
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-sky-400">
          <ImageIcon size={12} />
          <span>Image Asset</span>
        </span>
      </div>

      <div className="my-1 h-px w-full bg-white/15" />

      <button
        type="button"
        onClick={() => props.onOpenMedia('image-replace')}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary-bright px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-light shadow-xs"
        title="Replace image with Supabase S3 Storage media"
      >
        <ImagePlus size={13} />
        <span>Replace</span>
      </button>

      <button
        type="button"
        disabled={props.isUploadingImage}
        onClick={props.onUploadClick}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/20 shadow-xs disabled:opacity-50"
        title="Directly upload replacement image from your device"
      >
        {props.isUploadingImage ? (
          <Loader2 size={12} className="animate-spin text-accent-gold" />
        ) : (
          <Upload size={12} className="text-primary-on-dark" />
        )}
        <span>{props.isUploadingImage ? 'Uploading…' : 'Upload'}</span>
      </button>

      <button
        type="button"
        onClick={() =>
          props.onSetAltTextModal({
            session: imageSession,
            value: imageSession.element.alt || '',
          })
        }
        className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        title="Edit image alt text"
        aria-label="Edit image alt text"
      >
        <Settings size={12} />
        <span className="hidden sm:inline">Alt Text</span>
      </button>

      {imageBlockIndex !== null && (
        <button
          type="button"
          onClick={() => props.onOpenVisualComposer('block', imageBlockIndex)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-accent-gold/40 bg-accent-gold/20 px-2 py-1 text-[11px] font-bold text-accent-gold transition-colors hover:bg-accent-gold/30"
          title="Customize Image Box Model, Corners, Borders & Hover in Visual Composer (⌘E)"
          aria-label="Image Visual Composer"
        >
          <SlidersHorizontal size={12} />
          <span className="hidden sm:inline">Styles</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => props.onCancelImageEdit(imageSession)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        title="Dismiss image controls"
        aria-label="Dismiss image controls"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Default context zone — toolbar, block list, viewport switcher
// ══════════════════════════════════════════════════════════════════════════

function DefaultContextZone(props: VisualEditorSidebarProps) {
  const {
    contentRow,
    dirty,
    savingBackend,
    sections,
    blocks,
    enabledSectionKeys,
    history,
    activeBlockIndex,
    pageRegions,
    activeRegionId,
    activeRegionLabel,
    showSectionBadges,
    showAllSectionBorders,
    showInspector,
    viewportMode,
    deviceOrientation,
    themeMode,
    effectiveTheme,
    backendStatus,
    backendSummary,
    showHealthDetails,
    statusLoading,
    modifiedBlocks,
    modifiedDataPoints,
    blockTypeOptions,
    adminEditUrl,
  } = props;

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 text-xs">
      {/* ── Document info & status ─────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {contentRow ? (
          <button
            type="button"
            onClick={props.onTogglePageStatus}
            disabled={savingBackend}
            title="Click to toggle between Published and Draft"
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
              contentRow.status === 'publish'
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
            }`}
          >
            {contentRow.status === 'publish' ? 'Published' : 'Draft'}
          </button>
        ) : (
          <button
            type="button"
            onClick={props.onInitializeCMSPage}
            disabled={savingBackend}
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-accent/20 text-accent-gold hover:bg-accent/30"
            title={
              activeRegionId
                ? `Create the CMS row for the ${activeRegionLabel} region`
                : 'Click to sync page into Supabase content table'
            }
          >
            Connect to Supabase
          </button>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            dirty ? 'bg-amber-500/20 text-accent-gold' : 'bg-emerald-500/20 text-emerald-400'
          }`}
        >
          {dirty ? 'Unsaved' : 'Saved'}
        </span>
      </div>

      <p className="text-[11px] text-ink-muted-on-dark">
        {sections.length} {sections.length === 1 ? 'block' : 'blocks'} in the document (
        {dirty ? (
          <span className="font-bold text-accent-gold">unsaved changes</span>
        ) : (
          <span>saved</span>
        )}
        ) · {enabledSectionKeys.size} framed
      </p>

      {/* ── Copy region selector ───────────────────────────────────────── */}
      {pageRegions.length > 0 && (
        <fieldset className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
          <legend className="sr-only">Editable copy region</legend>
          <button
            type="button"
            onClick={() => props.onSetRegion(null)}
            aria-pressed={activeRegionId === null}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
              activeRegionId === null
                ? 'bg-accent-gold/20 text-accent-gold'
                : 'text-ink-muted-on-dark hover:text-white'
            }`}
          >
            Whole page
          </button>
          {pageRegions.map((region) => (
            <button
              key={region.id}
              type="button"
              onClick={() => props.onSetRegion(region.id)}
              aria-pressed={region.id === activeRegionId}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                region.id === activeRegionId
                  ? 'bg-accent-gold/20 text-accent-gold'
                  : 'text-ink-muted-on-dark hover:text-white'
              }`}
            >
              {region.label}
            </button>
          ))}
        </fieldset>
      )}

      {/* ── Primary actions ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={props.onUndo}
          disabled={!canUndo(history)}
          title="Undo the last change (⌘Z)"
          aria-label="Undo the last change"
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${
            canUndo(history)
              ? 'border-white/15 bg-white/10 text-ink-on-dark hover:bg-white/15'
              : 'border-white/10 bg-white/5 text-ink-muted-on-dark'
          }`}
        >
          <Undo2 size={13} />
          <span>Undo</span>
        </button>
        <button
          type="button"
          onClick={props.onRedo}
          disabled={!canRedo(history)}
          title="Redo (⌘⇧Z)"
          aria-label="Redo the last undone change"
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${
            canRedo(history)
              ? 'border-white/15 bg-white/10 text-ink-on-dark hover:bg-white/15'
              : 'border-white/10 bg-white/5 text-ink-muted-on-dark'
          }`}
        >
          <Redo2 size={13} />
          <span>Redo</span>
        </button>
      </div>

      <button
        type="button"
        onClick={props.onSave}
        disabled={savingBackend || !dirty}
        title={
          contentRow
            ? 'Write this document to Supabase'
            : 'Create the Supabase CMS row for this page from what is on screen'
        }
        className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider shadow-raised transition-all disabled:opacity-50 ${
          dirty
            ? 'bg-accent text-ink-strong hover:bg-accent-gold'
            : 'bg-white/10 text-ink-muted-on-dark'
        }`}
      >
        {savingBackend ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        <span>{contentRow ? (dirty ? 'Save' : 'Saved') : 'Connect'}</span>
        <kbd className="hidden sm:inline-block ml-0.5 text-[9px] font-mono opacity-70">⌘S</kbd>
      </button>

      {/* ── Command palette & tools ────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={props.onOpenCommandPalette}
          title="Open Command Palette & Jump to Block/DataPoint (⌘K)"
          aria-label="Open Command Palette"
          className="inline-flex w-full items-center gap-1.5 rounded-lg border border-accent-gold/40 bg-accent-gold/10 px-2.5 py-1.5 text-xs font-bold text-accent-gold transition-colors hover:bg-accent-gold/20 cursor-pointer"
        >
          <Search size={13} className="text-accent-gold" />
          <span className="flex-1 text-left">Command</span>
          <kbd className="rounded bg-black/30 px-1 py-0.5 text-[9px] font-mono">⌘K</kbd>
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.onOpenDataPointDrawer}
            title="Open Page DataPoints Matrix (⌘K -> DataPoints)"
            aria-label="Open DataPoints Matrix"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-bold text-sky-300 transition-colors hover:bg-sky-500/20 cursor-pointer"
          >
            <Database size={13} className="text-sky-400" />
            <span>DataPoints</span>
          </button>

          <button
            type="button"
            onClick={props.onOpenA11yAuditor}
            title="Run in-page Accessibility, SEO, and DataPoint audit (⌘⇧A)"
            aria-label="Run Civic A11y and Health Audit"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/10 cursor-pointer"
          >
            <ShieldCheck size={13} className="text-emerald-400" />
            <span>Audit</span>
          </button>
        </div>

        <button
          type="button"
          onClick={props.onOpenDiffModal}
          title="Review visual changes and draft diff against published version (⌘⇧V)"
          aria-label="Review visual changes diff"
          className={`inline-flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
            dirty || modifiedDataPoints.length > 0
              ? 'border-accent-gold/40 bg-accent-gold/15 text-accent-gold hover:bg-accent-gold/25'
              : 'border-white/10 bg-white/5 text-ink-on-dark hover:bg-white/10'
          }`}
        >
          <Activity size={13} className="text-accent-gold" />
          <span className="flex-1 text-left">Diff</span>
          {(dirty || modifiedDataPoints.length > 0) && (
            <span className="rounded-full bg-accent-gold/20 px-1.5 py-0.2 text-[9px] font-mono font-bold text-accent-gold">
              {modifiedBlocks.length + modifiedDataPoints.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Display toggles ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={props.onToggleInspector}
          title={
            showInspector
              ? 'Disable live element hover inspector HUD'
              : 'Enable live element hover inspector HUD'
          }
          aria-label="Toggle Inspector HUD"
          className={`inline-flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
            showInspector
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
              : 'border-white/10 bg-white/5 text-ink-muted-on-dark hover:bg-white/10'
          }`}
        >
          <Eye size={13} />
          <span className="flex-1 text-left">Inspector: {showInspector ? 'ON' : 'OFF'}</span>
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.onToggleBadges}
            title={
              showSectionBadges ? 'Hide in-page section badges' : 'Show in-page section badges'
            }
            aria-label={
              showSectionBadges ? 'Hide in-page section badges' : 'Show in-page section badges'
            }
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
              showSectionBadges
                ? 'border-accent-gold/50 bg-accent-gold/20 text-accent-gold'
                : 'border-white/10 bg-white/5 text-ink-muted-on-dark hover:bg-white/10'
            }`}
          >
            <Layers size={13} />
            <span>{showSectionBadges ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={props.onToggleFrames}
            title={showAllSectionBorders ? 'Hide section frames' : 'Show section frames'}
            aria-label={showAllSectionBorders ? 'Hide section frames' : 'Show section frames'}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
              showAllSectionBorders
                ? 'border-accent-gold/50 bg-accent-gold/20 text-accent-gold'
                : 'border-white/10 bg-white/5 text-ink-muted-on-dark hover:bg-white/10'
            }`}
          >
            <Eye size={13} />
            <span>{showAllSectionBorders ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* ── Theme preview ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={props.onCycleTheme}
        title={`Preview theme: ${themeModeLabel(themeMode)}${themeMode === 'system' ? ` (${effectiveTheme})` : ''} (click to cycle)`}
        aria-label="Cycle theme mode preview"
        className="inline-flex w-full items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-all duration-300 hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
      >
        {themeMode === 'light' ? (
          <Sun size={13} className="animate-in fade-in zoom-in-75 text-amber-300 duration-200" />
        ) : themeMode === 'dark' ? (
          <Moon size={13} className="animate-in fade-in zoom-in-75 text-blue-300 duration-200" />
        ) : (
          <span className="relative flex items-center justify-center">
            <Monitor
              size={13}
              className="animate-in fade-in zoom-in-75 text-emerald-300 duration-200"
            />
            <span
              aria-hidden="true"
              className={`absolute -right-0.5 -top-0.5 size-1.5 rounded-full ring-1 ring-secondary ${
                effectiveTheme === 'dark' ? 'bg-sky-400' : 'bg-amber-400'
              }`}
            />
          </span>
        )}
        <span className="flex-1 text-left capitalize">
          {themeModeLabel(themeMode)}
          {themeMode === 'system' ? (
            <span className="ml-1 text-[10px] font-medium lowercase text-ink-muted-on-dark">
              ({effectiveTheme})
            </span>
          ) : null}
        </span>
      </button>

      {/* ── Viewport switcher ──────────────────────────────────────────── */}
      <fieldset
        aria-label="Responsive viewport preview"
        className="inline-flex w-full items-center rounded-lg border border-white/10 bg-white/5 p-0.5"
      >
        <legend className="sr-only">Responsive viewport preview</legend>
        <button
          type="button"
          onClick={() => props.onSetViewportMode('desktop')}
          title="Desktop full viewport (100% width)"
          aria-label="Desktop viewport"
          aria-pressed={viewportMode === 'desktop'}
          className={`flex-1 rounded-md p-1.5 text-xs font-bold transition-colors ${
            viewportMode === 'desktop'
              ? 'bg-accent-gold/20 text-accent-gold'
              : 'text-ink-muted-on-dark hover:text-white'
          }`}
        >
          <Monitor size={13} />
        </button>
        <button
          type="button"
          onClick={() => props.onSetViewportMode('tablet')}
          title="Tablet viewport preview (768px width)"
          aria-label="Tablet viewport"
          aria-pressed={viewportMode === 'tablet'}
          className={`flex-1 rounded-md p-1.5 text-xs font-bold transition-colors ${
            viewportMode === 'tablet'
              ? 'bg-accent-gold/20 text-accent-gold'
              : 'text-ink-muted-on-dark hover:text-white'
          }`}
        >
          <Tablet size={13} />
        </button>
        <button
          type="button"
          onClick={() => props.onSetViewportMode('mobile')}
          title="Mobile viewport preview (390px iPhone width)"
          aria-label="Mobile viewport"
          aria-pressed={viewportMode === 'mobile'}
          className={`flex-1 rounded-md p-1.5 text-xs font-bold transition-colors ${
            viewportMode === 'mobile'
              ? 'bg-accent-gold/20 text-accent-gold'
              : 'text-ink-muted-on-dark hover:text-white'
          }`}
        >
          <Smartphone size={13} />
        </button>
        {viewportMode !== 'desktop' && (
          <>
            <button
              type="button"
              onClick={props.onRotateOrientation}
              title={`Rotate device orientation (${deviceOrientation === 'portrait' ? 'Landscape' : 'Portrait'})`}
              aria-label="Rotate device orientation"
              className="rounded-md p-1.5 text-xs font-bold text-accent-gold transition-colors hover:bg-white/10"
            >
              <RotateCw size={13} />
            </button>
            <span className="px-1.5 text-[10px] font-mono font-bold text-accent-gold">
              {viewportMode === 'mobile'
                ? deviceOrientation === 'portrait'
                  ? '390px'
                  : '844px'
                : deviceOrientation === 'portrait'
                  ? '768px'
                  : '1024px'}
            </span>
          </>
        )}
      </fieldset>

      {/* ── Jump to block ──────────────────────────────────────────────── */}
      {sections.length > 0 && (
        <select
          aria-label="Jump to block"
          onChange={(e) => {
            const blockIndex = Number.parseInt(e.target.value, 10);
            if (Number.isInteger(blockIndex)) props.onJumpToBlock(blockIndex);
          }}
          className="w-full rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-accent-gold"
          value=""
        >
          <option value="" disabled className="bg-secondary text-ink-on-dark">
            Jump to block…
          </option>
          {sections.map((sec) => (
            <option key={sec.key} value={sec.blockIndex} className="bg-secondary text-ink-on-dark">
              {sec.ordinal}. {sec.label}
            </option>
          ))}
        </select>
      )}

      {/* ── Add Block ──────────────────────────────────────────────────── */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-bright px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-colors hover:bg-primary-light focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <Plus size={14} />
            <span>Add Block</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            side="left"
            sideOffset={8}
            aria-label="Add block"
            className="z-50 w-48 rounded-xl border border-white/15 bg-secondary p-1.5 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            {blockTypeOptions.map((option) => (
              <DropdownMenu.Item
                key={option.type}
                onSelect={() => props.onAddBlock(option.type)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
              >
                {option.label}
              </DropdownMenu.Item>
            ))}
            <div className="my-1 h-px bg-white/10" />
            <DropdownMenu.Item
              onSelect={() => props.onOpenBlockLibrary(null)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-accent-gold hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              <Layers size={13} />
              <span>Element Library &amp; Templates...</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* ── Design & page tools ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => props.onOpenVisualComposer('block', activeBlockIndex ?? 0)}
            title="Visual Composer: Full Design & Box Model Inspector (⌘E)"
            aria-label="Visual Composer Inspector"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent-gold/30 bg-accent-gold/15 px-2.5 py-1.5 text-xs font-bold text-accent-gold transition-colors hover:bg-accent-gold/25 focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <SlidersHorizontal size={14} />
            <span>Composer</span>
          </button>

          <button
            type="button"
            onClick={props.onOpenPageNavigator}
            title="Page Structure Navigator & Tree (⌘7)"
            aria-label="Page Structure Navigator"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/15 px-2.5 py-1.5 text-xs font-bold text-sky-300 transition-colors hover:bg-sky-400/25 focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ListTree size={14} />
            <span>Tree</span>
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => props.onOpenMedia('section')}
            title="Open Supabase S3 Media Library"
            aria-label="Open Supabase S3 Media Library"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <FolderOpen size={14} className="text-accent-gold" />
            <span>Media</span>
          </button>

          <button
            type="button"
            onClick={props.onOpenSettings}
            title="Edit page title, slug, and featured image"
            aria-label="Edit page title, slug, and featured image"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>
        </div>

        {contentRow && (
          <button
            type="button"
            onClick={props.onOpenRevisions}
            title="View page revision history and restore previous snapshots"
            aria-label="View page revision history and restore previous snapshots"
            className="inline-flex w-full items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <History size={14} />
            <span>Revisions</span>
          </button>
        )}
      </div>

      {/* ── Create & CRM ──────────────────────────────────────────────── */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            title="Create or manage: Posts, Events, Bulletins, or Links"
            aria-label="Create or manage: Posts, Events, Bulletins, or Links"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary-bright/40 bg-primary/20 px-2.5 py-1.5 text-xs font-bold text-primary-on-dark transition-colors hover:bg-primary/30 focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <Plus size={14} className="text-accent-gold" />
            <span>Publish</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="left"
            align="start"
            sideOffset={8}
            className="z-50 min-w-48 rounded-xl border border-white/15 bg-secondary p-1.5 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <DropdownMenu.Item
              onSelect={props.onNewPost}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              <FilePlus2 size={14} className="text-primary-on-dark" />
              <span>New Post</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => props.onOpenCRM('events')}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              <Calendar size={14} className="text-purple-400" />
              <span>Manage Events</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => props.onOpenCRM('news')}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              <Newspaper size={14} className="text-accent-gold" />
              <span>Manage Bulletins</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => props.onOpenCRM('links')}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              <LinkIcon size={14} className="text-emerald-400" />
              <span>Manage Action Links</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => props.onOpenCRM()}
          title="Open Civic CRM (Constituents, Events, News, Links)"
          aria-label="Open Civic CRM (Constituents, Events, News, Links)"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
        >
          <UsersRound size={14} className="text-emerald-400" />
          <span>CRM</span>
        </button>

        <a
          href="/admin/crm/broadcasts"
          target="_blank"
          rel="noreferrer"
          title="Open CRM Studio (Broadcasts & Constituents)"
          aria-label="Open CRM Studio (Broadcasts & Constituents)"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
        >
          <ExternalLink size={14} className="text-primary-on-dark" />
          <span>Studio</span>
        </a>
      </div>

      {/* ── Info: shortcuts & health ──────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onOpenShortcuts}
            title="Keyboard shortcuts cheat sheet (⌘/)"
            aria-label="Keyboard shortcuts cheat sheet"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <Keyboard size={14} className="text-accent-gold" />
            <span>Shortcuts</span>
          </button>

          <button
            type="button"
            onClick={props.onToggleHealthDetails}
            title="Supabase Backend & Edge Function Health"
            aria-label="Supabase Backend & Edge Function Health"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-bold text-ink-muted-on-dark hover:bg-white/10"
          >
            <Activity
              size={13}
              className={
                backendStatus?.database && backendStatus?.storage && backendStatus?.edgeFunction
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }
            />
            <span
              className={`size-2 rounded-full ${
                backendStatus?.database && backendStatus?.storage && backendStatus?.edgeFunction
                  ? 'bg-emerald-400'
                  : !backendStatus?.database || !backendStatus?.storage
                    ? 'bg-rose-400'
                    : 'bg-amber-400'
              }`}
            />
          </button>
        </div>

        {showHealthDetails && backendStatus && (
          <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="font-black uppercase tracking-wider text-white">Backend Health</span>
              <button
                type="button"
                onClick={props.onProbeBackendHealth}
                disabled={statusLoading}
                className="p-1 text-slate-400 hover:text-white"
                aria-label="Refresh health probe"
              >
                <RefreshCw size={12} className={statusLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="flex items-center justify-between text-ink-on-dark">
              <span>Database (Postgres)</span>
              <span
                className={
                  backendStatus.database ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'
                }
              >
                {backendStatus.database ? 'Connected' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between text-ink-on-dark">
              <span>Supabase S3 Storage</span>
              <span
                className={
                  backendStatus.storage ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'
                }
              >
                {backendStatus.storage ? 'media bucket ready' : 'Error'}
              </span>
            </div>
            <div className="flex items-center justify-between text-ink-on-dark">
              <span>Edge Functions</span>
              <span
                className={
                  backendStatus.edgeFunction
                    ? 'font-bold text-emerald-400'
                    : 'font-bold text-amber-400'
                }
              >
                {backendStatus.edgeFunction ? 'Healthy' : 'Fallback'}
              </span>
            </div>
            {backendStatus.edgeFunctionDetails?.latencyMs !== undefined && (
              <div className="text-right text-[10px] text-ink-muted-on-dark">
                Latency: {backendStatus.edgeFunctionDetails.latencyMs}ms
              </div>
            )}
            {backendSummary && (
              <div className="space-y-1.5 border-t border-white/10 pt-2">
                <div className="flex items-center justify-between text-ink-on-dark">
                  <span>Constituents</span>
                  <span className="font-bold">
                    {backendSummary.crmTotal ?? '—'}
                    <span className="font-medium text-ink-muted-on-dark">
                      {' '}
                      · {backendSummary.segments} segments
                      {backendSummary.segmentsTruncated ? '+' : ''}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-ink-on-dark">
                  <span>Catalog</span>
                  <span className="font-bold">
                    {backendSummary.products} products · {backendSummary.gallery} photos ·{' '}
                    {backendSummary.events} events
                  </span>
                </div>
                <div className="flex items-center justify-between text-ink-on-dark">
                  <span>Media library</span>
                  <span className="font-bold">
                    {backendSummary.mediaItems} recent files
                    {backendSummary.mediaTruncated ? '+' : ''}
                  </span>
                </div>
                {(backendSummary.mediaTruncated ||
                  backendSummary.segmentsTruncated ||
                  backendSummary.revisionsTruncated) && (
                  <p className="text-[10px] text-ink-muted-on-dark">
                    Capped window — open the picker for the full list.
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={props.onOpenDiagnostics}
              className="mt-1 w-full rounded-md bg-white/5 py-1 text-center text-[11px] font-bold text-accent-gold transition-colors hover:bg-white/10 hover:text-white"
            >
              System Diagnostics →
            </button>
          </div>
        )}
      </div>

      {/* ── Admin link ────────────────────────────────────────────────── */}
      {adminEditUrl && (
        <a
          href={adminEditUrl}
          target="_blank"
          rel="noreferrer"
          title="Open full admin page editor in new tab"
          aria-label="Open full admin page editor in new tab"
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-muted-on-dark hover:bg-white/10 hover:text-white"
        >
          <span className="flex-1">Admin</span>
          <ExternalLink size={12} />
        </a>
      )}

      {/* ── Exit ──────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={props.onToggle}
        className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-accent-gold"
      >
        <X size={14} />
        <span>Done</span>
      </button>

      {/* ── Block list ────────────────────────────────────────────────── */}
      {blocks.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-ink-muted-on-dark">
            Blocks
          </span>
          <div className="flex flex-col gap-1">
            {blocks.map((block, idx) => {
              const label = sectionLabelForBlock(block);
              const section = sections.find((item) => item.blockIndex === idx);
              const framed = section ? enabledSectionKeys.has(section.key) : false;
              return (
                <div
                  key={block.id}
                  className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-ink-on-dark"
                >
                  <span className="flex-1 truncate font-semibold" title={label}>
                    {label}
                  </span>
                  {section && (
                    <button
                      type="button"
                      onClick={() => props.onToggleSectionFrame(idx)}
                      aria-pressed={framed}
                      aria-label={framed ? `Hide frame for ${label}` : `Show frame for ${label}`}
                      title={framed ? 'Hide visual frame' : 'Show visual frame'}
                      className={`p-0.5 transition-colors ${
                        framed
                          ? 'text-accent-gold hover:text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {framed ? <Eye size={11} /> : <EyeOff size={11} />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => props.onOpenEditSection(idx)}
                    title="Edit block"
                    aria-label={`Edit block ${label}`}
                    className="p-0.5 text-accent-gold hover:text-white"
                  >
                    <PenLine size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onOpenVisualComposer('block', idx)}
                    title="Visual Composer: Element Design & Box Model (⌘E)"
                    aria-label={`Visual Composer for ${label}`}
                    className="p-0.5 text-accent-gold hover:text-white"
                  >
                    <SlidersHorizontal size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onOpenVisualComposer('section', idx)}
                    title="Row / Section Settings (Containers, Dividers & Grid)"
                    aria-label={`Row settings for ${label}`}
                    className="p-0.5 text-sky-400 hover:text-white"
                  >
                    <LayoutTemplate size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onDuplicateSection(idx)}
                    title="Duplicate block"
                    aria-label={`Duplicate block ${label}`}
                    className="p-0.5 text-slate-400 hover:text-white"
                  >
                    <Copy size={11} />
                  </button>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => props.onMoveSection(idx, 'up')}
                      title="Move up"
                      aria-label={`Move block ${label} up`}
                      className="p-0.5 text-slate-400 hover:text-white"
                    >
                      <ArrowUp size={11} />
                    </button>
                  )}
                  {idx < blocks.length - 1 && (
                    <button
                      type="button"
                      onClick={() => props.onMoveSection(idx, 'down')}
                      title="Move down"
                      aria-label={`Move block ${label} down`}
                      className="p-0.5 text-slate-400 hover:text-white"
                    >
                      <ArrowDown size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Coded-route DataPoints (when no blocks) ───────────────────── */}
      {blocks.length === 0 && (
        <div className="flex flex-col gap-2 border-t border-white/10 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-accent-gold">
              <Database size={11} className="text-sky-400" />
              <span>Coded Route DataPoints:</span>
            </span>
          </div>
          <p className="text-[11px] text-ink-muted-on-dark">
            This page renders dynamic database fields. Click any element on page or open the matrix
            to edit live copy.
          </p>
          <button
            type="button"
            onClick={props.onOpenDataPointDrawer}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-300 transition-colors hover:bg-sky-500/30 cursor-pointer"
          >
            <Database size={12} />
            <span>Open DataPoints Matrix</span>
          </button>
        </div>
      )}
    </div>
  );
}
