'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ClipboardPaste,
  Code,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FilePlus2,
  FolderOpen,
  Globe,
  History,
  Image as ImageIcon,
  ImagePlus,
  Keyboard,
  Layers,
  Link as LinkIcon,
  Loader2,
  Monitor,
  Moon,
  Newspaper,
  PenLine,
  Plus,
  Redo2,
  RefreshCw,
  Settings,
  Smartphone,
  Sparkles,
  Sun,
  Tablet,
  Trash2,
  Undo2,
  Upload,
  UploadCloud,
  UsersRound,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CRMMediaLibraryModal } from '@/components/admin/crm/composer/CRMMediaLibraryModal';
import { useThemeMode } from '@/components/layout/theme-store';
import { useEditContext } from '@/components/layout/useEditContext';
import { useVisualEditMode } from '@/components/layout/visual-edit-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  type ContentRevision,
  getContentBySlugForEdit,
  getContentForEdit,
  getContentRevisions,
  restoreContentRevision,
  saveContent,
  setContentStatus,
} from '@/lib/actions/content';
import { getCRMEdgeFunctionHealth, uploadCRMMedia } from '@/lib/actions/crm';
import { getVisualPageContext, type VisualPageContext } from '@/lib/actions/visual';
import {
  type Block,
  CALLOUT_TONES,
  type CalloutTone,
  convertBlock,
  type HeadingLevel,
  nextBlockId,
  parseHtml,
  serializeBlocks,
} from '@/lib/blocks';
import { copyRegionSlug, getPageCopyRegions } from '@/lib/copy-regions';
import { clearDraft, isWorthRecovering, readDraft, writeDraft } from '@/lib/draft-recovery';
import { cmsSlugForPath } from '@/lib/edit-target';
// Aliased: `History` is the DOM's own global type. Importing it unaliased would
// make this a `useState<History>` of the browser's, not the editor's — and the
// two are not assignable in either direction.
import {
  canRedo,
  canUndo,
  type History as EditorHistory,
  EMPTY_HISTORY,
  record as recordHistory,
  redo as redoHistory,
  undo as undoHistory,
} from '@/lib/editor-history';
import { saveDataPoint } from '@/lib/queries/civic-client';
import { themeModeLabel } from '@/lib/theme';
import { isStaleConflict } from '@/lib/visual-edit/conflict';
import { extractBlocksFromDOM } from '@/lib/visual-edit/extract-blocks-from-dom';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';
import { highlightPageSection } from '@/lib/visual-edit-mode';
import {
  buildVisualSections,
  canMoveSection,
  moveTargetForSection,
  publishSections,
  sectionLabelForBlock,
  type VisualSection,
} from '@/lib/visual-sections';
import type {
  AddBlockDetail,
  BackendStatus,
  BackendSummary,
  ConvertSectionDetail,
  DeleteSectionDetail,
  DuplicateSectionDetail,
  FocusSectionDetail,
  MediaTarget,
  MoveSectionDetail,
  ToggleSectionDetail,
  VisualContentRow,
  VisualSectionOverlayItem,
} from '@/types/unified';
import { CRMPanel } from './CRMPanel';
import {
  applyInlineFormatCommand,
  type InlineFormatCommand,
  InlineFormatToolbar,
} from './InlineFormatToolbar';
import { runTextareaFormatCommand } from './textareaFormat';
import { useBlockWriter } from './useBlockWriter';

/**
 * Visual editing surface for every page across the site.
 *
 * Full in-page visual editor with CRUD connected directly to the Supabase backend:
 * - Live section discovery, highlighting, and on-section quick controls
 * - Per-section visual toggle: admins can turn on/off visual editing for each section
 * - Automatic DOM extraction: makes EVERY page immediately editable even before CMS row creation
 * - Section editor supporting Headings, Paragraphs, Lists, Images, Callouts, Quotes, Buttons, Dividers
 * - Supabase S3 Storage media library integration for image picking and uploading
 * - Supabase Edge Functions health status and latency monitoring
 * - Direct optimistic updates with server-side validation and concurrency safety
 */

export const VISUAL_EDIT_ROOT_ATTR = 'data-visual-edit-root';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export interface InlineEditSession {
  element: HTMLElement;
  initialHtml: string;
  dataPointKey: string | null;
  copyRegionId: string | null;
  blockIndex: number | null;
  top: number;
  left: number;
}

export interface ImageEditSession {
  element: HTMLImageElement;
  initialSrc: string;
  initialAlt: string;
  copyRegionId: string | null;
  blockIndex: number | null;
  top: number;
  left: number;
}

/**
 * The canonical block-type list, used by the dock's Add Block menu and the
 * section editor's type selector.
 *
 * One list, not two: a label added here and not to the selector is a block that
 * can be created but never converted back to, and a label removed here but left
 * there is the reverse. `CONVERT_BLOCK_OPTIONS` is deliberately separate — it
 * carries variants (heading levels, callout tones) rather than types.
 */
const BLOCK_TYPE_OPTIONS: ReadonlyArray<{ type: Block['type']; label: string }> = [
  { type: 'paragraph', label: 'Paragraph Text' },
  { type: 'heading', label: 'Heading' },
  { type: 'bulletList', label: 'Bullet List' },
  { type: 'orderedList', label: 'Numbered Steps' },
  { type: 'image', label: 'Image (Supabase S3)' },
  { type: 'table', label: 'Data Table' },
  { type: 'callout', label: 'Callout / Alert' },
  { type: 'button', label: 'Button CTA' },
  { type: 'quote', label: 'Quote' },
  { type: 'code', label: 'Code' },
  { type: 'divider', label: 'Divider' },
];

const CONVERT_BLOCK_OPTIONS: ReadonlyArray<{
  type: Block['type'];
  label: string;
  headingLevel?: HeadingLevel;
  calloutTone?: CalloutTone;
}> = [
  { type: 'heading', label: 'Heading 2 (H2)', headingLevel: 2 },
  { type: 'heading', label: 'Heading 3 (H3)', headingLevel: 3 },
  { type: 'paragraph', label: 'Paragraph Text' },
  { type: 'callout', label: 'Callout (Info)', calloutTone: 'info' },
  { type: 'callout', label: 'Callout (Action)', calloutTone: 'action' },
  { type: 'callout', label: 'Callout (Warning)', calloutTone: 'warning' },
  { type: 'quote', label: 'Quote Block' },
  { type: 'bulletList', label: 'Bullet List' },
  { type: 'code', label: 'Code Snippet' },
];

/** Every command the floating pill offers, in run order. */
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

/**
 * The section modal's paragraph toolbar. Deliberately narrower than the pill:
 * the field is a textarea of HTML, so list and block-format commands have no
 * selection to act on and would be controls that do nothing.
 */
const SECTION_MODAL_FORMAT_COMMANDS: readonly InlineFormatCommand[] = [
  'bold',
  'italic',
  'code',
  'strikethrough',
  'link',
];

export function VisualEditOverlay() {
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = rawPathname ?? '/';
  const { enabled, toggle } = useVisualEditMode(pathname);
  const { isAdmin, target } = useEditContext(pathname);
  const { mode: themeMode, effective: effectiveTheme, cycle: cycleTheme } = useThemeMode();

  // ── The document being edited ──────────────────────────────────────────────
  //
  // A coded page has no CMS row of its own — `RESERVED_SLUGS` refuses one,
  // because a slug matching an App Router segment is shadowed and unreachable.
  // So the editable unit on such a page is a *copy region*: a named slice that
  // owns its own `copy-`-prefixed row. The whole-page document still exists and
  // is what `[slug]` routes use; here it is simply the first option, "whole
  // page", and it is picked by default when the page has no regions.
  //
  // One active document at a time, and every piece of overlay state (row,
  // blocks, history, dirty, draft scope) belongs to it. Switching regions
  // re-runs `loadContentData`, which is the only writer of those.
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const pageRegions = useMemo(() => getPageCopyRegions(pathname), [pathname]);
  const documentSlug = useMemo(
    () => (activeRegionId ? copyRegionSlug(activeRegionId) : cmsSlugForPath(pathname)),
    [activeRegionId, pathname]
  );
  const activeRegion = useMemo(
    () => pageRegions.find((region) => region.id === activeRegionId) ?? null,
    [pageRegions, activeRegionId]
  );

  const rootRef = useRef<HTMLElement | null>(null);
  /**
   * The section model: one entry per block, each paired with the element that
   * renders it. Every mutation in this component addresses `blockIndex`; the
   * DOM ordinal is only ever used to find an element. See
   * `src/lib/visual-sections.ts` for why the two cannot be the same number.
   */
  const [sections, setSections] = useState<VisualSection[]>([]);
  const [contentRow, setContentRow] = useState<VisualContentRow | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [savingBackend, setSavingBackend] = useState(false);
  /**
   * Backend summary for the health panel: CRM reach, catalog depth, media
   * depth. From the one-gate `getVisualPageContext` summary — additive to the
   * health probe, never a second gate on the critical open path. Null until
   * the first successful fetch; a failure leaves the previous summary (or
   * nothing) rather than blanking the panel.
   */
  const [backendSummary, setBackendSummary] = useState<BackendSummary | null>(null);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);

  /** Section keys whose frame is drawn. The overlay owns this; the header asks. */
  const [enabledSectionKeys, setEnabledSectionKeys] = useState<Set<string>>(new Set());

  // In-page section badge and outline states
  const [showSectionBadges, setShowSectionBadges] = useState(true);
  const [showAllSectionBorders, setShowAllSectionBorders] = useState(true);
  const [sectionOverlays, setSectionOverlays] = useState<VisualSectionOverlayItem[]>([]);
  /** The block the operator is working on, for the highlighted frame. */
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);

  // ── Undo, dirty tracking and autosave ────────────────────────────────────
  // The overlay used to write every keystroke straight to `content`, which made
  // a mis-click on "delete section" a database write with no way back. It now
  // keeps the same two guards the `/admin/content` editor keeps: a snapshot
  // history grouped by intent, and a dirty flag derived from the serialized
  // body rather than flipped by hand.
  const [history, setHistory] = useState<EditorHistory>(EMPTY_HISTORY);
  /** The serialized body the last successful save wrote. */
  const [savedBody, setSavedBody] = useState<string>('');
  /** The local draft offered back on arrival, or null when there is nothing. */
  const [recoveredDraft, setRecoveredDraft] = useState<Block[] | null>(null);

  /**
   * The live blocks, for the effects below.
   *
   * A ref rather than a dependency, because these effects must see the blocks
   * that exist *now* and re-subscribing them on every edit would tear down the
   * scroll listener on every keystroke.
   */
  const blocksRef = useRef<Block[]>([]);
  blocksRef.current = blocks;

  /** Same, for the section model the event handlers translate through. */
  const sectionsRef = useRef<VisualSection[]>([]);
  sectionsRef.current = sections;

  // Section editor modal state
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const activeSectionLabel = editingBlock ? sectionLabelForBlock(editingBlock) : '';

  // Page settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageFeaturedImage, setPageFeaturedImage] = useState('');
  const [pageStatus, setPageStatus] = useState<'publish' | 'draft'>('draft');
  const [previewTab, setPreviewTab] = useState<'serp' | 'social'>('serp');

  // Supabase S3 Storage media library modal state
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<MediaTarget>('section');

  // Revisions history modal state
  const [isRevisionsOpen, setIsRevisionsOpen] = useState(false);
  const [isCRMPanelOpen, setIsCRMPanelOpen] = useState(false);
  const [crmTab, setCrmTab] = useState<'constituents' | 'events' | 'news' | 'links'>(
    'constituents'
  );
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  const openCrmWithTab = useCallback(
    (tab?: 'constituents' | 'events' | 'news' | 'links') => {
      if (tab) {
        setCrmTab(tab);
      } else if (pathname === '/events') {
        setCrmTab('events');
      } else if (pathname === '/news') {
        setCrmTab('news');
      } else if (pathname === '/links') {
        setCrmTab('links');
      } else {
        setCrmTab('constituents');
      }
      setIsCRMPanelOpen(true);
    },
    [pathname]
  );

  // Backend health details popover state
  const [showHealthDetails, setShowHealthDetails] = useState(false);

  // Direct In-Place Click-To-Edit Session State
  const [inlineSession, setInlineSession] = useState<InlineEditSession | null>(null);
  const inlineSessionRef = useRef<InlineEditSession | null>(null);
  inlineSessionRef.current = inlineSession;
  const [inlineCounts, setInlineCounts] = useState<{ chars: number; words: number }>({
    chars: 0,
    words: 0,
  });

  // Direct Click-To-Replace Image Session State
  const [imageSession, setImageSession] = useState<ImageEditSession | null>(null);
  const imageSessionRef = useRef<ImageEditSession | null>(null);
  imageSessionRef.current = imageSession;
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // ── Link insertion dialog (replaces browser prompt) ─────────────────────
  // `textareaId` is set when the dialog is opened from the section modal's
  // textarea toolbar; null means it was opened from the inline contentEditable
  // pill, which uses `execCommand('createLink')` instead of `wrapSelection`.
  const [linkModal, setLinkModal] = useState<{
    textareaId: string | null;
    url: string;
    text: string;
  } | null>(null);

  // ── Alt text edit dialog (replaces browser prompt) ───────────────────────
  const [altTextModal, setAltTextModal] = useState<{
    session: ImageEditSession;
    value: string;
  } | null>(null);

  // Responsive Viewport Simulation Mode
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');

  const titleId = useId();
  const slugId = useId();
  const featuredImageId = useId();

  /** Copy the currently edited block to the clipboard as structured JSON */
  const handleCopyBlockJson = useCallback(() => {
    if (!editingBlock) return;
    void navigator.clipboard?.writeText(JSON.stringify(editingBlock, null, 2));
    toast.success('Block definition copied to clipboard as JSON');
  }, [editingBlock]);

  /** Paste block JSON from clipboard to update the currently edited block */
  const handlePasteBlockJson = useCallback(async () => {
    try {
      const text = await navigator.clipboard?.readText();
      if (!text?.trim()) {
        toast.error('Clipboard is empty');
        return;
      }
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !parsed.type) {
        toast.error('Clipboard does not contain a valid block object');
        return;
      }
      const pastedBlock: Block = {
        ...parsed,
        id: nextBlockId(),
      };
      setEditingBlock(pastedBlock);
      toast.success(`Replaced block with pasted ${pastedBlock.type} definition`);
    } catch {
      toast.error('Failed to read or parse block JSON from clipboard');
    }
  }, []);

  /** Export the current document and all its blocks as a portable JSON snapshot */
  const handleExportPageJson = useCallback(() => {
    const exportPayload = {
      version: 1,
      title: contentRow?.title || pageTitle || pathname,
      slug: contentRow?.slug || pageSlug || pathname.replace(/^\//, '') || 'page',
      type: contentRow?.type || 'page',
      status: contentRow?.status || 'draft',
      exportedAt: new Date().toISOString(),
      blocks,
    };
    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportPayload.slug || 'page'}-snapshot-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Page snapshot exported as JSON');
  }, [contentRow, pageTitle, pathname, pageSlug, blocks]);

  /**
   * Where the local draft for this document lives.
   *
   * The content id once there is one, and the pathname until then — a page with
   * no CMS row still has unsaved work, and keying that draft by nothing would
   * mean every unconnected page shared one slot and overwrote the others.
   */
  const draftScope = contentRow ? String(contentRow.id) : `path:${pathname}`;

  /** Show or hide one section's frame, and tell the header which changed. */
  const toggleSectionFrame = useCallback((blockIndex: number) => {
    const section = sectionsRef.current.find((item) => item.blockIndex === blockIndex);
    if (!section) return;
    setEnabledSectionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(section.key)) next.delete(section.key);
      else next.add(section.key);
      return next;
    });
  }, []);

  // Section editor field IDs for a11y
  const blockTypeId = useId();
  const headingContentId = useId();
  const paragraphContentId = useId();

  const calloutMessageId = useId();
  const imageSrcId = useId();
  const imageAltId = useId();
  const imageCaptionId = useId();
  const buttonLabelId = useId();
  const buttonHrefId = useId();
  const quoteTextId = useId();
  const codeTextId = useId();
  const listItemsId = useId();

  const findEffectiveVisualEditRoot = useCallback((): HTMLElement | null => {
    // A copy region is its own section root: its children are the copy an admin
    // edits, so pairing blocks against the page's sections would draw frames
    // over unrelated chrome.
    if (activeRegionId) {
      const region = document.querySelector<HTMLElement>(`[data-copy-region="${activeRegionId}"]`);
      if (region) return region;
    }

    const markedRoot = document.querySelector<HTMLElement>(`[${VISUAL_EDIT_ROOT_ATTR}]`);
    if (markedRoot) return markedRoot;

    const main = document.querySelector<HTMLElement>('main');
    if (!main) return null;

    if (
      main.children.length === 1 &&
      main.firstElementChild instanceof HTMLElement &&
      (main.firstElementChild as HTMLElement).children.length > 1
    ) {
      return main.firstElementChild as HTMLElement;
    }

    return main;
  }, [activeRegionId]);

  /**
   * The element that renders a given block, or null when the block has none.
   *
   * Takes a block index, not a DOM ordinal. The pairing is done once per
   * refresh by `buildVisualSections`, which is the only place that knows both
   * coordinate systems; looking the child up by ordinal here would reintroduce
   * the off-by-one the pairing exists to prevent.
   */
  const locate = useCallback(
    (blockIndex: number): HTMLElement | null => {
      const root = rootRef.current || findEffectiveVisualEditRoot();
      if (!root) return null;
      const section = sections.find((item) => item.blockIndex === blockIndex);
      if (!section || section.domIndex === null) return null;
      const element = root.children[section.domIndex];
      return element instanceof HTMLElement ? element : null;
    },
    [findEffectiveVisualEditRoot, sections]
  );

  /** Handle keyboard shortcuts in the editor. */
  const handleEditorShortcuts = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, textareaId: string) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const shortcuts: Record<string, InlineFormatCommand> = {
        b: 'bold',
        i: 'italic',
        u: 'underline',
        k: 'link',
      };
      const command = shortcuts[e.key.toLowerCase()];
      if (!command) return;
      e.preventDefault();
      if (command === 'link') {
        setLinkModal({ textareaId, url: '', text: '' });
      } else {
        runTextareaFormatCommand(textareaId, command);
      }
    },
    []
  );

  // Load content row and blocks when visual editing is turned on
  const loadContentData = useCallback(async () => {
    // A region is addressed by its own slug; the whole page keeps the old
    // slug-from-path behaviour, including the `home` fallback for `/`.
    let slug: string | null = documentSlug;
    const isRegion = activeRegionId !== null;
    if (!isRegion && !slug && (pathname === '/' || pathname === '')) {
      slug = 'home';
    }
    // The edit URL targets a specific row for the page document, and a region is
    // never that row, so it is only honoured when no region is active.
    const rowId = isRegion
      ? null
      : target?.editUrl
        ? Number.parseInt(target.editUrl.split('/').pop() || '', 10)
        : null;

    try {
      let row = null;
      if (rowId && !Number.isNaN(rowId) && rowId > 0) {
        try {
          const res = await fetch(`/api/visual-edit/content?id=${rowId}`);
          if (res.ok) {
            const json = await res.json();
            if (json.content) row = json.content;
          }
        } catch {
          // Fall through to server action
        }
        if (!row) {
          row = await getContentForEdit(rowId);
        }
      }
      if (!row && slug) {
        try {
          const res = await fetch(`/api/visual-edit/content?slug=${encodeURIComponent(slug)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.content) row = json.content;
          }
        } catch {
          // Fall through to server action
        }
        if (!row) {
          row = await getContentBySlugForEdit(slug);
        }
      }

      if (row) {
        setContentRow(row as VisualContentRow);
        setPageTitle(row.title);
        setPageSlug(row.slug);
        setPageFeaturedImage(row.featured_image || '');
        setPageStatus((row.status === 'publish' ? 'publish' : 'draft') as 'publish' | 'draft');
        const parsed = parseHtml(row.body || '');
        blocksRef.current = parsed;
        setBlocks(parsed);
        // The loaded document is the baseline "saved" state. Without this the
        // toolbar would report a freshly opened page as unsaved and offer to
        // write a document that is already on the server.
        setSavedBody(serializeBlocks(parsed));
      } else {
        // Fallback for a page or region with no CMS row yet: extract real blocks
        // from the live DOM, so the operator edits what they can see rather than
        // an empty document.
        setContentRow(null);
        const resolvedSlug =
          slug ||
          pathname
            .replace(/^\//, '')
            .replace(/[^a-z0-9-]/gi, '-')
            .toLowerCase() ||
          'home';
        setPageSlug(resolvedSlug);
        setPageTitle(
          (isRegion ? activeRegion?.label : null) ||
            document.querySelector('h1')?.textContent?.trim() ||
            target?.label ||
            resolvedSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        );
        const root = rootRef.current || findEffectiveVisualEditRoot();
        const extracted = root ? extractBlocksFromDOM(root) : [];
        blocksRef.current = extracted;
        setBlocks(extracted);
        setSavedBody(serializeBlocks(extracted));
      }
    } catch {
      // Non-fatal if loading row fails, extract from live DOM
      const root = rootRef.current || findEffectiveVisualEditRoot();
      const extracted = root ? extractBlocksFromDOM(root) : [];
      blocksRef.current = extracted;
      setBlocks(extracted);
      setSavedBody(serializeBlocks(extracted));
    }
  }, [activeRegion, activeRegionId, documentSlug, findEffectiveVisualEditRoot, pathname, target]);

  // Reload whenever the active document changes — switching regions must clear
  // the previous document's blocks, or the operator edits one region's copy
  // while looking at another's.
  useEffect(() => {
    if (activeRegionId === null) return;
    loadContentData();
  }, [activeRegionId, loadContentData]);

  // Connect / Initialize a document into a Supabase CMS row
  const handleInitializeCMSPage = async () => {
    // A region always uses its own slug — writing `copy-home-hero` under the
    // page's slug would shadow a route and silently vanish.
    const slug = documentSlug ?? 'home';
    const title =
      (activeRegionId ? activeRegion?.label : null) ||
      document.querySelector('h1')?.textContent?.trim() ||
      target?.label ||
      slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const root = rootRef.current || findEffectiveVisualEditRoot();
    const initialBlocks =
      blocks.length > 0
        ? blocks
        : root
          ? extractBlocksFromDOM(root)
          : [{ id: nextBlockId(), type: 'paragraph' as const, html: 'Add section copy here...' }];

    setSavingBackend(true);
    try {
      const res = await saveContentWithEdgeApi({
        title,
        slug,
        body: serializeBlocks(initialBlocks),
        type: 'page',
        status: 'publish',
      });
      if (res.success && res.data) {
        toast.success(`Page "${title}" connected to Supabase CMS!`);
        await loadContentData();
        router.refresh();
      } else {
        toast.error('Failed to initialize page in Supabase CMS');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error initializing page');
    } finally {
      setSavingBackend(false);
    }
  };

  /**
   * Save content and copy regions using Edge API function with server action fallback.
   */
  const saveContentWithEdgeApi = useCallback(async (payload: Parameters<typeof saveContent>[0]) => {
    try {
      const res = await fetch('/api/visual-edit/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return { success: true as const, data: json.data };
        }
      }
    } catch {
      // Fall back gracefully to direct server action
    }
    return await saveContent(payload);
  }, []);

  // Probe backend health (DB, S3 Storage, Edge Functions) + summary counts.
  const probeBackendHealth = useCallback(async () => {
    setStatusLoading(true);
    try {
      const health = await getCRMEdgeFunctionHealth();
      setBackendStatus(health);
    } catch {
      setBackendStatus({ database: false, storage: false, edgeFunction: false });
    }
    try {
      let ctx: VisualPageContext | null = null;
      try {
        const res = await fetch(
          `/api/visual-edit/context?pathname=${encodeURIComponent(pathname)}`
        );
        if (res.ok) {
          ctx = (await res.json()) as VisualPageContext;
        }
      } catch {
        // Fall through to server action
      }
      if (!ctx) {
        ctx = await getVisualPageContext({ pathname });
      }
      setBackendSummary({
        crmTotal: ctx.crmStats?.totalContacts ?? null,
        segments: ctx.segments.length,
        segmentsTruncated: ctx.segmentsTruncated,
        products: ctx.catalog.products,
        gallery: ctx.catalog.galleryPhotos,
        events: ctx.catalog.events,
        mediaItems: ctx.media.items.length,
        mediaTruncated: ctx.media.items.length >= 60,
        revisionsTruncated: ctx.revisionsTruncated,
      });
    } catch {
      // Summary is enrichment, not the probe — a failure keeps the old one.
    } finally {
      setStatusLoading(false);
    }
  }, [pathname]);

  /**
   * Publish the section model to the header.
   *
   * The header's editorial button renders this list verbatim. It used to run
   * its own `collectPageSections` and dispatch its own events, which produced a
   * second section list that agreed with the overlay's only while nothing had
   * been sanitized out of the page — so the header offered "Edit section 3" for
   * an element that was really section 4. One publisher, one list.
   */
  const publishSectionsToHeader = useCallback(
    (next: VisualSection[], enabled: ReadonlySet<string>) => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.sectionsPublished, {
          // `regionId` is part of the publication, not just the pathname: the
          // header compares on it so a section list cannot outlive the region it
          // described. Without it, switching regions leaves the menu listing the
          // previous region's sections.
          detail: {
            sections: publishSections(next, enabled),
            pathname,
            regionId: activeRegionId,
          },
        })
      );
    },
    [activeRegionId, pathname]
  );

  /**
   * Re-derive the section list from the current blocks and the live DOM.
   *
   * Called after every mutation and on resize, because a block that was added,
   * removed or re-ordered changes the pairing — and a stale pairing is a frame
   * drawn over the wrong paragraph.
   */
  const refreshSections = useCallback(
    (nextBlocks?: Block[]) => {
      const root = rootRef.current || findEffectiveVisualEditRoot();
      const source = nextBlocks ?? blocksRef.current;
      if (!root) {
        setSections([]);
        publishSectionsToHeader([], new Set());
        return;
      }
      const built = buildVisualSections(source, Array.from(root.children));
      setSections(built);
      // A new section is framed by default: the operator just created it, and
      // an invisible one would be a control that appears to do nothing.
      setEnabledSectionKeys((prev) => {
        const next = new Set(prev);
        for (const section of built) next.add(section.key);
        return next;
      });
    },
    [findEffectiveVisualEditRoot, publishSectionsToHeader]
  );

  // Collect DOM sections and load data when enabled
  useEffect(() => {
    if (!enabled || !isAdmin) {
      setSections([]);
      setEnabledSectionKeys(new Set());
      return;
    }

    const root = findEffectiveVisualEditRoot();
    rootRef.current = root;

    loadContentData();
    probeBackendHealth();
  }, [enabled, isAdmin, loadContentData, probeBackendHealth, findEffectiveVisualEditRoot]);

  /**
   * A region id belongs to the page it was chosen on.
   *
   * Navigating away without clearing it would address a region that does not
   * exist here — and because region slugs are unique across the site, the
   * overlay would happily load and edit a *different page's* copy while
   * rendering frames over this one. The effect that keys on `activeRegionId`
   * then reloads for the new page, so resetting first also keeps that reload
   * from reading the old page's blocks.
   *
   * `pathname` is read through a ref rather than listed as a dependency: the
   * dep is the *change*, not the value, and declaring it as a dep re-runs the
   * effect on mount for a value that has not changed.
   */
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    const previous = pathnameRef.current;
    pathnameRef.current = pathname;
    if (previous === pathname) return;
    setActiveRegionId(null);
  }, [pathname]);

  // Re-pair whenever the document or the DOM changes.
  useEffect(() => {
    if (!enabled || !isAdmin) return;
    refreshSections(blocks);
  }, [enabled, isAdmin, blocks, refreshSections]);

  /**
   * Publish the section model and its frame state to the header.
   *
   * Driven by the state itself rather than called from each place that changes
   * it, so a switch the header renders and a frame the overlay drew cannot
   * disagree. The earlier version published from inside `setState` updaters,
   * which both read the pre-update value and re-published on every unrelated
   * re-render.
   */
  useEffect(() => {
    if (!enabled || !isAdmin) return;
    publishSectionsToHeader(sections, enabledSectionKeys);
  }, [enabled, enabledSectionKeys, isAdmin, publishSectionsToHeader, sections]);

  // A resize can re-flow the page into different elements; re-pair so the
  // frames still sit on the blocks they claim.
  useEffect(() => {
    if (!enabled || !isAdmin) return;
    const onResize = () => refreshSections();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [enabled, isAdmin, refreshSections]);

  // Keep section overlay coordinates synchronized with viewport
  const updateOverlays = useCallback(() => {
    if (!enabled || !isAdmin) {
      setSectionOverlays([]);
      return;
    }
    const items: VisualSectionOverlayItem[] = [];

    for (const section of sections) {
      // Only render overlays for sections currently turned on
      if (!enabledSectionKeys.has(section.key)) continue;
      if (section.domIndex === null) continue;

      const el = locate(section.blockIndex);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;

      items.push({
        domIndex: section.domIndex,
        label: section.label,
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        bottom: r.bottom,
        right: r.right,
        blockIndex: section.blockIndex,
        blockType: section.blockType,
      });
    }

    setSectionOverlays(items);
  }, [enabled, isAdmin, sections, locate, enabledSectionKeys]);

  useEffect(() => {
    if (!enabled || !isAdmin) return;
    updateOverlays();
    let rafId: number;
    const onScrollOrResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateOverlays);
    };
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(updateOverlays);
      });
      const root = document.querySelector(`[${VISUAL_EDIT_ROOT_ATTR}]`) || document.body;
      if (root) resizeObserver.observe(root);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [enabled, isAdmin, updateOverlays]);

  const jumpTo = useCallback(
    (blockIndex: number) => {
      const element = locate(blockIndex);
      if (!element) return;

      setActiveBlockIndex(blockIndex);
      highlightPageSection(element);
    },
    [locate]
  );

  // ── Undo, redo, and the record of what changed ───────────────────────────

  const body = useMemo(() => serializeBlocks(blocks), [blocks]);
  const dirty = body !== savedBody;

  /**
   * The one way blocks change in this component.
   *
   * Every mutation — an edit, a move, a duplicate, an add, a delete, an undo —
   * comes through here, so the history cannot record a change that missed it.
   * The previous version set `blocks` directly in six places, which is why
   * undo was impossible: the history would have had to watch state it did not
   * own, and by the time an effect observes a change the model has already been
   * replaced.
   *
   * The unit is the serialized body, the same string `dirty` compares, because
   * two representations of "same document" would eventually disagree — and the
   * symptom would be an undo that reports no change beside a toolbar that says
   * there are unsaved edits.
   */
  const commitBlocks = useCallback(
    (next: Block[], coalesceKey: string | null = null) => {
      const previous = serializeBlocks(blocksRef.current);
      const current = serializeBlocks(next);
      if (previous === current) return;
      blocksRef.current = next;
      setBlocks(next);
      setHistory((currentHistory) => recordHistory(currentHistory, previous, current, coalesceKey));
      refreshSections(next);
    },
    [refreshSections]
  );

  /** Import a page snapshot JSON file to replace or restore blocks */
  const handleImportPageJson = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as {
          title?: string;
          slug?: string;
          blocks?: Block[];
        };
        if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
          toast.error('Invalid page snapshot: no blocks array found');
          return;
        }
        const validatedBlocks: Block[] = parsed.blocks.map((b) => ({
          ...b,
          id: nextBlockId(),
        }));
        if (parsed.title) setPageTitle(parsed.title);
        if (parsed.slug) setPageSlug(parsed.slug);
        commitBlocks(validatedBlocks);
        toast.success(`Imported ${validatedBlocks.length} blocks from page snapshot`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to import page snapshot JSON');
      }
    };
    input.click();
  }, [commitBlocks]);

  const handleUndo = useCallback(() => {
    const step = undoHistory(history, body);
    if (!step) return;
    const restored = parseHtml(step.restore);
    blocksRef.current = restored;
    setBlocks(restored);
    setHistory(step.history);
    refreshSections(restored);
  }, [body, history, refreshSections]);

  const handleRedo = useCallback(() => {
    const step = redoHistory(history, body);
    if (!step) return;
    const restored = parseHtml(step.restore);
    blocksRef.current = restored;
    setBlocks(restored);
    setHistory(step.history);
    refreshSections(restored);
  }, [body, history, refreshSections]);

  // --- CRUD Operations connected to Supabase Backend ---

  const handlePersistBlocks = useCallback(
    async (newBlocks: Block[], successMessage = 'Page saved') => {
      setSavingBackend(true);
      const newBody = serializeBlocks(newBlocks);

      try {
        // The row already knows its slug; a region with no row yet falls back to
        // the region's own slug, never the page's, so a first save of a region
        // cannot land on the page document.
        let slug = contentRow?.slug || documentSlug;
        if (!slug) {
          if (pathname === '/' || pathname === '') slug = 'home';
          else
            slug = pathname
              .replace(/^\//, '')
              .replace(/[^a-z0-9-]/gi, '-')
              .toLowerCase();
        }

        const title =
          contentRow?.title ||
          (activeRegionId ? activeRegion?.label : null) ||
          pageTitle ||
          document.querySelector('h1')?.textContent?.trim() ||
          target?.label ||
          slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        const res = await saveContentWithEdgeApi({
          id: contentRow?.id,
          title,
          slug,
          excerpt: contentRow?.excerpt || null,
          type: (contentRow?.type as 'page' | 'post') || 'page',
          status: (contentRow?.status === 'publish' ? 'publish' : 'draft') as 'publish' | 'draft',
          body: newBody,
          featuredImage: contentRow?.featured_image || pageFeaturedImage || null,
          expectedUpdatedAt: contentRow?.updated_at ?? undefined,
          metadata: contentRow?.metadata ?? {},
        });

        if (res.success) {
          toast.success(successMessage);
          setContentRow((prev) =>
            prev
              ? { ...prev, body: newBody, updated_at: res.data?.updatedAt }
              : {
                  id: res.data?.id || 1,
                  title,
                  slug,
                  excerpt: null,
                  type: 'page',
                  status: 'publish',
                  body: newBody,
                  featured_image: pageFeaturedImage || null,
                  metadata: {},
                  updated_at: res.data?.updatedAt,
                  created_at: new Date().toISOString(),
                  published_at: new Date().toISOString(),
                }
          );
          /**
           * The saved baseline is what the server acknowledged, not what was
           * asked for.
           *
           * `saveContent` reports the version its `BEFORE UPDATE` trigger wrote,
           * and that is the version the next save must be based on. Adopting a
           * local timestamp instead is how the editor ends up conflicting with
           * itself on the next autosave.
           */
          setSavedBody(newBody);
          setRecoveredDraft(null);
          clearDraft(draftScope);
          router.refresh();
        } else if (isStaleConflict(res.error)) {
          /**
           * Someone else wrote this page while it was open.
           *
           * The previous behaviour was a toast, which is indistinguishable from
           * every other failure and leaves the operator clicking Save into a
           * wall. The document is still on screen and still unsaved, so say
           * that, and offer the one action that resolves it.
           */
          toast.error(
            'This page was edited by someone else. Reload to see their version before saving.',
            { duration: 8000 }
          );
        } else {
          toast.error(res.error || 'Failed to save changes to backend');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error syncing with backend');
      } finally {
        setSavingBackend(false);
      }
    },
    [
      activeRegion,
      activeRegionId,
      contentRow,
      documentSlug,
      draftScope,
      pageFeaturedImage,
      pageTitle,
      pathname,
      router,
      saveContentWithEdgeApi,
      target,
    ]
  );

  /**
   * Shared write path for direct-edit surfaces (inline text, image alt/src,
   * section mutation). Keeps the copy-region-vs-block branch in one place so
   * the region-slug rule and the commit+persist pair cannot drift between
   * call sites.
   */
  const { writeToCopyRegion, writeToBlock } = useBlockWriter({
    commitBlocks,
    handlePersistBlocks,
    saveContentWithEdgeApi,
    setSavingBackend,
    setSavedBody,
    router,
  });

  /**
   * A local copy of the document, written as it changes.
   *
   * The overlay writes straight to the page, so a closed tab between two edits
   * is not covered by a revision — nothing was persisted to lose. This is the
   * same window `draft-recovery.ts` exists for in the CMS editor, and the same
   * rules apply: it is a cache, it never restores silently, and it is offered
   * rather than applied.
   */
  useEffect(() => {
    if (!enabled || !isAdmin || !dirty) return;
    const timer = window.setTimeout(() => writeDraft(draftScope, body), 400);
    return () => window.clearTimeout(timer);
  }, [body, dirty, draftScope, enabled, isAdmin]);

  /**
   * Offer a recovered draft on arrival — never apply it.
   *
   * Only when the document is otherwise untouched, so a recovered draft can
   * never overwrite work the operator has already done in this session.
   */
  useEffect(() => {
    if (!enabled || !isAdmin || !contentRow || dirty) return;
    const draft = readDraft(draftScope);
    if (!draft) return;
    if (!isWorthRecovering(draft, savedBody)) {
      clearDraft(draftScope);
      return;
    }
    const parsed = parseHtml(draft.snapshot);
    if (parsed.length === 0) return;
    setRecoveredDraft(parsed);
  }, [contentRow, draftScope, dirty, enabled, isAdmin, savedBody]);

  /**
   * Autosave, on the same three rules the CMS editor holds.
   *
   * **It never changes publish state** — an autosave that published a draft
   * would put a half-written page on the public site. **It never creates a page
   * from nothing** — that is `handlePersistBlocks`, reached deliberately.
   * **It stops after a failure** — retrying into a wall is how an editor
   * convinces someone their work is saved when it is not.
   */
  useEffect(() => {
    if (!enabled || !isAdmin || !contentRow || !dirty || savingBackend) return;
    const timer = window.setTimeout(() => {
      void handlePersistBlocks(blocksRef.current);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [contentRow, dirty, enabled, handlePersistBlocks, isAdmin, savingBackend]);

  const handleTogglePageStatus = async () => {
    if (!contentRow) return;
    const nextStatus = contentRow.status === 'publish' ? 'draft' : 'publish';
    setSavingBackend(true);
    try {
      const res = await setContentStatus(contentRow.id, nextStatus as 'publish' | 'draft');
      if (res.success) {
        toast.success(`Page marked as ${nextStatus}`);
        setContentRow((prev) => (prev ? { ...prev, status: nextStatus } : null));
        setPageStatus(nextStatus as 'publish' | 'draft');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update publication status');
      }
    } catch {
      toast.error('Failed to update publication status');
    } finally {
      setSavingBackend(false);
    }
  };

  const handleOpenEditSection = useCallback(
    (blockIndex: number) => {
      const targetBlock = blocksRef.current[blockIndex] || {
        id: nextBlockId(),
        type: 'paragraph' as const,
        html: sections.find((s) => s.blockIndex === blockIndex)?.label || '',
      };
      setEditingBlockIndex(blockIndex);
      setEditingBlock({ ...targetBlock });
      setIsSectionModalOpen(true);
    },
    [sections]
  );

  const handleAddNewSection = useCallback(
    (type: Block['type'], insertAfterBlockIndex?: number) => {
      const freshId = nextBlockId();
      let freshBlock: Block;
      switch (type) {
        case 'heading':
          freshBlock = { id: freshId, type: 'heading', level: 2, html: 'New Section Heading' };
          break;
        case 'paragraph':
          freshBlock = { id: freshId, type: 'paragraph', html: 'Add section copy here...' };
          break;
        case 'bulletList':
          freshBlock = {
            id: freshId,
            type: 'bulletList',
            items: ['Action item 1', 'Action item 2'],
          };
          break;
        case 'orderedList':
          freshBlock = { id: freshId, type: 'orderedList', items: ['Step 1', 'Step 2'] };
          break;
        case 'table':
          freshBlock = {
            id: freshId,
            type: 'table',
            head: ['Column A', 'Column B'],
            rows: [
              ['Row 1', 'Row 1'],
              ['Row 2', 'Row 2'],
            ],
          };
          break;
        case 'callout':
          freshBlock = {
            id: freshId,
            type: 'callout',
            tone: 'info',
            html: 'Important civic action note.',
          };
          break;
        case 'image':
          freshBlock = {
            id: freshId,
            type: 'image',
            src: '',
            alt: 'Image description',
            caption: '',
            width: null,
            height: null,
          };
          break;
        case 'button':
          freshBlock = { id: freshId, type: 'button', label: 'Take Action', href: '/take-action' };
          break;
        case 'quote':
          freshBlock = { id: freshId, type: 'quote', html: 'Inspiring constituent quote.' };
          break;
        case 'divider':
          freshBlock = { id: freshId, type: 'divider' };
          break;
        case 'code':
          freshBlock = { id: freshId, type: 'code', text: '// inline code block' };
          break;
        default:
          freshBlock = { id: freshId, type: 'paragraph', html: 'Content' };
      }

      const nextBlocks = [...blocksRef.current];
      let newIndex: number;
      if (
        insertAfterBlockIndex !== undefined &&
        insertAfterBlockIndex >= 0 &&
        insertAfterBlockIndex < nextBlocks.length
      ) {
        nextBlocks.splice(insertAfterBlockIndex + 1, 0, freshBlock);
        newIndex = insertAfterBlockIndex + 1;
      } else {
        nextBlocks.push(freshBlock);
        newIndex = nextBlocks.length - 1;
      }
      commitBlocks(nextBlocks);
      setEditingBlockIndex(newIndex);
      setEditingBlock(freshBlock);
      setIsSectionModalOpen(true);
    },
    [commitBlocks]
  );

  const handleSaveSectionModal = async () => {
    if (!editingBlock || editingBlockIndex === null) return;
    const nextBlocks = [...blocksRef.current];
    nextBlocks[editingBlockIndex] = editingBlock;
    setIsSectionModalOpen(false);
    commitBlocks(nextBlocks);
    await handlePersistBlocks(nextBlocks, 'Section updated in Supabase');
  };

  const cancelInlineEdit = useCallback((session: InlineEditSession) => {
    session.element.contentEditable = 'false';
    session.element.classList.remove('visual-inline-active');
    session.element.innerHTML = session.initialHtml;
    inlineSessionRef.current = null;
    setInlineSession(null);
    toast.info('Changes cancelled');
  }, []);

  const commitInlineEdit = useCallback(
    async (session: InlineEditSession) => {
      const { element, initialHtml, dataPointKey, copyRegionId, blockIndex } = session;
      element.contentEditable = 'false';
      element.classList.remove('visual-inline-active');
      setInlineSession(null);

      const updatedHtml = element.innerHTML;
      if (updatedHtml === initialHtml) {
        return;
      }

      if (dataPointKey) {
        setSavingBackend(true);
        try {
          const textVal = element.textContent?.trim() || '';
          const groupName = dataPointKey.split('.')[0] || 'general';
          const res = await saveDataPoint({
            key: dataPointKey,
            value: textVal,
            group_name: groupName,
            label: dataPointKey,
          });
          if (res.success) {
            toast.success(`Data point "${dataPointKey}" saved to database`);
            window.dispatchEvent(
              new CustomEvent('data-point-saved', {
                detail: { key: dataPointKey, value: textVal },
              })
            );
            router.refresh();
          } else {
            toast.error(res.error || 'Failed to save data point');
            element.innerHTML = initialHtml;
          }
        } catch {
          toast.error('Failed to save changes');
          element.innerHTML = initialHtml;
        } finally {
          setSavingBackend(false);
        }
        return;
      }

      if (copyRegionId) {
        await writeToCopyRegion({
          copyRegionId,
          successMessage: `Region "${copyRegionId}" updated and published`,
          errorMessage: 'Failed to save copy region',
          onRollback: () => {
            element.innerHTML = initialHtml;
          },
        });
        return;
      }

      if (blockIndex !== null && blocksRef.current[blockIndex]) {
        await writeToBlock({
          blockIndex,
          blocks: blocksRef.current,
          successMessage: 'Section saved to backend',
          mutate: (target) => {
            if (target.type === 'heading') {
              return { ...target, html: element.textContent?.trim() || '' };
            }
            if (
              target.type === 'paragraph' ||
              target.type === 'quote' ||
              target.type === 'callout'
            ) {
              return { ...target, html: updatedHtml };
            }
            if (target.type === 'button') {
              return { ...target, label: element.textContent?.trim() || target.label };
            }
            return undefined;
          },
        });
        return;
      }

      toast.success('Section text updated');
    },
    [router, writeToBlock, writeToCopyRegion]
  );

  const handleSaveImageAlt = useCallback(
    async (session: ImageEditSession, newAlt: string) => {
      const { element, copyRegionId, blockIndex } = session;
      element.alt = newAlt;
      if (copyRegionId) {
        await writeToCopyRegion({
          copyRegionId,
          successMessage: 'Alt text saved to copy region',
          errorMessage: 'Failed to save alt text',
        });
        return;
      }
      if (blockIndex !== null && blocksRef.current[blockIndex]) {
        await writeToBlock({
          blockIndex,
          blocks: blocksRef.current,
          successMessage: 'Image alt text updated',
          errorMessage: 'Failed to save alt text',
          mutate: (target) => (target.type === 'image' ? { ...target, alt: newAlt } : undefined),
        });
        return;
      }
      toast.success('Alt text updated');
    },
    [writeToBlock, writeToCopyRegion]
  );

  const handleDirectImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !imageSessionRef.current) return;
      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'content');
        const res = await uploadCRMMedia(formData);
        if (res.success && res.data?.url) {
          const newUrl = res.data.url;
          const session = imageSessionRef.current;
          session.element.src = newUrl;
          if (session.copyRegionId) {
            await writeToCopyRegion({
              copyRegionId: session.copyRegionId,
              successMessage: 'Image uploaded and saved to region!',
              errorMessage: 'Failed to save copy region',
            });
          } else if (session.blockIndex !== null && blocksRef.current[session.blockIndex]) {
            await writeToBlock({
              blockIndex: session.blockIndex,
              blocks: blocksRef.current,
              successMessage: 'Image replaced and saved',
              errorMessage: 'Image upload failed',
              mutate: (target) =>
                target.type === 'image' ? { ...target, src: newUrl } : undefined,
            });
          }
          setImageSession(null);
          imageSessionRef.current = null;
        } else {
          toast.error(res.error || 'Failed to upload image file');
        }
      } catch {
        toast.error('Image upload failed');
      } finally {
        setIsUploadingImage(false);
        if (e.target) e.target.value = '';
      }
    },
    [writeToBlock, writeToCopyRegion]
  );

  // Responsive Viewport Simulation effect: smoothly constrain <main>
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;

    if (!enabled || !isAdmin || viewportMode === 'desktop') {
      main.style.maxWidth = '';
      main.style.marginLeft = '';
      main.style.marginRight = '';
      main.style.boxShadow = '';
      main.style.borderLeft = '';
      main.style.borderRight = '';
      main.style.transition = 'max-width 300ms ease-out';
    } else if (viewportMode === 'mobile') {
      main.style.maxWidth = '390px';
      main.style.marginLeft = 'auto';
      main.style.marginRight = 'auto';
      main.style.boxShadow = '0 25px 60px -15px rgba(0, 0, 0, 0.7)';
      main.style.borderLeft = '1px solid rgba(255, 255, 255, 0.15)';
      main.style.borderRight = '1px solid rgba(255, 255, 255, 0.15)';
      main.style.transition = 'max-width 300ms ease-out';
    } else if (viewportMode === 'tablet') {
      main.style.maxWidth = '768px';
      main.style.marginLeft = 'auto';
      main.style.marginRight = 'auto';
      main.style.boxShadow = '0 25px 60px -15px rgba(0, 0, 0, 0.5)';
      main.style.borderLeft = '1px solid rgba(255, 255, 255, 0.12)';
      main.style.borderRight = '1px solid rgba(255, 255, 255, 0.12)';
      main.style.transition = 'max-width 300ms ease-out';
    }

    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 320);

    return () => {
      clearTimeout(timer);
    };
  }, [enabled, isAdmin, viewportMode]);

  // Clean up viewport simulation styles on unmount
  useEffect(() => {
    return () => {
      const main = document.querySelector('main');
      if (main) {
        main.style.maxWidth = '';
        main.style.marginLeft = '';
        main.style.marginRight = '';
        main.style.boxShadow = '';
        main.style.borderLeft = '';
        main.style.borderRight = '';
      }
    };
  }, []);

  // In-place direct click-to-edit listener for sections, copy regions, and images
  useEffect(() => {
    if (!enabled || !isAdmin) {
      if (inlineSessionRef.current) {
        const { element, initialHtml } = inlineSessionRef.current;
        element.contentEditable = 'false';
        element.classList.remove('visual-inline-active');
        element.innerHTML = initialHtml;
        setInlineSession(null);
      }
      if (imageSessionRef.current) {
        const { element, initialSrc, initialAlt } = imageSessionRef.current;
        element.src = initialSrc;
        element.alt = initialAlt;
        imageSessionRef.current = null;
        setImageSession(null);
      }
      document.body.removeAttribute('data-editorial-mode');
      return;
    }

    document.body.setAttribute('data-editorial-mode', 'active');

    const handleClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Exclude overlay chrome, dialogs, toolbars, and interactive civic/app controls
      if (
        target.closest('[data-testid="visual-edit-overlay"]') ||
        target.closest('[data-section-overlay="true"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('[role="toolbar"]') ||
        target.closest('[data-inline-toolbar="true"]') ||
        target.closest('header') ||
        target.closest('nav') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('button[data-confirm-action]') ||
        target.closest('[role="tab"]') ||
        target.closest('[role="tablist"]') ||
        target.closest('[role="switch"]') ||
        target.closest('[role="menu"]') ||
        target.closest('[role="menuitem"]') ||
        target.closest('[data-interactive-control="true"]') ||
        target.closest('[data-civic-control]') ||
        target.closest('[data-no-inline-edit]') ||
        target.closest('.audio-player') ||
        target.closest('audio') ||
        target.closest('video') ||
        target.closest('iframe')
      ) {
        return;
      }

      const main = target.closest('main');
      if (!main) return;

      if (
        inlineSessionRef.current &&
        (inlineSessionRef.current.element === target ||
          inlineSessionRef.current.element.contains(target))
      ) {
        return;
      }

      if (inlineSessionRef.current && inlineSessionRef.current.element !== target) {
        void commitInlineEdit(inlineSessionRef.current);
      }

      // Check if clicking an image directly
      const clickedImg =
        target.tagName === 'IMG'
          ? (target as HTMLImageElement)
          : target.querySelector<HTMLImageElement>('img');

      if (clickedImg && clickedImg instanceof HTMLImageElement) {
        e.preventDefault();
        e.stopPropagation();

        const copyRegionContainer = clickedImg.closest<HTMLElement>('[data-copy-region]');
        const copyRegionId = copyRegionContainer?.getAttribute('data-copy-region') || null;

        let matchedBlockIdx: number | null = null;
        for (const sec of sectionsRef.current) {
          const el = locate(sec.blockIndex);
          if (el && (el === clickedImg || el.contains(clickedImg))) {
            matchedBlockIdx = sec.blockIndex;
            break;
          }
        }

        const r = clickedImg.getBoundingClientRect();
        const session: ImageEditSession = {
          element: clickedImg,
          initialSrc: clickedImg.src,
          initialAlt: clickedImg.alt || '',
          copyRegionId,
          blockIndex: matchedBlockIdx,
          top: Math.max(12, r.top - 46),
          left: Math.max(12, Math.min(window.innerWidth - 380, r.left)),
        };
        imageSessionRef.current = session;
        setImageSession(session);
        return;
      }

      const dataPointContainer = target.closest<HTMLElement>('[data-data-point]');
      const dataPointKey = dataPointContainer?.getAttribute('data-data-point') || null;

      const copyRegionContainer = target.closest<HTMLElement>('[data-copy-region]');
      const copyRegionId = copyRegionContainer?.getAttribute('data-copy-region') || null;

      const editable =
        dataPointContainer ||
        target.closest<HTMLElement>(
          'h1, h2, h3, h4, h5, h6, p, blockquote, li, dt, dd, [data-copy-region] span, a, button, [data-data-point]'
        ) ||
        target;

      e.preventDefault();
      e.stopPropagation();

      let matchedBlockIdx: number | null = null;
      for (const sec of sectionsRef.current) {
        const el = locate(sec.blockIndex);
        if (el && (el === editable || el.contains(editable))) {
          matchedBlockIdx = sec.blockIndex;
          break;
        }
      }

      const initialHtml = editable.innerHTML;
      editable.contentEditable = 'true';
      editable.classList.add('visual-inline-active');
      editable.focus();

      const r = editable.getBoundingClientRect();
      const text = editable.textContent || '';
      setInlineCounts({
        chars: text.length,
        words: text.trim() ? text.trim().split(/\s+/).length : 0,
      });

      const session: InlineEditSession = {
        element: editable,
        initialHtml,
        dataPointKey,
        copyRegionId,
        blockIndex: matchedBlockIdx,
        top: Math.max(12, r.top - 46),
        left: Math.max(12, Math.min(window.innerWidth - 500, r.left)),
      };
      inlineSessionRef.current = session;
      setInlineSession(session);
    };

    window.addEventListener('click', handleClickCapture, { capture: true });
    return () => {
      window.removeEventListener('click', handleClickCapture, { capture: true });
      document.body.removeAttribute('data-editorial-mode');
    };
  }, [enabled, isAdmin, locate, commitInlineEdit]);

  useEffect(() => {
    if (!inlineSession && !imageSession) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (inlineSession) {
        const comboCommand: Record<string, InlineFormatCommand> = {
          b: 'bold',
          i: 'italic',
          u: 'underline',
          k: 'link',
        };
        const command = e.metaKey || e.ctrlKey ? comboCommand[e.key.toLowerCase()] : undefined;
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelInlineEdit(inlineSession);
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void commitInlineEdit(inlineSession);
        } else if (command) {
          e.preventDefault();
          if (command === 'link') {
            setLinkModal({ textareaId: null, url: '', text: '' });
          } else {
            applyInlineFormatCommand(command);
          }
        }
      } else if (imageSession) {
        if (e.key === 'Escape') {
          e.preventDefault();
          imageSession.element.src = imageSession.initialSrc;
          imageSession.element.alt = imageSession.initialAlt;
          imageSessionRef.current = null;
          setImageSession(null);
        }
      }
    };

    const onInput = () => {
      if (inlineSession) {
        const text = inlineSession.element.textContent || '';
        setInlineCounts({
          chars: text.length,
          words: text.trim() ? text.trim().split(/\s+/).length : 0,
        });
      }
    };

    const targetEl = inlineSession?.element;
    if (targetEl) {
      targetEl.addEventListener('input', onInput);
    }

    const updatePos = () => {
      if (inlineSession) {
        if (!inlineSession.element.isConnected) {
          setInlineSession(null);
          return;
        }
        const r = inlineSession.element.getBoundingClientRect();
        setInlineSession((prev) =>
          prev
            ? {
                ...prev,
                top: Math.max(12, r.top - 46),
                left: Math.max(12, Math.min(window.innerWidth - 500, r.left)),
              }
            : null
        );
      }
      if (imageSession) {
        if (!imageSession.element.isConnected) {
          setImageSession(null);
          return;
        }
        const r = imageSession.element.getBoundingClientRect();
        setImageSession((prev) =>
          prev
            ? {
                ...prev,
                top: Math.max(12, r.top - 46),
                left: Math.max(12, Math.min(window.innerWidth - 380, r.left)),
              }
            : null
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', updatePos, { passive: true });
    window.addEventListener('resize', updatePos, { passive: true });
    return () => {
      if (targetEl) {
        targetEl.removeEventListener('input', onInput);
      }
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', updatePos);
      window.removeEventListener('resize', updatePos);
    };
  }, [inlineSession, imageSession, cancelInlineEdit, commitInlineEdit]);

  const handleDeleteSection = useCallback(
    async (blockIndex: number) => {
      const nextBlocks = blocksRef.current.filter((_, i) => i !== blockIndex);
      // Null is deliberate: a discrete operation gets its own undo step, so two
      // deletes are two undos rather than one.
      commitBlocks(nextBlocks, null);
      await handlePersistBlocks(nextBlocks, 'Section deleted from Supabase');
    },
    [commitBlocks, handlePersistBlocks]
  );

  const handleMoveSection = useCallback(
    async (blockIndex: number, direction: 'up' | 'down') => {
      // Translate the section to the block it should swap with. A DOM ordinal is
      // not a block index, and neither is `blockIndex ± 1` — which is what this
      // used to do, so "move up" on a page the sanitizer had trimmed moved the
      // wrong block and quietly rewrote the page.
      const targetIdx = moveTargetForSection(sections, blockIndex, direction);
      if (targetIdx === null) return;
      const nextBlocks = [...blocksRef.current];
      const temp = nextBlocks[blockIndex];
      nextBlocks[blockIndex] = nextBlocks[targetIdx];
      nextBlocks[targetIdx] = temp;
      commitBlocks(nextBlocks, `move:${blockIndex}`);
      await handlePersistBlocks(nextBlocks, 'Section order updated');
    },
    [commitBlocks, handlePersistBlocks, sections]
  );

  const handleDuplicateSection = useCallback(
    async (blockIndex: number) => {
      const source = blocksRef.current[blockIndex];
      if (!source) return;
      const duplicated: Block = { ...source, id: nextBlockId() };
      const nextBlocks = [...blocksRef.current];
      nextBlocks.splice(blockIndex + 1, 0, duplicated);
      commitBlocks(nextBlocks, null);
      await handlePersistBlocks(nextBlocks, 'Section duplicated in Supabase');
    },
    [commitBlocks, handlePersistBlocks]
  );

  const handleConvertSection = useCallback(
    async (
      blockIndex: number,
      targetType: Block['type'],
      options?: { headingLevel?: HeadingLevel; calloutTone?: CalloutTone }
    ) => {
      const source = blocksRef.current[blockIndex];
      if (!source) return;
      const converted = convertBlock(source, targetType, options);
      if (converted === source) return;
      const nextBlocks = [...blocksRef.current];
      nextBlocks[blockIndex] = converted;
      commitBlocks(nextBlocks, null);
      await handlePersistBlocks(nextBlocks, `Section converted to ${targetType}`);
    },
    [commitBlocks, handlePersistBlocks]
  );

  // ⌘Z / ⌘⇧Z, ⌘S, and section shortcuts (⌘D, ⌘⇧↑/↓, ⌘⇧⌫)
  // Placed after all handler declarations to avoid use-before-declaration.
  useEffect(() => {
    if (!enabled || !isAdmin) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Don't intercept shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow default browser shortcuts in inputs (bold, italic, etc.)
        if (['b', 'i', 'k'].includes(event.key.toLowerCase())) return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        void handlePersistBlocks(blocksRef.current);
        return;
      }
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      // Section navigation shortcuts
      if (key === 'arrowup' && event.shiftKey) {
        event.preventDefault();
        if (activeBlockIndex !== null && activeBlockIndex > 0) {
          handleMoveSection(activeBlockIndex, 'up');
        }
        return;
      }
      if (key === 'arrowdown' && event.shiftKey) {
        event.preventDefault();
        if (activeBlockIndex !== null && activeBlockIndex < blocksRef.current.length - 1) {
          handleMoveSection(activeBlockIndex, 'down');
        }
        return;
      }
      // Duplicate section (⌘D)
      if (key === 'd' && activeBlockIndex !== null) {
        event.preventDefault();
        handleDuplicateSection(activeBlockIndex);
        return;
      }
      // Delete section (⌘⌫ or ⌘Delete)
      if (
        (key === 'backspace' || key === 'delete') &&
        event.shiftKey &&
        activeBlockIndex !== null
      ) {
        event.preventDefault();
        handleDeleteSection(activeBlockIndex);
        return;
      }
      // Toggle shortcuts help (⌘/)
      if (key === '/') {
        event.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    enabled,
    handlePersistBlocks,
    handleRedo,
    handleUndo,
    isAdmin,
    activeBlockIndex,
    handleMoveSection,
    handleDuplicateSection,
    handleDeleteSection,
  ]);

  // Revisions management — restore is destructive; the confirm step lives at the
  // button level via ConfirmAction (JSX component: label/message/danger/onConfirm),
  // not as a promise call (ConfirmActionProps has no .then interface).
  const handleOpenRevisions = useCallback(async () => {
    if (!contentRow) {
      toast.info('Connect this page to Supabase CMS first to access revision history');
      return;
    }
    setIsRevisionsOpen(true);
    setRevisionsLoading(true);
    try {
      const res = await getContentRevisions(contentRow.id);
      if (res.success && res.data) {
        setRevisions(res.data.revisions);
      } else {
        toast.error('Failed to load page revisions');
      }
    } catch {
      toast.error('Failed to load page revisions');
    } finally {
      setRevisionsLoading(false);
    }
  }, [contentRow]);

  const handleRestoreRevision = async (revId: number) => {
    if (!contentRow) return;
    setSavingBackend(true);
    try {
      const res = await restoreContentRevision(contentRow.id, revId);
      if (res.success) {
        toast.success('Revision snapshot restored successfully');
        setIsRevisionsOpen(false);
        await loadContentData();
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to restore revision');
      }
    } catch {
      toast.error('Failed to restore revision');
    } finally {
      setSavingBackend(false);
    }
  };

  // Listen to all custom events dispatched from the navbar editorial button
  useEffect(() => {
    if (!enabled || !isAdmin) return;

    const handleFocusSection = (e: Event) => {
      const { blockIndex, openEdit } = (e as CustomEvent<FocusSectionDetail>).detail ?? {};
      if (blockIndex === undefined) return;
      jumpTo(blockIndex);
      if (openEdit) handleOpenEditSection(blockIndex);
    };

    const handleToggleSectionVisual = (e: Event) => {
      const detail = (e as CustomEvent<ToggleSectionDetail>).detail;
      if (!detail) return;

      if (detail.all !== undefined) {
        setEnabledSectionKeys(
          detail.all ? new Set(sections.map((section) => section.key)) : new Set()
        );
        return;
      }

      const section = sections.find((item) => item.blockIndex === detail.blockIndex);
      if (!section) return;
      const active = detail.enabled !== false;
      setEnabledSectionKeys((prev) => {
        const next = new Set(prev);
        if (active) next.add(section.key);
        else next.delete(section.key);
        return next;
      });
    };

    const handleMoveSectionEvent = (e: Event) => {
      const detail = (e as CustomEvent<MoveSectionDetail>).detail;
      if (detail?.blockIndex === undefined || !detail.direction) return;
      handleMoveSection(detail.blockIndex, detail.direction);
    };

    const handleAddBlockAtEvent = (e: Event) => {
      const detail = (e as CustomEvent<AddBlockDetail>).detail;
      handleAddNewSection(detail?.type ?? 'paragraph', detail?.insertAfterBlockIndex);
    };

    const handleAddBlockGeneral = () => {
      handleAddNewSection('paragraph');
    };

    const handleDuplicateSectionEvent = (e: Event) => {
      const detail = (e as CustomEvent<DuplicateSectionDetail>).detail;
      if (detail?.blockIndex === undefined) return;
      handleDuplicateSection(detail.blockIndex);
    };

    const handleDeleteSectionEvent = (e: Event) => {
      const detail = (e as CustomEvent<DeleteSectionDetail>).detail;
      if (detail?.blockIndex === undefined) return;
      handleDeleteSection(detail.blockIndex);
    };

    const handleConvertSectionEvent = (e: Event) => {
      const detail = (e as CustomEvent<ConvertSectionDetail>).detail;
      if (detail?.blockIndex === undefined || !detail.type) return;
      handleConvertSection(detail.blockIndex, detail.type, {
        headingLevel: detail.headingLevel,
        calloutTone: detail.calloutTone,
      });
    };

    const handleOpenMediaLibrary = () => {
      setMediaTarget('section');
      setMediaModalOpen(true);
    };

    const handleOpenSettings = () => {
      setIsSettingsOpen(true);
    };

    const handleOpenCRM = (e?: Event) => {
      const detail = (e as CustomEvent<{ tab?: 'constituents' | 'events' | 'news' | 'links' }>)
        ?.detail;
      openCrmWithTab(detail?.tab);
    };

    const handleOpenDiagnostics = () => {
      setIsDiagnosticsModalOpen(true);
    };

    const handleSelectRegion = (e: Event) => {
      const detail = (e as CustomEvent<{ regionId?: string | null; at?: number }>).detail;
      // Null and undefined both mean "the whole page"; a region id addresses the
      // region's own document.
      const next = typeof detail?.regionId === 'string' ? detail.regionId : null;
      if (next === activeRegionId) return;
      setActiveRegionId(next);
    };

    window.addEventListener(VISUAL_EDIT_EVENTS.focusSection, handleFocusSection);
    window.addEventListener(VISUAL_EDIT_EVENTS.toggleSection, handleToggleSectionVisual);
    window.addEventListener(VISUAL_EDIT_EVENTS.moveSection, handleMoveSectionEvent);
    window.addEventListener(VISUAL_EDIT_EVENTS.addBlockAt, handleAddBlockAtEvent);
    window.addEventListener(VISUAL_EDIT_EVENTS.addBlock, handleAddBlockGeneral);
    window.addEventListener(VISUAL_EDIT_EVENTS.duplicateSection, handleDuplicateSectionEvent);
    window.addEventListener(VISUAL_EDIT_EVENTS.deleteSection, handleDeleteSectionEvent);
    window.addEventListener(VISUAL_EDIT_EVENTS.convertSection, handleConvertSectionEvent);
    window.addEventListener(VISUAL_EDIT_EVENTS.openMediaLibrary, handleOpenMediaLibrary);
    window.addEventListener(VISUAL_EDIT_EVENTS.openRevisions, handleOpenRevisions);
    window.addEventListener(VISUAL_EDIT_EVENTS.openSettings, handleOpenSettings);
    window.addEventListener(VISUAL_EDIT_EVENTS.openCRM, handleOpenCRM);
    window.addEventListener(VISUAL_EDIT_EVENTS.openDiagnostics, handleOpenDiagnostics);
    window.addEventListener(VISUAL_EDIT_EVENTS.selectRegion, handleSelectRegion);

    return () => {
      window.removeEventListener(VISUAL_EDIT_EVENTS.focusSection, handleFocusSection);
      window.removeEventListener(VISUAL_EDIT_EVENTS.toggleSection, handleToggleSectionVisual);
      window.removeEventListener(VISUAL_EDIT_EVENTS.moveSection, handleMoveSectionEvent);
      window.removeEventListener(VISUAL_EDIT_EVENTS.addBlockAt, handleAddBlockAtEvent);
      window.removeEventListener(VISUAL_EDIT_EVENTS.addBlock, handleAddBlockGeneral);
      window.removeEventListener(VISUAL_EDIT_EVENTS.duplicateSection, handleDuplicateSectionEvent);
      window.removeEventListener(VISUAL_EDIT_EVENTS.deleteSection, handleDeleteSectionEvent);
      window.removeEventListener(VISUAL_EDIT_EVENTS.convertSection, handleConvertSectionEvent);
      window.removeEventListener(VISUAL_EDIT_EVENTS.openMediaLibrary, handleOpenMediaLibrary);
      window.removeEventListener(VISUAL_EDIT_EVENTS.openRevisions, handleOpenRevisions);
      window.removeEventListener(VISUAL_EDIT_EVENTS.openSettings, handleOpenSettings);
      window.removeEventListener(VISUAL_EDIT_EVENTS.openCRM, handleOpenCRM);
      window.removeEventListener(VISUAL_EDIT_EVENTS.openDiagnostics, handleOpenDiagnostics);
      window.removeEventListener(VISUAL_EDIT_EVENTS.selectRegion, handleSelectRegion);
    };
  }, [
    activeRegionId,
    enabled,
    isAdmin,
    handleAddNewSection,
    handleConvertSection,
    handleDeleteSection,
    handleDuplicateSection,
    handleMoveSection,
    handleOpenEditSection,
    handleOpenRevisions,
    jumpTo,
    openCrmWithTab,
    sections,
  ]);

  const handleSavePageSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBackend(true);
    try {
      // A region's slug is the registry's, not a form field: the editor renders
      // that field read-only for a region, so a rename cannot orphan it.
      let slug = activeRegionId ? copyRegionSlug(activeRegionId) : pageSlug || documentSlug;
      if (!slug) {
        if (pathname === '/' || pathname === '') slug = 'home';
        else
          slug = pathname
            .replace(/^\//, '')
            .replace(/[^a-z0-9-]/gi, '-')
            .toLowerCase();
      }

      const res = await saveContentWithEdgeApi({
        id: contentRow?.id,
        title: pageTitle,
        slug,
        excerpt: contentRow?.excerpt || null,
        type: (contentRow?.type as 'page' | 'post') || 'page',
        status: pageStatus,
        body: contentRow?.body || serializeBlocks(blocks),
        featuredImage: pageFeaturedImage || null,
        expectedUpdatedAt: contentRow?.updated_at ?? undefined,
        metadata: contentRow?.metadata ?? {},
      });

      if (res.success) {
        toast.success('Page settings saved to Supabase');
        setContentRow((prev) =>
          prev
            ? {
                ...prev,
                title: pageTitle,
                slug,
                featured_image: pageFeaturedImage || null,
                status: pageStatus,
                updated_at: res.data?.updatedAt,
              }
            : {
                id: res.data?.id || 1,
                title: pageTitle,
                slug,
                excerpt: null,
                type: 'page',
                status: pageStatus,
                body: serializeBlocks(blocks),
                featured_image: pageFeaturedImage || null,
                metadata: {},
                updated_at: res.data?.updatedAt,
                created_at: new Date().toISOString(),
                published_at: new Date().toISOString(),
              }
        );
        setIsSettingsOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update page settings');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error updating page');
    } finally {
      setSavingBackend(false);
    }
  };

  if (!enabled || !isAdmin) return null;

  return (
    <>
      {/*
        ── Recovered draft ──────────────────────────────────────────────────

        A local copy from a previous session, offered rather than applied. It
        disappears the moment the operator does anything else, because after
        that the decision has been made for them and the banner would be a lie.
      */}
      {recoveredDraft && !dirty && (
        <div
          role="status"
          className="fixed inset-x-3 top-20 z-50 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-accent-gold/40 bg-secondary/95 px-4 py-3 text-ink-on-dark shadow-float backdrop-blur-md"
        >
          <History size={16} className="shrink-0 text-accent-gold" aria-hidden="true" />
          <p className="flex-1 text-xs font-semibold">
            An unsaved copy of this page from your last session was found.
          </p>
          <button
            type="button"
            onClick={() => {
              commitBlocks(recoveredDraft, null);
              setRecoveredDraft(null);
              toast.success('Recovered draft restored');
            }}
            className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-ink-strong hover:bg-accent-gold"
          >
            Restore
          </button>
          <button
            type="button"
            onClick={() => {
              clearDraft(draftScope);
              setRecoveredDraft(null);
            }}
            className="rounded-lg border border-white/15 px-2.5 py-1 text-xs font-bold text-ink-on-dark hover:bg-white/10"
          >
            Discard
          </button>
        </div>
      )}

      {/* ── In-Page Visual Section Overlays ────────────────────────────── */}
      {showSectionBadges && sectionOverlays.length > 0 && (
        <div aria-hidden="false" className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
          {sectionOverlays.map((item) => (
            <div
              key={item.domIndex}
              style={{
                position: 'fixed',
                top: `${item.top}px`,
                left: `${item.left}px`,
                width: `${item.width}px`,
                height: `${item.height}px`,
              }}
              className="pointer-events-none"
            >
              {/* Highlight boundary */}
              <div
                className={`w-full h-full rounded-2xl transition-all duration-300 ${
                  activeBlockIndex === item.blockIndex
                    ? 'border-2 border-accent-gold ring-4 ring-accent-gold/20 bg-accent-gold/5 shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                    : showAllSectionBorders
                      ? 'border border-dashed border-accent-gold/40 bg-accent-gold/[0.02]'
                      : 'border border-transparent'
                }`}
              />

              {/* Floating Action Pill */}
              <div
                role="toolbar"
                aria-label={`Actions for ${item.label}`}
                className="pointer-events-auto absolute -top-3.5 left-3 sm:left-6 inline-flex items-center gap-1.5 rounded-full border border-accent-gold/50 bg-secondary/95 px-3 py-1 text-xs text-ink-on-dark shadow-float backdrop-blur-md transition-all hover:scale-105"
              >
                <span className="size-2 rounded-full bg-accent-gold animate-pulse" />
                <span className="font-black text-accent-gold uppercase text-[10px] tracking-wider">
                  {item.blockType}
                </span>
                <span className="max-w-[120px] sm:max-w-[180px] truncate font-semibold text-white text-[11px]">
                  {item.label}
                </span>

                <div className="ml-1.5 flex items-center gap-1 border-l border-white/20 pl-1.5">
                  {/* Edit section */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBlockIndex(item.blockIndex);
                      handleOpenEditSection(item.blockIndex);
                    }}
                    title="Edit section content"
                    aria-label="Edit section content"
                    className="rounded p-1 text-accent-gold hover:bg-white/15 hover:text-white transition-colors"
                  >
                    <PenLine size={13} />
                  </button>

                  {/* Quick media picker if image block */}
                  {item.blockType === 'image' && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveBlockIndex(item.blockIndex);
                        handleOpenEditSection(item.blockIndex);
                        setMediaTarget('section');
                        setMediaModalOpen(true);
                      }}
                      title="Replace image from Supabase S3 storage"
                      aria-label="Replace image from Supabase S3 storage"
                      className="rounded p-1 text-sky-400 hover:bg-white/15 hover:text-sky-300 transition-colors"
                    >
                      <ImageIcon size={13} />
                    </button>
                  )}

                  {/* Duplicate section */}
                  <button
                    type="button"
                    onClick={() => handleDuplicateSection(item.blockIndex)}
                    title="Duplicate section"
                    aria-label="Duplicate section"
                    className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
                  >
                    <Copy size={13} />
                  </button>

                  {/* Move Up */}
                  {canMoveSection(sections, item.blockIndex, 'up') && (
                    <button
                      type="button"
                      onClick={() => handleMoveSection(item.blockIndex, 'up')}
                      title="Move section up"
                      aria-label="Move section up"
                      className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
                    >
                      <ArrowUp size={13} />
                    </button>
                  )}

                  {/* Move Down */}
                  {canMoveSection(sections, item.blockIndex, 'down') && (
                    <button
                      type="button"
                      onClick={() => handleMoveSection(item.blockIndex, 'down')}
                      title="Move section down"
                      aria-label="Move section down"
                      className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
                    >
                      <ArrowDown size={13} />
                    </button>
                  )}

                  {/* Quick heading level toggles if heading */}
                  {item.blockType === 'heading' && (
                    <div className="flex items-center gap-0.5 border-l border-white/20 pl-1">
                      {([2, 3, 4] as const).map((lvl) => {
                        const activeBlock = blocks[item.blockIndex];
                        const isCurrentLevel =
                          activeBlock?.type === 'heading' && activeBlock.level === lvl;
                        return (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() =>
                              handleConvertSection(item.blockIndex, 'heading', {
                                headingLevel: lvl,
                              })
                            }
                            title={`Set heading to H${lvl}`}
                            aria-label={`Set heading level ${lvl}`}
                            className={`px-1 py-0.5 rounded text-[10px] font-black transition-colors ${
                              isCurrentLevel
                                ? 'bg-accent-gold text-ink-strong font-black shadow-2xs'
                                : 'text-slate-300 hover:text-white hover:bg-white/15'
                            }`}
                          >
                            H{lvl}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Quick callout tone toggles if callout */}
                  {item.blockType === 'callout' && (
                    <div className="flex items-center gap-0.5 border-l border-white/20 pl-1">
                      {(['info', 'action', 'warning'] as const).map((tone) => {
                        const activeBlock = blocks[item.blockIndex];
                        const isCurrentTone =
                          activeBlock?.type === 'callout' && activeBlock.tone === tone;
                        return (
                          <button
                            key={tone}
                            type="button"
                            onClick={() =>
                              handleConvertSection(item.blockIndex, 'callout', {
                                calloutTone: tone,
                              })
                            }
                            title={`Set tone to ${tone}`}
                            aria-label={`Set callout tone ${tone}`}
                            className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase transition-colors ${
                              isCurrentTone
                                ? 'bg-accent-gold text-ink-strong font-black shadow-2xs'
                                : 'text-slate-300 hover:text-white hover:bg-white/15'
                            }`}
                          >
                            {tone}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Convert section block type */}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        title="Convert section type"
                        aria-label="Convert section type"
                        className="rounded p-1 text-purple-400 hover:bg-white/15 hover:text-purple-300 transition-colors"
                      >
                        <Sparkles size={13} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        side="bottom"
                        align="start"
                        sideOffset={6}
                        aria-label="Convert section type"
                        className="z-50 w-52 rounded-xl border border-white/15 bg-secondary p-1.5 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                      >
                        <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-ink-muted-on-dark border-b border-white/10 mb-1">
                          Turn into
                        </div>
                        {CONVERT_BLOCK_OPTIONS.map((option) => (
                          <DropdownMenu.Item
                            key={`${option.type}-${option.headingLevel ?? option.calloutTone ?? 'default'}`}
                            onSelect={() =>
                              handleConvertSection(item.blockIndex, option.type, {
                                headingLevel: option.headingLevel,
                                calloutTone: option.calloutTone,
                              })
                            }
                            className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                          >
                            <span>{option.label}</span>
                            {item.blockType === option.type && (
                              <span className="text-[10px] text-accent-gold uppercase font-mono">
                                Current
                              </span>
                            )}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>

                  {/* Add block below — a menu of every type, not just a paragraph.
                      A pen-over-here control that can only append one block type
                      is a control that lies by omission; the dock menu already
                      owns the canonical option list, so this reuses it. */}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        title="Add block below"
                        aria-label="Add block below"
                        className="rounded p-1 text-emerald-400 hover:bg-white/15 hover:text-emerald-300 transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        side="bottom"
                        align="start"
                        sideOffset={6}
                        aria-label="Add block below"
                        className="z-50 w-48 rounded-xl border border-white/15 bg-secondary p-1.5 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                      >
                        {BLOCK_TYPE_OPTIONS.map((option) => (
                          <DropdownMenu.Item
                            key={option.type}
                            onSelect={() => handleAddNewSection(option.type, item.blockIndex)}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                          >
                            {option.label}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>

                  {/* Turn off visual frame for this section */}
                  <button
                    type="button"
                    onClick={() => toggleSectionFrame(item.blockIndex)}
                    title="Hide visual frame for this section"
                    aria-label="Hide visual frame for this section"
                    className="rounded p-1 text-slate-400 hover:bg-white/15 hover:text-white transition-colors"
                  >
                    <EyeOff size={13} />
                  </button>

                  {/*
                    Delete asks first. It used to fire on a single click straight
                    into `saveContent` — the one operation in this component with
                    no way back from another tab.
                  */}
                  <ConfirmAction
                    label="Delete section"
                    message={`Delete "${item.label}"? Undo brings it back in this session, and nothing is written until you save.`}
                    confirmLabel="Delete"
                    danger
                    busy={savingBackend}
                    idleClassName="rounded p-1 text-rose-400 hover:bg-white/15 hover:text-rose-300 transition-colors"
                    onConfirm={() => handleDeleteSection(item.blockIndex)}
                  >
                    <Trash2 size={13} />
                  </ConfirmAction>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Direct In-Place Click-To-Edit Floating Action Pill ─────────────── */}
      {inlineSession && (
        <div
          data-inline-toolbar="true"
          role="toolbar"
          aria-label="Direct in-place text editor controls"
          style={{
            position: 'fixed',
            top: `${inlineSession.top}px`,
            left: `${inlineSession.left}px`,
            zIndex: 9999,
          }}
          className="inline-flex flex-wrap items-center gap-1 rounded-full border border-accent-gold/80 bg-secondary/95 px-3 py-1.5 text-xs text-white shadow-float backdrop-blur-md transition-all duration-150 animate-in fade-in-0 zoom-in-95 pointer-events-auto max-w-[95vw]"
        >
          <button
            type="button"
            onClick={() => void commitInlineEdit(inlineSession)}
            className="inline-flex items-center gap-1 rounded-md bg-accent-gold px-2.5 py-1 font-black text-ink-strong text-[11px] uppercase tracking-wider hover:bg-amber-400 transition-colors shadow-xs cursor-pointer"
            title="Save changes (⌘+Enter)"
          >
            <Check size={13} className="stroke-[3]" />
            <span>Save</span>
            <kbd className="ml-1 text-[9px] font-mono opacity-60">⌘↵</kbd>
          </button>

          <button
            type="button"
            onClick={() => cancelInlineEdit(inlineSession)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-slate-300 text-[11px] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Cancel changes (Escape)"
          >
            <X size={12} />
            <span>Cancel</span>
            <kbd className="ml-0.5 text-[9px] font-mono opacity-50">esc</kbd>
          </button>

          {inlineSession.dataPointKey && (
            <span
              className="inline-flex items-center gap-1 rounded bg-sky-500/20 border border-sky-400/40 px-2 py-0.5 text-[10px] font-mono font-bold text-sky-300 select-none shadow-xs"
              title="Connected directly to Supabase DB public.data_points table"
            >
              <Database size={11} className="text-sky-400" />
              <span>{inlineSession.dataPointKey}</span>
            </span>
          )}

          <div className="mx-0.5 h-3.5 w-px bg-white/20" />

          <InlineFormatToolbar
            variant="pill"
            commands={INLINE_FORMAT_COMMANDS}
            onCommand={(command) => {
              if (command === 'link') {
                setLinkModal({ textareaId: null, url: '', text: '' });
              } else {
                applyInlineFormatCommand(command);
              }
            }}
          />

          {/* Word and Char Counter Badge */}
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-ink-muted-on-dark select-none ml-0.5">
            {inlineCounts.words}w · {inlineCounts.chars}c
          </span>

          {inlineSession.blockIndex !== null && (
            <>
              <div className="mx-0.5 h-3.5 w-px bg-white/20" />
              <button
                type="button"
                onClick={() => {
                  const idx = inlineSession.blockIndex;
                  if (idx !== null) {
                    handleOpenEditSection(idx);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-bold text-accent-gold hover:bg-accent-gold/20 text-[11px] transition-colors cursor-pointer"
                title="Open comprehensive block editor modal"
              >
                <Settings size={12} />
                <span className="hidden md:inline">Full Editor</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Direct Click-To-Replace Image Floating Action Pill ─────────────── */}
      {imageSession && (
        <div
          data-inline-toolbar="true"
          role="toolbar"
          aria-label="Image asset controls"
          style={{
            position: 'fixed',
            top: `${imageSession.top}px`,
            left: `${imageSession.left}px`,
            zIndex: 9999,
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary-bright/80 bg-secondary/95 px-3 py-1.5 text-xs text-white shadow-float backdrop-blur-md transition-all duration-150 animate-in fade-in-0 zoom-in-95 pointer-events-auto"
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-primary-on-dark pl-0.5">
            <ImageIcon size={13} />
            <span className="hidden sm:inline">Image Asset</span>
          </div>

          <div className="mx-1 h-3.5 w-px bg-white/20" />

          <button
            type="button"
            onClick={() => {
              setMediaTarget('image-replace');
              setMediaModalOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-primary-bright px-2.5 py-1 font-bold text-white text-[11px] uppercase tracking-wider hover:bg-primary-light transition-colors shadow-xs cursor-pointer"
            title="Replace image with Supabase S3 Storage media"
          >
            <ImagePlus size={13} />
            <span>Replace</span>
          </button>

          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            className="hidden"
            onChange={handleDirectImageUpload}
          />
          <button
            type="button"
            disabled={isUploadingImage}
            onClick={() => imageFileInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 font-semibold text-white text-[11px] hover:bg-white/20 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            title="Directly upload replacement image from your device"
          >
            {isUploadingImage ? (
              <Loader2 size={12} className="animate-spin text-accent-gold" />
            ) : (
              <Upload size={12} className="text-primary-on-dark" />
            )}
            <span>{isUploadingImage ? 'Uploading…' : 'Upload'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAltTextModal({
                session: imageSession,
                value: imageSession.element.alt || '',
              });
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-slate-300 text-[11px] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Edit image alt text"
            aria-label="Edit image alt text"
          >
            <Settings size={12} />
            <span className="hidden sm:inline">Alt Text</span>
          </button>

          <button
            type="button"
            onClick={() => {
              imageSession.element.src = imageSession.initialSrc;
              imageSession.element.alt = imageSession.initialAlt;
              imageSessionRef.current = null;
              setImageSession(null);
              toast.info('Image changes cancelled');
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-slate-400 text-[11px] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Dismiss image controls"
            aria-label="Dismiss image controls"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Fixed Bottom Control Dock ─────────────────────────────────── */}
      <aside
        aria-label="Visual Editor Toolbar"
        data-testid="visual-edit-overlay"
        className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-5xl rounded-2xl border border-white/20 bg-secondary/95 p-3.5 text-ink-on-dark shadow-float backdrop-blur-md"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Document Info & Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="size-2.5 rounded-full bg-accent-gold animate-pulse" />
              <PenLine size={16} className="text-accent-gold" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              {/*
                Which document is being edited.

                `contentRow?.title` is what the row is *called* in the CMS, which
                for a region is the region's label; the region label is the
                fallback so a region with no row yet still names itself.
              */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.15em] text-white truncate max-w-[200px] sm:max-w-[280px]">
                  {contentRow?.title || pageTitle || target?.label || pathname}
                </span>
                {contentRow ? (
                  <button
                    type="button"
                    onClick={handleTogglePageStatus}
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
                    onClick={handleInitializeCMSPage}
                    disabled={savingBackend}
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-accent/20 text-accent-gold hover:bg-accent/30"
                    title={
                      activeRegion
                        ? `Create the CMS row for the ${activeRegion.label} region`
                        : 'Click to sync page into Supabase content table'
                    }
                  >
                    Connect to Supabase
                  </button>
                )}
              </div>
              <p className="text-[11px] text-ink-muted-on-dark truncate">
                {sections.length} {sections.length === 1 ? 'block' : 'blocks'} in the document (
                {enabledSectionKeys.size} framed) ·{' '}
                {dirty ? (
                  <span className="font-bold text-accent-gold">unsaved changes</span>
                ) : (
                  <span>saved</span>
                )}
              </p>
            </div>
          </div>

          {/*
            Which copy region is being edited.

            A coded page cannot own a `content` row — a slug matching a route
            segment is shadowed — so the editable unit on `/`, `/about` and the
            other coded routes is a region. One row per region, one document
            loaded at a time. The "Whole page" entry is the pre-region behaviour
            and is what `[slug]` routes use.
          */}
          {pageRegions.length > 0 && (
            // A fieldset, not a `role="group"`: the same set of controls is a
            // native fieldset everywhere else in this file, and Biome's
            // `useSemanticElements` is right that the role adds nothing a
            // `<fieldset>` with a `<legend>` does not already say.
            <fieldset className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
              <legend className="sr-only">Editable copy region</legend>
              <button
                type="button"
                onClick={() => setActiveRegionId(null)}
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
                  onClick={() => setActiveRegionId(region.id)}
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

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Undo / Redo — the operations a visual editor needs most and the
                ones this dock was missing entirely. */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo(history)}
              title="Undo the last change (⌘Z)"
              aria-label="Undo the last change"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${
                canUndo(history)
                  ? 'border-white/15 bg-white/10 text-ink-on-dark hover:bg-white/15'
                  : 'border-white/10 bg-white/5 text-ink-muted-on-dark'
              }`}
            >
              <Undo2 size={13} />
              <span className="hidden lg:inline">Undo</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo(history)}
              title="Redo (⌘⇧Z)"
              aria-label="Redo the last undone change"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${
                canRedo(history)
                  ? 'border-white/15 bg-white/10 text-ink-on-dark hover:bg-white/15'
                  : 'border-white/10 bg-white/5 text-ink-muted-on-dark'
              }`}
            >
              <Redo2 size={13} />
              <span className="hidden lg:inline">Redo</span>
            </button>

            {/*
              The primary action is now "Save", not "Save to Supabase CMS".

              Connecting a page to the CMS is a one-time act and it happens the
              first time anything is saved. Treating it as the only write made
              every later edit look like an initialisation, and it hid the fact
              that the document had unsaved changes at all.
            */}
            <button
              type="button"
              onClick={() =>
                handlePersistBlocks(
                  blocks,
                  contentRow ? 'Page saved' : 'Page connected to Supabase CMS'
                )
              }
              disabled={savingBackend || !dirty}
              title={
                contentRow
                  ? 'Write this document to Supabase'
                  : 'Create the Supabase CMS row for this page from what is on screen'
              }
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider shadow-raised transition-all disabled:opacity-50 ${
                dirty
                  ? 'bg-accent text-ink-strong hover:bg-accent-gold'
                  : 'bg-white/10 text-ink-muted-on-dark'
              }`}
            >
              {savingBackend ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              <span>{contentRow ? (dirty ? 'Save' : 'Saved') : 'Connect'}</span>
            </button>

            {/* Badges Toggle */}
            <button
              type="button"
              onClick={() => setShowSectionBadges((p) => !p)}
              title={
                showSectionBadges ? 'Hide in-page section badges' : 'Show in-page section badges'
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                showSectionBadges
                  ? 'border-accent-gold/50 bg-accent-gold/20 text-accent-gold'
                  : 'border-white/10 bg-white/5 text-ink-muted-on-dark hover:bg-white/10'
              }`}
            >
              <Layers size={13} />
              <span className="hidden sm:inline">Badges: {showSectionBadges ? 'ON' : 'OFF'}</span>
            </button>

            {/* Frames Toggle */}
            <button
              type="button"
              onClick={() => setShowAllSectionBorders((p) => !p)}
              title={showAllSectionBorders ? 'Hide section frames' : 'Show section frames'}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                showAllSectionBorders
                  ? 'border-accent-gold/50 bg-accent-gold/20 text-accent-gold'
                  : 'border-white/10 bg-white/5 text-ink-muted-on-dark hover:bg-white/10'
              }`}
            >
              <Eye size={13} />
              <span className="hidden md:inline">
                Frames: {showAllSectionBorders ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Theme Mode Preview Toggle */}
            <button
              type="button"
              onClick={cycleTheme}
              title={`Preview theme: ${themeModeLabel(themeMode)}${themeMode === 'system' ? ` (${effectiveTheme})` : ''} (click to cycle)`}
              aria-label="Cycle theme mode preview"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-all duration-300 hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
            >
              {themeMode === 'light' ? (
                <Sun
                  size={13}
                  className="text-amber-300 animate-in fade-in zoom-in-75 duration-200"
                />
              ) : themeMode === 'dark' ? (
                <Moon
                  size={13}
                  className="text-blue-300 animate-in fade-in zoom-in-75 duration-200"
                />
              ) : (
                <span className="relative flex items-center justify-center">
                  <Monitor
                    size={13}
                    className="text-emerald-300 animate-in fade-in zoom-in-75 duration-200"
                  />
                  <span
                    aria-hidden="true"
                    className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-1 ring-secondary ${
                      effectiveTheme === 'dark' ? 'bg-sky-400' : 'bg-amber-400'
                    }`}
                  />
                </span>
              )}
              <span className="hidden lg:inline capitalize">
                {themeModeLabel(themeMode)}
                {themeMode === 'system' ? (
                  <span className="ml-1 text-[10px] text-ink-muted-on-dark font-medium lowercase">
                    ({effectiveTheme})
                  </span>
                ) : null}
              </span>
            </button>

            {/* Responsive Viewport Mode Simulator */}
            <fieldset
              aria-label="Responsive viewport preview"
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5"
            >
              <legend className="sr-only">Responsive viewport preview</legend>
              <button
                type="button"
                onClick={() => setViewportMode('desktop')}
                title="Desktop full viewport (100% width)"
                aria-label="Desktop viewport"
                aria-pressed={viewportMode === 'desktop'}
                className={`rounded-md p-1.5 text-xs font-bold transition-colors ${
                  viewportMode === 'desktop'
                    ? 'bg-accent-gold/20 text-accent-gold'
                    : 'text-ink-muted-on-dark hover:text-white'
                }`}
              >
                <Monitor size={13} />
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('tablet')}
                title="Tablet viewport preview (768px width)"
                aria-label="Tablet viewport"
                aria-pressed={viewportMode === 'tablet'}
                className={`rounded-md p-1.5 text-xs font-bold transition-colors ${
                  viewportMode === 'tablet'
                    ? 'bg-accent-gold/20 text-accent-gold'
                    : 'text-ink-muted-on-dark hover:text-white'
                }`}
              >
                <Tablet size={13} />
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('mobile')}
                title="Mobile viewport preview (390px iPhone width)"
                aria-label="Mobile viewport"
                aria-pressed={viewportMode === 'mobile'}
                className={`rounded-md p-1.5 text-xs font-bold transition-colors ${
                  viewportMode === 'mobile'
                    ? 'bg-accent-gold/20 text-accent-gold'
                    : 'text-ink-muted-on-dark hover:text-white'
                }`}
              >
                <Smartphone size={13} />
              </button>
              {viewportMode !== 'desktop' && (
                <span className="px-1.5 text-[10px] font-mono font-bold text-accent-gold hidden xl:inline">
                  {viewportMode === 'mobile' ? '390px' : '768px'}
                </span>
              )}
            </fieldset>

            {/* Section Navigator */}
            {sections.length > 0 && (
              <div className="relative">
                <select
                  aria-label="Jump to block"
                  onChange={(e) => {
                    const blockIndex = Number.parseInt(e.target.value, 10);
                    if (Number.isInteger(blockIndex)) jumpTo(blockIndex);
                  }}
                  className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  value=""
                >
                  <option value="" disabled className="bg-secondary text-ink-on-dark">
                    Jump to block…
                  </option>
                  {sections.map((sec) => (
                    <option
                      key={sec.key}
                      value={sec.blockIndex}
                      className="bg-secondary text-ink-on-dark"
                    >
                      {sec.ordinal}. {sec.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Add Block — a Radix menu, never hover.
                `group-hover:block` hid this menu from every keyboard and touch
                user, and left it in no tab order at all. Click-to-open keeps
                touch first-class and hands keyboard users Enter/arrows/Escape
                by construction — the same primitive and rationale as
                NavDropdown. It opens upward because the dock sits at the
                viewport bottom. */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-bright px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-colors hover:bg-primary-light focus-visible:ring-2 focus-visible:ring-accent-gold"
                >
                  <Plus size={14} />
                  <span>Add Block</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  side="top"
                  sideOffset={8}
                  aria-label="Add block"
                  className="z-50 w-48 rounded-xl border border-white/15 bg-secondary p-1.5 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                >
                  {BLOCK_TYPE_OPTIONS.map((option) => (
                    <DropdownMenu.Item
                      key={option.type}
                      onSelect={() => handleAddNewSection(option.type)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                    >
                      {option.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* S3 Storage Media Library */}
            <button
              type="button"
              onClick={() => {
                setMediaTarget('section');
                setMediaModalOpen(true);
              }}
              title="Open Supabase S3 Media Library"
              aria-label="Open Supabase S3 Media Library"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
            >
              <FolderOpen size={14} className="text-accent-gold" />
              <span className="hidden lg:inline">Media</span>
            </button>

            {/* Page Settings */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Edit page title, slug, and featured image"
              aria-label="Edit page title, slug, and featured image"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
            >
              <Settings size={14} />
              <span className="hidden sm:inline">Settings</span>
            </button>

            {/* Revisions History */}
            {contentRow && (
              <button
                type="button"
                onClick={handleOpenRevisions}
                title="View page revision history and restore previous snapshots"
                aria-label="View page revision history and restore previous snapshots"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
              >
                <History size={14} />
                <span className="hidden sm:inline">Revisions</span>
              </button>
            )}

            {/* Quick Civic Publish & Creation Dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  title="Create or manage: Posts, Events, Bulletins, or Links"
                  aria-label="Create or manage: Posts, Events, Bulletins, or Links"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary-bright/40 bg-primary/20 px-2.5 py-1.5 text-xs font-bold text-primary-on-dark transition-colors hover:bg-primary/30 focus-visible:ring-2 focus-visible:ring-accent-gold"
                >
                  <Plus size={14} className="text-accent-gold" />
                  <span className="hidden sm:inline">Publish</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="top"
                  align="start"
                  sideOffset={8}
                  className="z-50 min-w-48 rounded-xl border border-white/15 bg-secondary p-1.5 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                >
                  <DropdownMenu.Item
                    onSelect={() => router.push('/admin/content/new?type=post')}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                  >
                    <FilePlus2 size={14} className="text-primary-on-dark" />
                    <span>New Post</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => openCrmWithTab('events')}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                  >
                    <Calendar size={14} className="text-purple-400" />
                    <span>Manage Events</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => openCrmWithTab('news')}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                  >
                    <Newspaper size={14} className="text-accent-gold" />
                    <span>Manage Bulletins</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => openCrmWithTab('links')}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                  >
                    <LinkIcon size={14} className="text-emerald-400" />
                    <span>Manage Action Links</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* CRM Panel */}
            <button
              type="button"
              onClick={() => openCrmWithTab()}
              title="Open Civic CRM (Constituents, Events, News, Links)"
              aria-label="Open Civic CRM (Constituents, Events, News, Links)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
            >
              <UsersRound size={14} className="text-emerald-400" />
              <span className="hidden sm:inline">Civic CRM</span>
            </button>

            {/* Quick CRM Studio Link */}
            <a
              href="/admin/crm/broadcasts"
              target="_blank"
              rel="noreferrer"
              title="Open CRM Studio (Broadcasts & Constituents)"
              aria-label="Open CRM Studio (Broadcasts & Constituents)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
            >
              <ExternalLink size={14} className="text-primary-on-dark" />
              <span className="hidden lg:inline">CRM Studio</span>
            </a>

            {/* Keyboard Shortcuts Help */}
            <button
              type="button"
              onClick={() => setIsShortcutsOpen(true)}
              title="Keyboard shortcuts cheat sheet (⌘/)"
              aria-label="Keyboard shortcuts cheat sheet"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
            >
              <Keyboard size={14} className="text-accent-gold" />
              <span className="hidden xl:inline">Shortcuts</span>
            </button>

            {/* Backend Health Badge */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowHealthDetails((p) => !p)}
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
              {showHealthDetails && backendStatus && (
                <div className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-white/15 bg-secondary p-3 shadow-float z-50 text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                    <span className="font-black uppercase tracking-wider text-white">
                      Backend Health
                    </span>
                    <button
                      type="button"
                      onClick={() => probeBackendHealth()}
                      disabled={statusLoading}
                      className="p-1 text-slate-400 hover:text-white"
                      aria-label="Refresh health probe"
                    >
                      <RefreshCw size={12} className={statusLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                  <div className="flex justify-between items-center text-ink-on-dark">
                    <span>Database (Postgres)</span>
                    <span
                      className={
                        backendStatus.database
                          ? 'text-emerald-400 font-bold'
                          : 'text-rose-400 font-bold'
                      }
                    >
                      {backendStatus.database ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-ink-on-dark">
                    <span>Supabase S3 Storage</span>
                    <span
                      className={
                        backendStatus.storage
                          ? 'text-emerald-400 font-bold'
                          : 'text-rose-400 font-bold'
                      }
                    >
                      {backendStatus.storage ? 'media bucket ready' : 'Error'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-ink-on-dark">
                    <span>Edge Functions</span>
                    <span
                      className={
                        backendStatus.edgeFunction
                          ? 'text-emerald-400 font-bold'
                          : 'text-amber-400 font-bold'
                      }
                    >
                      {backendStatus.edgeFunction ? 'Healthy' : 'Fallback'}
                    </span>
                  </div>
                  {backendStatus.edgeFunctionDetails?.latencyMs !== undefined && (
                    <div className="text-[10px] text-ink-muted-on-dark text-right">
                      Latency: {backendStatus.edgeFunctionDetails.latencyMs}ms
                    </div>
                  )}
                  {backendSummary && (
                    <div className="border-t border-white/10 pt-2 space-y-1.5">
                      <div className="flex justify-between items-center text-ink-on-dark">
                        <span>Constituents</span>
                        <span className="font-bold">
                          {backendSummary.crmTotal ?? '—'}
                          <span className="text-ink-muted-on-dark font-medium">
                            {' '}
                            · {backendSummary.segments} segments
                            {backendSummary.segmentsTruncated ? '+' : ''}
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-ink-on-dark">
                        <span>Catalog</span>
                        <span className="font-bold">
                          {backendSummary.products} products · {backendSummary.gallery} photos ·{' '}
                          {backendSummary.events} events
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-ink-on-dark">
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
                    onClick={() => {
                      setShowHealthDetails(false);
                      setIsDiagnosticsModalOpen(true);
                    }}
                    className="w-full text-center py-1 mt-1 text-[11px] font-bold text-accent-gold hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                  >
                    System Diagnostics →
                  </button>
                </div>
              )}
            </div>

            {/* Open in full admin if target known */}
            {target?.editUrl && (
              <a
                href={target.editUrl}
                target="_blank"
                rel="noreferrer"
                title="Open full admin page editor in new tab"
                aria-label="Open full admin page editor in new tab"
                className="hidden md:inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-muted-on-dark hover:text-white hover:bg-white/10"
              >
                <span>Admin</span>
                <ExternalLink size={12} />
              </a>
            )}

            {/* Exit visual editing */}
            <button
              type="button"
              onClick={toggle}
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-accent-gold"
            >
              <X size={14} />
              <span>Done</span>
            </button>
          </div>
        </div>

        {/* Section List Quick Links bar.
            Every block carries its own frame switch here, because the
            in-page pill's EyeOff only hides: once hidden, the pill is gone
            and nothing on the page can bring that one frame back. Without a
            switch here the only recovery is the drawer's "Frame all", which
            reframes every section to recover one. */}
        {blocks.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2 overflow-x-auto border-t border-white/10 pt-2 text-xs no-scrollbar">
            <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-ink-muted-on-dark">
              Blocks:
            </span>
            {blocks.map((block, idx) => {
              const label = sectionLabelForBlock(block);
              const section = sections.find((item) => item.blockIndex === idx);
              const framed = section ? enabledSectionKeys.has(section.key) : false;
              return (
                <div
                  key={block.id}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-ink-on-dark"
                >
                  <span className="font-semibold truncate max-w-[90px]" title={label}>
                    {label}
                  </span>
                  {section && (
                    <button
                      type="button"
                      onClick={() => toggleSectionFrame(idx)}
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
                    onClick={() => handleOpenEditSection(idx)}
                    title="Edit block"
                    aria-label={`Edit block ${label}`}
                    className="text-accent-gold hover:text-white p-0.5"
                  >
                    <PenLine size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateSection(idx)}
                    title="Duplicate block"
                    aria-label={`Duplicate block ${label}`}
                    className="text-slate-400 hover:text-white p-0.5"
                  >
                    <Copy size={11} />
                  </button>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => handleMoveSection(idx, 'up')}
                      title="Move up"
                      aria-label={`Move block ${label} up`}
                      className="text-slate-400 hover:text-white p-0.5"
                    >
                      <ArrowUp size={11} />
                    </button>
                  )}
                  {idx < blocks.length - 1 && (
                    <button
                      type="button"
                      onClick={() => handleMoveSection(idx, 'down')}
                      title="Move down"
                      aria-label={`Move block ${label} down`}
                      className="text-slate-400 hover:text-white p-0.5"
                    >
                      <ArrowDown size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>

      {/* ── Section Edit Modal ────────────────────────────────────────── */}
      {isSectionModalOpen && editingBlock && (
        <Dialog open={isSectionModalOpen} onOpenChange={setIsSectionModalOpen}>
          {/*
            The dialog names the block, not its position. "Edit Section #3" was
            wrong twice over: the number was a DOM ordinal on a page whose blocks
            and elements had already diverged, and it told the operator nothing
            about what they were about to change.
          */}
          <DialogContent className="max-w-2xl bg-surface-card text-foreground p-6 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground">
                {activeSectionLabel || `Block ${(editingBlockIndex ?? 0) + 1}`}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Editing a {editingBlock.type} block. Changes persist directly to the Supabase
                backend, and undo brings this one back if you change your mind.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2 max-h-[60vh] overflow-y-auto pr-1">
              {/* Block Type Selector */}
              <div>
                <label
                  htmlFor={blockTypeId}
                  className="block text-xs font-bold text-foreground mb-1"
                >
                  Block Type
                </label>
                <select
                  id={blockTypeId}
                  value={editingBlock.type}
                  onChange={(e) => {
                    const newType = e.target.value as Block['type'];
                    setEditingBlock(convertBlock(editingBlock, newType));
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary"
                >
                  {BLOCK_TYPE_OPTIONS.map((o) => (
                    <option key={o.type} value={o.type}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Heading Fields */}
              {editingBlock.type === 'heading' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {([2, 3, 4] as HeadingLevel[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setEditingBlock({ ...editingBlock, level: lvl })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                          editingBlock.level === lvl
                            ? 'bg-primary text-white'
                            : 'bg-surface-muted text-foreground hover:bg-border border border-border'
                        }`}
                      >
                        H{lvl}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label
                      htmlFor={headingContentId}
                      className="block text-xs font-bold text-foreground mb-1"
                    >
                      Heading Content
                    </label>
                    <input
                      id={headingContentId}
                      type="text"
                      value={editingBlock.html}
                      onChange={(e) => setEditingBlock({ ...editingBlock, html: e.target.value })}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                    />
                    <div className="mt-1 flex items-center justify-end text-[11px] text-muted-foreground">
                      <span>{editingBlock.html.length} characters</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Paragraph Fields */}
              {editingBlock.type === 'paragraph' && (
                <div>
                  <label
                    htmlFor={paragraphContentId}
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    Paragraph Content
                  </label>
                  <div className="border border-border rounded-lg overflow-hidden">
                    {/* Inline formatting toolbar */}
                    <InlineFormatToolbar
                      variant="panel"
                      commands={SECTION_MODAL_FORMAT_COMMANDS}
                      onCommand={(command) => {
                        if (command === 'link') {
                          setLinkModal({ textareaId: paragraphContentId, url: '', text: '' });
                        } else {
                          runTextareaFormatCommand(paragraphContentId, command);
                        }
                      }}
                      className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-surface-muted border-b border-border"
                      trailing={
                        <>
                          <span className="flex-1" />
                          <span className="text-[10px] text-muted-foreground font-mono">
                            HTML supported
                          </span>
                        </>
                      }
                    />
                    <textarea
                      id={paragraphContentId}
                      rows={5}
                      value={editingBlock.html}
                      onChange={(e) => setEditingBlock({ ...editingBlock, html: e.target.value })}
                      onKeyDown={(e) => handleEditorShortcuts(e, paragraphContentId)}
                      className="w-full border-0 p-3 text-sm focus:outline-none resize-none font-sans"
                      spellCheck={true}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
                    <span>
                      {editingBlock.html.trim() ? editingBlock.html.trim().split(/\s+/).length : 0}{' '}
                      words
                    </span>
                    <span>·</span>
                    <span>{editingBlock.html.length} characters</span>
                  </div>
                </div>
              )}

              {/* List Fields */}
              {(editingBlock.type === 'bulletList' || editingBlock.type === 'orderedList') && (
                <div>
                  <label
                    htmlFor={listItemsId}
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    {editingBlock.type === 'bulletList'
                      ? 'Bullet Items (one item per line)'
                      : 'Numbered Steps (one item per line)'}
                  </label>
                  <textarea
                    id={listItemsId}
                    rows={5}
                    value={editingBlock.items.join('\n')}
                    onChange={(e) =>
                      setEditingBlock({
                        ...editingBlock,
                        items: e.target.value.split('\n'),
                      })
                    }
                    placeholder="Enter each item on a new line..."
                    className="w-full rounded-lg border border-border p-3 text-sm focus:ring-2 focus:ring-primary font-mono"
                  />
                </div>
              )}

              {/* Table Fields — a real grid editor, add/remove rows and columns */}
              {editingBlock.type === 'table' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground">
                    Edit cells directly. Row 1 is the header. Empty cells save as empty.
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="p-1 w-8 text-[10px] text-muted-foreground">#</th>
                          {editingBlock.head.map((cell, col) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: positional grid — inputs are controlled, so values stay correct; a content key would remount (and unfocus) the cell on every keystroke.
                            <th key={`th-${col}`} className="p-1">
                              <input
                                aria-label={`Header cell ${col + 1}`}
                                type="text"
                                value={cell}
                                onChange={(e) => {
                                  const head = [...editingBlock.head];
                                  head[col] = e.target.value;
                                  setEditingBlock({ ...editingBlock, head });
                                }}
                                className="w-full min-w-24 rounded border border-border bg-surface-muted px-2 py-1 text-xs font-bold"
                              />
                            </th>
                          ))}
                          <th className="p-1 w-8">
                            <button
                              type="button"
                              aria-label="Add column"
                              title="Add column"
                              onClick={() => {
                                const columns = Math.max(
                                  editingBlock.head.length,
                                  ...editingBlock.rows.map((r) => r.length),
                                  0
                                );
                                setEditingBlock({
                                  ...editingBlock,
                                  head: [...editingBlock.head, `Column ${columns + 1}`],
                                  rows: editingBlock.rows.map((row) => [...row, '']),
                                });
                              }}
                              className="rounded p-1 text-primary hover:bg-primary/10"
                            >
                              <Plus size={12} />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {editingBlock.rows.map((row, r) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: positional grid — see the header-cell note above; delete removes the addressed row from state, not from the DOM order.
                          <tr key={`tr-${r}`}>
                            <td className="p-1 text-center text-[10px] text-muted-foreground">
                              {r + 1}
                            </td>
                            {row.map((cell, c) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: positional grid — see the header-cell note above; only the last column is ever removed, so earlier cells keep their nodes.
                              <td key={`td-${r}-${c}`} className="p-1">
                                <input
                                  aria-label={`Row ${r + 1} cell ${c + 1}`}
                                  type="text"
                                  value={cell}
                                  onChange={(e) => {
                                    const rows = editingBlock.rows.map((rowItem) => [...rowItem]);
                                    rows[r][c] = e.target.value;
                                    setEditingBlock({ ...editingBlock, rows });
                                  }}
                                  className="w-full min-w-24 rounded border border-border px-2 py-1 text-xs"
                                />
                              </td>
                            ))}
                            <td className="p-1 w-8 text-center">
                              <button
                                type="button"
                                aria-label={`Delete row ${r + 1}`}
                                title="Delete row"
                                onClick={() =>
                                  setEditingBlock({
                                    ...editingBlock,
                                    rows: editingBlock.rows.filter((_, i) => i !== r),
                                  })
                                }
                                className="rounded p-1 text-rose-500 hover:bg-rose-500/10"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingBlock({
                          ...editingBlock,
                          rows: [
                            ...editingBlock.rows,
                            Array.from({ length: Math.max(editingBlock.head.length, 1) }, () => ''),
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs font-bold text-foreground hover:bg-border"
                    >
                      <Plus size={12} />
                      Add row
                    </button>
                    {editingBlock.head.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const last = editingBlock.head.length - 1;
                          setEditingBlock({
                            ...editingBlock,
                            head: editingBlock.head.filter((_, i) => i !== last),
                            rows: editingBlock.rows.map((row) => row.filter((_, i) => i !== last)),
                          });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs font-bold text-foreground hover:bg-border"
                      >
                        <Trash2 size={12} />
                        Remove last column
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Code Fields */}
              {editingBlock.type === 'code' && (
                <div>
                  <label
                    htmlFor={codeTextId}
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    Code (rendered verbatim, escaped)
                  </label>
                  <textarea
                    id={codeTextId}
                    rows={5}
                    value={editingBlock.text}
                    onChange={(e) => setEditingBlock({ ...editingBlock, text: e.target.value })}
                    placeholder="Paste or type code..."
                    className="w-full rounded-lg border border-border p-3 text-sm font-mono focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {/* Callout Fields */}
              {editingBlock.type === 'callout' && (
                <div className="space-y-3">
                  <fieldset className="border-0 p-0 m-0">
                    <legend className="block text-xs font-bold text-foreground mb-1">Tone</legend>
                    <div className="flex gap-2">
                      {CALLOUT_TONES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEditingBlock({ ...editingBlock, tone: t })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${
                            editingBlock.tone === t
                              ? 'bg-accent-gold text-ink-strong'
                              : 'bg-surface-muted text-foreground hover:bg-border border border-border'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <label
                      htmlFor={calloutMessageId}
                      className="block text-xs font-bold text-foreground mb-1"
                    >
                      Callout Message
                    </label>
                    <textarea
                      id={calloutMessageId}
                      rows={3}
                      value={editingBlock.html}
                      onChange={(e) => setEditingBlock({ ...editingBlock, html: e.target.value })}
                      className="w-full rounded-lg border border-border p-3 text-sm focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Image Fields (with Supabase S3 storage modal + direct upload) */}
              {editingBlock.type === 'image' && (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor={imageSrcId}
                      className="block text-xs font-bold text-foreground mb-1"
                    >
                      Image URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={imageSrcId}
                        type="url"
                        value={editingBlock.src}
                        onChange={(e) => setEditingBlock({ ...editingBlock, src: e.target.value })}
                        placeholder="https://...supabase.co/storage/v1/object/public/media/..."
                        className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setMediaTarget('section');
                          setMediaModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-bold text-foreground hover:bg-border shadow-2xs shrink-0"
                      >
                        <FolderOpen size={14} className="text-primary" />
                        <span>S3 Storage</span>
                      </button>
                    </div>
                  </div>
                  {/* Direct file upload */}
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error('Image must be 5MB or smaller');
                          return;
                        }
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('folder', 'content');
                        setSavingBackend(true);
                        try {
                          const res = await uploadCRMMedia(formData);
                          if (res.success && res.data) {
                            setEditingBlock({
                              ...editingBlock,
                              src: res.data.url,
                              alt: res.data.name,
                              width: res.data.width,
                              height: res.data.height,
                            });
                            toast.success('Image uploaded to Supabase Storage');
                          } else {
                            toast.error(res.error || 'Upload failed');
                          }
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Upload failed');
                        } finally {
                          setSavingBackend(false);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 shadow-2xs"
                    >
                      <UploadCloud size={14} className="text-emerald-600" />
                      <span>Upload Direct</span>
                    </button>
                  </div>
                  {editingBlock.src && (
                    <div className="relative aspect-video w-full max-h-48 rounded-xl bg-surface-muted overflow-hidden border border-border">
                      <Image
                        src={editingBlock.src}
                        alt={editingBlock.alt || ''}
                        unoptimized
                        fill
                        className="object-contain"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor={imageAltId}
                        className="block text-xs font-bold text-foreground mb-1"
                      >
                        Alt Text
                      </label>
                      <input
                        id={imageAltId}
                        type="text"
                        value={editingBlock.alt}
                        onChange={(e) => setEditingBlock({ ...editingBlock, alt: e.target.value })}
                        className="w-full rounded-lg border border-border px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={imageCaptionId}
                        className="block text-xs font-bold text-foreground mb-1"
                      >
                        Caption
                      </label>
                      <input
                        id={imageCaptionId}
                        type="text"
                        value={editingBlock.caption || ''}
                        onChange={(e) =>
                          setEditingBlock({ ...editingBlock, caption: e.target.value })
                        }
                        className="w-full rounded-lg border border-border px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Button Fields with CRM Presets */}
              {editingBlock.type === 'button' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor={buttonLabelId}
                        className="block text-xs font-bold text-foreground mb-1"
                      >
                        Button Label
                      </label>
                      <input
                        id={buttonLabelId}
                        type="text"
                        value={editingBlock.label}
                        onChange={(e) =>
                          setEditingBlock({ ...editingBlock, label: e.target.value })
                        }
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={buttonHrefId}
                        className="block text-xs font-bold text-foreground mb-1"
                      >
                        Destination URL
                      </label>
                      <input
                        id={buttonHrefId}
                        type="text"
                        value={editingBlock.href}
                        onChange={(e) => setEditingBlock({ ...editingBlock, href: e.target.value })}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
                      CRM &amp; Civic Action Presets
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Take Civic Action', href: '/contact?topic=action' },
                        { label: 'Join Newsletter', href: '/contact?topic=newsletter' },
                        { label: 'Donate to Chapter', href: '/donate' },
                        { label: 'Volunteer Today', href: '/contact?topic=volunteer' },
                        { label: 'Browse Events', href: '/events' },
                        { label: 'Defend Democracy Store', href: '/products' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            setEditingBlock({
                              ...editingBlock,
                              label: preset.label,
                              href: preset.href,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-surface-muted hover:bg-border text-foreground text-xs font-medium border border-border transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Quote Fields */}
              {editingBlock.type === 'quote' && (
                <div>
                  <label
                    htmlFor={quoteTextId}
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    Quote Text
                  </label>
                  <textarea
                    id={quoteTextId}
                    rows={3}
                    value={editingBlock.html}
                    onChange={(e) => setEditingBlock({ ...editingBlock, html: e.target.value })}
                    className="w-full rounded-lg border border-border p-3 text-sm"
                  />
                </div>
              )}

              {/* Divider Notice */}
              {editingBlock.type === 'divider' && (
                <div className="p-3 bg-surface-muted border border-border rounded-xl text-xs text-muted-foreground">
                  A visual horizontal rule dividing sections.
                </div>
              )}

              {/* Unsupported block type */}
              {editingBlock.type === 'unsupported' && (
                <div className="p-3 bg-surface-muted border border-border rounded-xl text-xs text-muted-foreground">
                  Preserved markup from the original import. You can delete or convert this block,
                  but its raw HTML cannot be edited here.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2">
                {editingBlockIndex !== null && (
                  <ConfirmAction
                    label="Delete Section"
                    message="Delete this section from the page?"
                    danger
                    onConfirm={() => {
                      setIsSectionModalOpen(false);
                      handleDeleteSection(editingBlockIndex);
                    }}
                    idleClassName="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold"
                  >
                    <Trash2 size={14} />
                    <span>Delete Section</span>
                  </ConfirmAction>
                )}
                <button
                  type="button"
                  onClick={handleCopyBlockJson}
                  title="Copy block definition as JSON"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-foreground hover:bg-surface-muted text-xs font-bold transition-colors"
                >
                  <Code size={14} className="text-muted-foreground" />
                  <span>Copy JSON</span>
                </button>
                <button
                  type="button"
                  onClick={handlePasteBlockJson}
                  title="Paste block definition from clipboard"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-foreground hover:bg-surface-muted text-xs font-bold transition-colors"
                >
                  <ClipboardPaste size={14} className="text-muted-foreground" />
                  <span>Paste JSON</span>
                </button>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsSectionModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSectionModal}
                  disabled={savingBackend}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-raised hover:bg-primary-dark"
                >
                  {savingBackend && <Loader2 size={13} className="animate-spin" />}
                  <span>Save to Backend</span>
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Page Settings Modal (Title, Slug, Featured Image) ─────────── */}
      {isSettingsOpen && (
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-lg bg-surface-card text-foreground p-6 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground">
                Page Settings &amp; Metadata
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Update document metadata and the featured hero image stored in Supabase S3 storage.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSavePageSettings} className="space-y-4 my-2">
              <div>
                <label htmlFor={titleId} className="block text-xs font-bold text-foreground mb-1">
                  Page Title
                </label>
                <input
                  id={titleId}
                  type="text"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor={slugId} className="block text-xs font-bold text-foreground mb-1">
                  URL Slug
                </label>
                {activeRegion ? (
                  <>
                    <input
                      id={slugId}
                      type="text"
                      value={copyRegionSlug(activeRegion.id)}
                      readOnly
                      disabled
                      className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground"
                    />
                    {/*
                      Read-only, and saying why. The slug is the registry's
                      identity for this region — `CopyRegion` renders
                      `copy-home-hero`, and renaming it here would leave the page
                      rendering a row nobody reads while the page's copy stays
                      frozen. That is the shadowed-CMS failure in a new costume.
                    */}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      This is the <strong>{activeRegion.label}</strong> copy region on{' '}
                      <code className="font-mono">{pathname}</code>. Its slug is managed by the
                      region, so it cannot be renamed here.
                    </p>
                  </>
                ) : (
                  <input
                    id={slugId}
                    type="text"
                    value={pageSlug}
                    onChange={(e) => setPageSlug(e.target.value)}
                    required
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  />
                )}
              </div>

              <div>
                <label
                  htmlFor={featuredImageId}
                  className="block text-xs font-bold text-foreground mb-1"
                >
                  Featured Hero Image
                </label>
                <div className="flex gap-2">
                  <input
                    id={featuredImageId}
                    type="url"
                    value={pageFeaturedImage}
                    onChange={(e) => setPageFeaturedImage(e.target.value)}
                    placeholder="https://...supabase.co/storage/v1/object/public/media/..."
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMediaTarget('featured');
                      setMediaModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-bold text-foreground hover:bg-border shrink-0"
                  >
                    <FolderOpen size={14} className="text-primary" />
                    <span>S3 Storage</span>
                  </button>
                </div>
              </div>

              {pageFeaturedImage && (
                <div className="relative aspect-video w-full max-h-36 rounded-xl bg-surface-muted overflow-hidden border border-border">
                  <Image
                    src={pageFeaturedImage}
                    alt="Hero preview"
                    unoptimized
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              {/* Live SERP & Social Sharing Preview */}
              <div className="rounded-2xl border border-border bg-surface-muted/50 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Globe size={13} className="text-primary" />
                    <span>Search &amp; Social Preview</span>
                  </span>
                  <div className="flex items-center rounded-lg border border-border bg-background p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setPreviewTab('serp')}
                      className={`px-2 py-0.5 rounded-md transition-colors ${
                        previewTab === 'serp'
                          ? 'bg-primary text-white shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      aria-label="Preview Google search snippet"
                    >
                      Google SERP
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('social')}
                      className={`px-2 py-0.5 rounded-md transition-colors ${
                        previewTab === 'social'
                          ? 'bg-primary text-white shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      aria-label="Preview social share card"
                    >
                      Social Card
                    </button>
                  </div>
                </div>

                {previewTab === 'serp' ? (
                  /* Google SERP Snippet Preview */
                  <div className="rounded-xl border border-border/80 bg-background p-3 space-y-1 text-left select-none">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-3.5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-black text-primary">
                        I
                      </span>
                      <span className="truncate">indivisiblefairoaks.org</span>
                      <span className="text-muted-foreground/60">&rsaquo;</span>
                      <span className="truncate font-mono text-[10px]">
                        {activeRegion ? pathname.replace(/^\//, '') : pageSlug || 'page'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-blue-500 hover:underline truncate cursor-pointer">
                      {pageTitle.trim() || 'Untitled Page'} | Indivisible Fair Oaks
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      Official Indivisible Fair Oaks &amp; Carmichael grassroots action, civic
                      events, and community advocacy in Sacramento County.
                    </p>
                  </div>
                ) : (
                  /* Social Card Preview */
                  <div className="rounded-xl border border-border/80 bg-background overflow-hidden text-left select-none shadow-xs">
                    {pageFeaturedImage ? (
                      <div className="relative aspect-[1.91/1] w-full max-h-32 bg-surface-muted overflow-hidden">
                        <Image
                          src={pageFeaturedImage}
                          alt="Social share preview"
                          unoptimized
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[1.91/1] w-full max-h-24 bg-gradient-to-br from-primary/20 via-background to-accent-gold/10 flex items-center justify-center p-3 text-center">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Indivisible Fair Oaks &amp; Carmichael
                        </span>
                      </div>
                    )}
                    <div className="p-2.5 space-y-0.5 border-t border-border/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        indivisiblefairoaks.org
                      </p>
                      <p className="text-xs font-bold text-foreground truncate">
                        {pageTitle.trim() || 'Untitled Page'}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        Grassroots action, community advocacy, and voter empowerment.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <fieldset className="border-0 p-0 m-0">
                <legend className="block text-xs font-bold text-foreground mb-1">
                  Publication Status
                </legend>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPageStatus('publish')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                      pageStatus === 'publish'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-surface-muted text-foreground hover:bg-border border border-border'
                    }`}
                  >
                    Published
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageStatus('draft')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                      pageStatus === 'draft'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-surface-muted text-foreground hover:bg-border border border-border'
                    }`}
                  >
                    Draft
                  </button>
                </div>
              </fieldset>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportPageJson}
                    title="Export page document and blocks as JSON"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-foreground hover:bg-surface-muted text-xs font-bold transition-colors"
                  >
                    <Download size={14} className="text-muted-foreground" />
                    <span>Export JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleImportPageJson}
                    title="Import page snapshot JSON file"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-foreground hover:bg-surface-muted text-xs font-bold transition-colors"
                  >
                    <Upload size={14} className="text-muted-foreground" />
                    <span>Import JSON</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingBackend}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-raised hover:bg-primary-dark"
                  >
                    {savingBackend && <Loader2 size={13} className="animate-spin" />}
                    <span>Save Page Settings</span>
                  </button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Supabase S3 Media Library Modal ────────────────────────────── */}
      {mediaModalOpen && (
        <CRMMediaLibraryModal
          isOpen={mediaModalOpen}
          onClose={() => setMediaModalOpen(false)}
          onSelectMedia={(item) => {
            if (mediaTarget === 'image-replace' && imageSession) {
              const { element: imgEl, copyRegionId, blockIndex } = imageSession;
              imgEl.src = item.url;
              if (item.alt || item.name) {
                imgEl.alt = item.alt || item.name;
              }
              imageSessionRef.current = null;
              setImageSession(null);
              if (copyRegionId) {
                void writeToCopyRegion({
                  copyRegionId,
                  successMessage: `Region "${copyRegionId}" image updated from S3`,
                  errorMessage: 'Failed to save copy region',
                });
              } else if (blockIndex !== null && blocksRef.current[blockIndex]) {
                void writeToBlock({
                  blockIndex,
                  blocks: blocksRef.current,
                  successMessage: 'Image updated from S3 storage',
                  errorMessage: 'Failed to save image',
                  mutate: (target) =>
                    target.type === 'image'
                      ? {
                          ...target,
                          src: item.url,
                          alt: item.alt || item.name,
                          width: item.width ?? target.width,
                          height: item.height ?? target.height,
                        }
                      : undefined,
                });
              } else {
                toast.success('Image source updated');
              }
            } else if (mediaTarget === 'featured') {
              setPageFeaturedImage(item.url);
              toast.success('Featured image selected from Supabase storage');
            } else if (editingBlock && editingBlock.type === 'image') {
              setEditingBlock({
                ...editingBlock,
                src: item.url,
                alt: item.alt || item.name,
                width: item.width ?? null,
                height: item.height ?? null,
              });
              toast.success('Image selected from Supabase storage');
            } else {
              const newImageBlock: Block = {
                id: nextBlockId(),
                type: 'image',
                src: item.url,
                alt: item.alt || item.name,
                caption: item.name,
                width: item.width ?? null,
                height: item.height ?? null,
              };
              const nextBlocks = [...blocksRef.current, newImageBlock];
              commitBlocks(nextBlocks);
              toast.success(`Inserted "${item.name}" as a new image section`);
            }
            setMediaModalOpen(false);
          }}
          initialFolder="content"
        />
      )}

      {/* ── Revisions History Modal ────────────────────────────────────── */}
      {isRevisionsOpen && (
        <Dialog open={isRevisionsOpen} onOpenChange={setIsRevisionsOpen}>
          <DialogContent className="max-w-xl bg-surface-card text-foreground p-6 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                <History size={20} className="text-accent-gold" />
                <span>Page Revision History</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Restore any earlier snapshot saved to the Supabase backend.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 my-3 max-h-[50vh] overflow-y-auto pr-1">
              {revisionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : revisions.length > 0 ? (
                revisions.map((rev) => (
                  <div
                    key={rev.id}
                    className="flex items-center justify-between p-3 rounded-2xl border border-border hover:border-accent-gold/50 bg-surface-muted transition-colors gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate">
                        {rev.title || 'Untitled Snapshot'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(rev.created_at).toLocaleString()} · {rev.type || 'page'} ·{' '}
                        {rev.status || 'draft'}
                      </p>
                    </div>
                    <ConfirmAction
                      label="Restore"
                      confirmLabel="Confirm Restore"
                      message="This will restore the page content to this snapshot and record a new append-only revision entry in Supabase."
                      onConfirm={() => handleRestoreRevision(rev.id)}
                      disabled={savingBackend}
                      idleClassName="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors"
                    >
                      <span>Restore</span>
                    </ConfirmAction>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-xs text-muted-foreground">
                  No previous revisions recorded yet for this page.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsRevisionsOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border"
              >
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Keyboard Shortcuts Cheat Sheet ─────────────────────────────────── */}
      {isShortcutsOpen && (
        <Dialog open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Keyboard size={18} className="text-accent-gold" />
                <span>Visual Editor Shortcuts</span>
              </DialogTitle>
              <DialogDescription>
                Power-user shortcuts to navigate, format, and manage page content rapidly.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-3 text-xs">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Navigation & Global
                </h4>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Toggle Shortcuts Cheat Sheet</span>
                    <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                      ⌘ /
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Toggle Visual Editor</span>
                    <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                      ⌘ E
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Next / Previous Section</span>
                    <div className="flex gap-1">
                      <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                        J / ↓
                      </kbd>
                      <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                        K / ↑
                      </kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Edit Selected Section</span>
                    <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                      Enter
                    </kbd>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Section & History Actions
                </h4>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Duplicate Active Section</span>
                    <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                      ⌘ D
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Delete Active Section</span>
                    <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                      ⌘ ⌫
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Undo / Redo Edit</span>
                    <div className="flex gap-1">
                      <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                        ⌘ Z
                      </kbd>
                      <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                        ⌘ ⇧ Z
                      </kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Copy / Paste Block JSON</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Section Modal
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Import / Export Page JSON</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Settings Modal
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  In-Editor Formatting
                </h4>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Bold Selection</span>
                    <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                      ⌘ B
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Italic Selection</span>
                    <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                      ⌘ I
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Underline Selection</span>
                    <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                      ⌘ U
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Insert Link</span>
                    <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                      ⌘ K
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Save In-Place Edit</span>
                    <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                      ⌘ ↵
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <span className="text-foreground">Cancel In-Place Edit</span>
                    <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsShortcutsOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border"
              >
                Got It
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── System Diagnostics Modal ────────────────────────────────────────── */}
      {isDiagnosticsModalOpen && (
        <Dialog open={isDiagnosticsModalOpen} onOpenChange={setIsDiagnosticsModalOpen}>
          <DialogContent className="max-w-xl bg-surface-card text-foreground p-6 rounded-3xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    <Activity className="text-accent-gold" size={18} />
                    System &amp; Edge Diagnostics
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Live health verification of Supabase PostgreSQL, S3 Media Storage, and Edge
                    Functions.
                  </DialogDescription>
                </div>
                <button
                  type="button"
                  onClick={() => probeBackendHealth()}
                  disabled={statusLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-light transition-colors disabled:opacity-50 shadow-xs"
                >
                  <RefreshCw size={12} className={statusLoading ? 'animate-spin' : ''} />
                  <span>{statusLoading ? 'Probing…' : 'Probe Now'}</span>
                </button>
              </div>
            </DialogHeader>

            <div className="space-y-3 my-4">
              {/* Database */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-muted border border-border">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`size-2.5 rounded-full ${
                      backendStatus?.database ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-bold text-foreground">PostgreSQL Database</p>
                    <p className="text-[11px] text-muted-foreground">
                      RLS-secured tables (content, CRM, products, catalog)
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    backendStatus?.database
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-rose-500/10 text-rose-500'
                  }`}
                >
                  {backendStatus?.database ? 'Connected' : 'Offline'}
                </span>
              </div>

              {/* S3 Storage */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-muted border border-border">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`size-2.5 rounded-full ${
                      backendStatus?.storage ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-bold text-foreground">Supabase S3 Storage</p>
                    <p className="text-[11px] text-muted-foreground">
                      Bucket &quot;media&quot; (crm, content, products folders)
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    backendStatus?.storage
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-rose-500/10 text-rose-500'
                  }`}
                >
                  {backendStatus?.storage ? 'Ready' : 'Error'}
                </span>
              </div>

              {/* Edge Function */}
              <div className="p-3 rounded-2xl bg-surface-muted border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`size-2.5 rounded-full ${
                        backendStatus?.edgeFunction ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-foreground">Edge Functions API</p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate max-w-[280px]">
                        {backendStatus?.edgeFunctionDetails?.endpoint || 'functions/v1/health'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      backendStatus?.edgeFunction
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-amber-500/10 text-amber-500'
                    }`}
                  >
                    {backendStatus?.edgeFunction ? 'Healthy' : 'Degraded'}
                  </span>
                </div>
                {backendStatus?.edgeFunctionDetails && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                    <span>
                      Latency:{' '}
                      <strong className="text-foreground">
                        {backendStatus.edgeFunctionDetails.latencyMs ?? '—'}ms
                      </strong>
                    </span>
                    <span>
                      Checked:{' '}
                      {backendStatus.edgeFunctionDetails.checkedAt
                        ? new Date(backendStatus.edgeFunctionDetails.checkedAt).toLocaleTimeString()
                        : 'Recently'}
                    </span>
                  </div>
                )}
              </div>

              {/* Platform Overview */}
              {backendSummary && (
                <div className="p-3 rounded-2xl bg-surface-muted border border-border">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Platform Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-background border border-border">
                      <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                        Constituents
                      </span>
                      <span className="text-base font-black text-foreground">
                        {backendSummary.crmTotal ?? '—'}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {backendSummary.segments} segments
                        {backendSummary.segmentsTruncated ? '+' : ''}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-background border border-border">
                      <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                        Catalog
                      </span>
                      <span className="text-base font-black text-foreground">
                        {backendSummary.products}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {backendSummary.gallery} photos · {backendSummary.events} events
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsDiagnosticsModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border"
              >
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Link Insert Dialog (replaces browser prompt) ────────────────── */}
      {linkModal && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setLinkModal(null);
          }}
        >
          <DialogContent className="max-w-md bg-surface-card text-foreground p-6 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-foreground">Insert link</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {linkModal.textareaId
                  ? 'Enter the destination URL and optional link text.'
                  : 'Enter the destination URL for the selected text.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label htmlFor="link-url" className="block text-xs font-bold text-foreground mb-1">
                  URL
                </label>
                <input
                  id="link-url"
                  type="url"
                  autoFocus
                  value={linkModal.url}
                  onChange={(e) =>
                    setLinkModal((prev) => (prev ? { ...prev, url: e.target.value } : null))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (
                        e.currentTarget.form?.querySelector('[data-confirm]') as HTMLButtonElement
                      )?.click();
                    }
                  }}
                  placeholder="https://example.com or /about"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>
              {linkModal.textareaId && (
                <div>
                  <label
                    htmlFor="link-text"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    Link text (optional — uses selected text if empty)
                  </label>
                  <input
                    id="link-text"
                    type="text"
                    value={linkModal.text}
                    onChange={(e) =>
                      setLinkModal((prev) => (prev ? { ...prev, text: e.target.value } : null))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        (
                          e.currentTarget.form?.querySelector('[data-confirm]') as HTMLButtonElement
                        )?.click();
                      }
                    }}
                    placeholder="Link"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLinkModal(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border"
              >
                Cancel
              </button>
              <button
                type="button"
                data-confirm
                disabled={!linkModal.url.trim()}
                onClick={() => {
                  const url = linkModal.url.trim();
                  if (!url) return;
                  if (linkModal.textareaId) {
                    const ta = document.getElementById(
                      linkModal.textareaId
                    ) as HTMLTextAreaElement | null;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const selectedText = ta.value.slice(start, end);
                    const linkHtml = `<a href="${url}">${linkModal.text || selectedText || 'Link'}</a>`;
                    ta.value = ta.value.slice(0, start) + linkHtml + ta.value.slice(end);
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    ta.focus();
                    const newPos = start + linkHtml.length;
                    ta.setSelectionRange(newPos, newPos);
                  } else {
                    document.execCommand('createLink', false, url);
                  }
                  setLinkModal(null);
                }}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-40"
              >
                Insert link
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Alt Text Edit Dialog (replaces browser prompt) ──────────────── */}
      {altTextModal && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setAltTextModal(null);
          }}
        >
          <DialogContent className="max-w-md bg-surface-card text-foreground p-6 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-foreground">
                Edit alt text
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Describe the image for screen readers and search engines.
              </DialogDescription>
            </DialogHeader>
            <div>
              <label
                htmlFor="alt-text-input"
                className="block text-xs font-bold text-foreground mb-1"
              >
                Alt text for accessibility
              </label>
              <input
                id="alt-text-input"
                type="text"
                autoFocus
                value={altTextModal.value}
                onChange={(e) =>
                  setAltTextModal((prev) => (prev ? { ...prev, value: e.target.value } : null))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (
                      e.currentTarget.form?.querySelector('[data-confirm]') as HTMLButtonElement
                    )?.click();
                  }
                }}
                placeholder="A brief description of the image"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAltTextModal(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border"
              >
                Cancel
              </button>
              <button
                type="button"
                data-confirm
                onClick={() => {
                  void handleSaveImageAlt(altTextModal.session, altTextModal.value);
                  setAltTextModal(null);
                }}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── CRM Panel ─────────────────────────────────────────────────────── */}
      <CRMPanel
        isOpen={isCRMPanelOpen}
        onClose={() => setIsCRMPanelOpen(false)}
        initialTab={crmTab}
      />
    </>
  );
}
