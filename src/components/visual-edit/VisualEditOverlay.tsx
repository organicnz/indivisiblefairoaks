'use client';

import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bold,
  Code,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  History,
  Italic,
  Layers,
  Link as LinkIcon,
  Loader2,
  PenLine,
  Plus,
  Redo2,
  RefreshCw,
  Settings,
  Sparkles,
  Strikethrough,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CRMMediaLibraryModal } from '@/components/admin/crm/composer/CRMMediaLibraryModal';
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
import { getCRMEdgeFunctionHealth } from '@/lib/actions/crm';
import { getVisualPageContext } from '@/lib/actions/visual';
import {
  type Block,
  CALLOUT_TONES,
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
import type { CRMBackendStatus } from '@/types/crm';
import type {
  CRMMediaTarget,
  VisualContentRow,
  AddBlockDetail as VisualSectionAddBlockDetail,
  DeleteSectionDetail as VisualSectionDeleteDetail,
  DuplicateSectionDetail as VisualSectionDuplicateDetail,
  FocusSectionDetail as VisualSectionFocusEventDetail,
  MoveSectionDetail as VisualSectionMoveEventDetail,
  VisualSectionOverlayItem,
  ToggleSectionDetail as VisualSectionToggleEventDetail,
} from '@/types/unified';

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

/**
 * The prefix `saveContent` puts on a refused concurrent write.
 *
 * The action has no `reason` field — a refusal is an error string — and the
 * overlay has to tell it apart from a quota failure or a validation failure,
 * because it is the only one where retrying is futile and reloading is the
 * answer. It matches the same prefix `ContentEditor` does, so the two editors
 * cannot disagree about which failures are conflicts.
 */
const STALE_SAVE_CONFLICT_PREFIX = 'Someone else saved this page';

function isStaleConflict(message: string | undefined): boolean {
  return typeof message === 'string' && message.startsWith(STALE_SAVE_CONFLICT_PREFIX);
}

/**
 * Intelligently extracts structured blocks from a live rendered DOM element
 * so that static pages can be edited and synced directly to Supabase.
 */
function extractBlocksFromDOM(root: HTMLElement): Block[] {
  const extracted: Block[] = [];
  const children = Array.from(root.children);

  children.forEach((child, idx) => {
    if (!(child instanceof HTMLElement)) return;
    const blockId = nextBlockId();

    // Check heading
    const heading = child.matches('h1, h2, h3, h4, h5, h6')
      ? child
      : child.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      const levelNum = Number.parseInt(heading.tagName.replace('H', ''), 10) || 2;
      const level = (levelNum >= 2 && levelNum <= 4 ? levelNum : 2) as HeadingLevel;
      extracted.push({
        id: blockId,
        type: 'heading',
        level,
        html: heading.innerHTML.trim() || heading.textContent?.trim() || `Section ${idx + 1}`,
      });
      return;
    }

    // Check image
    const img = child.matches('img') ? (child as HTMLImageElement) : child.querySelector('img');
    if (img?.src) {
      extracted.push({
        id: blockId,
        type: 'image',
        src: img.src,
        alt: img.alt || '',
        caption: '',
        width: img.naturalWidth || null,
        height: img.naturalHeight || null,
      });
      return;
    }

    // Check lists
    const ul = child.matches('ul, ol') ? child : child.querySelector('ul, ol');
    if (ul) {
      const isOrdered = ul.tagName === 'OL';
      const items = Array.from(ul.querySelectorAll('li')).map((li) => li.textContent?.trim() || '');
      extracted.push({
        id: blockId,
        type: isOrdered ? 'orderedList' : 'bulletList',
        items: items.length > 0 ? items : ['List item'],
      });
      return;
    }

    // Check quotes
    const quote = child.matches('blockquote') ? child : child.querySelector('blockquote');
    if (quote) {
      extracted.push({
        id: blockId,
        type: 'quote',
        html: quote.innerHTML.trim() || quote.textContent?.trim() || '',
      });
      return;
    }

    // Check button / CTA
    const btn = child.matches('a, button') ? child : child.querySelector('a, button');
    if (
      btn &&
      btn instanceof HTMLElement &&
      (btn.classList.contains('btn') ||
        btn.getAttribute('role') === 'button' ||
        btn.tagName === 'BUTTON')
    ) {
      const href = btn.getAttribute('href') || '/';
      extracted.push({
        id: blockId,
        type: 'button',
        label: btn.textContent?.trim() || 'Take Action',
        href,
      });
      return;
    }

    // Paragraph or generic text
    const p = child.matches('p') ? child : child.querySelector('p');
    const htmlContent = p ? p.innerHTML.trim() : child.innerHTML.trim();
    if (htmlContent) {
      extracted.push({
        id: blockId,
        type: 'paragraph',
        html: htmlContent,
      });
    } else {
      extracted.push({
        id: blockId,
        type: 'paragraph',
        html: child.textContent?.trim() || `Section ${idx + 1} content`,
      });
    }
  });

  return extracted.length > 0
    ? extracted
    : [{ id: nextBlockId(), type: 'paragraph', html: 'Section content' }];
}

export function VisualEditOverlay() {
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = rawPathname ?? '/';
  const { enabled, toggle } = useVisualEditMode(pathname);
  const { isAdmin, target } = useEditContext(pathname);

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
  const [backendStatus, setBackendStatus] = useState<CRMBackendStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [savingBackend, setSavingBackend] = useState(false);
  /**
   * Backend summary for the health panel: CRM reach, catalog depth, media
   * depth. From the one-gate `getVisualPageContext` summary — additive to the
   * health probe, never a second gate on the critical open path. Null until
   * the first successful fetch; a failure leaves the previous summary (or
   * nothing) rather than blanking the panel.
   */
  const [backendSummary, setBackendSummary] = useState<{
    crmTotal: number | null;
    segments: number;
    products: number;
    gallery: number;
    events: number;
    mediaItems: number;
  } | null>(null);

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

  // Supabase S3 Storage media library modal state
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<CRMMediaTarget>('section');

  // Revisions history modal state
  const [isRevisionsOpen, setIsRevisionsOpen] = useState(false);
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  // Backend health details popover state
  const [showHealthDetails, setShowHealthDetails] = useState(false);

  const titleId = useId();
  const slugId = useId();
  const featuredImageId = useId();

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

  /** Wrap selected text in a textarea with prefix/suffix tags. */
  const wrapSelection = useCallback((textareaId: string, prefix: string, suffix: string) => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.slice(start, end);
    const wrapped = selected ? `${prefix}${selected}${suffix}` : `${prefix}${suffix}`;
    textarea.value = text.slice(0, start) + wrapped + text.slice(end);
    textarea.focus();
    // Restore cursor position after wrapped text
    const newPos = start + wrapped.length;
    textarea.setSelectionRange(newPos, newPos);
    // Trigger React change event
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  /** Insert a link at cursor position. */
  const insertLink = useCallback((textareaId: string) => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    if (!textarea) return;
    const url = prompt('Enter link URL:');
    if (!url) return;
    const text = prompt('Enter link text:', 'Link') || 'Link';
    const linkHtml = `<a href="${url}">${text}</a>`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    textarea.value = currentText.slice(0, start) + linkHtml + currentText.slice(end);
    textarea.focus();
    const newPos = start + linkHtml.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  /** Handle keyboard shortcuts in the editor. */
  const handleEditorShortcuts = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, textareaId: string) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        wrapSelection(textareaId, '<strong>', '</strong>');
      } else if (key === 'i') {
        e.preventDefault();
        wrapSelection(textareaId, '<em>', '</em>');
      } else if (key === 'k') {
        e.preventDefault();
        insertLink(textareaId);
      }
    },
    [wrapSelection, insertLink]
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
        row = await getContentForEdit(rowId);
      }
      if (!row && slug) {
        row = await getContentBySlugForEdit(slug);
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
      const res = await saveContent({
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
      const ctx = await getVisualPageContext({ pathname });
      setBackendSummary({
        crmTotal: ctx.crmStats?.totalContacts ?? null,
        segments: ctx.segments.length,
        products: ctx.catalog.products,
        gallery: ctx.catalog.galleryPhotos,
        events: ctx.catalog.events,
        mediaItems: ctx.media.items.length,
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
        index: section.domIndex,
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
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [enabled, isAdmin, updateOverlays]);

  const located = useMemo(() => new Map<string, HTMLElement>(), []);

  const jumpTo = useCallback(
    (blockIndex: number) => {
      const element = locate(blockIndex);
      if (!element) return;

      setActiveBlockIndex(blockIndex);
      highlightPageSection(element);
      located.set(String(blockIndex), element);
    },
    [locate, located]
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

        const res = await saveContent({
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
      target,
    ]
  );

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

  // Revisions management
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
      const { blockIndex, openEdit } =
        (e as CustomEvent<VisualSectionFocusEventDetail>).detail ?? {};
      if (blockIndex === undefined) return;
      jumpTo(blockIndex);
      if (openEdit) handleOpenEditSection(blockIndex);
    };

    const handleToggleSectionVisual = (e: Event) => {
      const detail = (e as CustomEvent<VisualSectionToggleEventDetail>).detail;
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
      const detail = (e as CustomEvent<VisualSectionMoveEventDetail>).detail;
      if (detail?.blockIndex === undefined || !detail.direction) return;
      handleMoveSection(detail.blockIndex, detail.direction);
    };

    const handleAddBlockAtEvent = (e: Event) => {
      const detail = (e as CustomEvent<VisualSectionAddBlockDetail>).detail;
      handleAddNewSection(detail?.type ?? 'paragraph', detail?.insertAfterBlockIndex);
    };

    const handleAddBlockGeneral = () => {
      handleAddNewSection('paragraph');
    };

    const handleDuplicateSectionEvent = (e: Event) => {
      const detail = (e as CustomEvent<VisualSectionDuplicateDetail>).detail;
      if (detail?.blockIndex === undefined) return;
      handleDuplicateSection(detail.blockIndex);
    };

    const handleDeleteSectionEvent = (e: Event) => {
      const detail = (e as CustomEvent<VisualSectionDeleteDetail>).detail;
      if (detail?.blockIndex === undefined) return;
      handleDeleteSection(detail.blockIndex);
    };

    const handleOpenMediaLibrary = () => {
      setMediaTarget('section');
      setMediaModalOpen(true);
    };

    const handleOpenSettings = () => {
      setIsSettingsOpen(true);
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
    window.addEventListener(VISUAL_EDIT_EVENTS.openMediaLibrary, handleOpenMediaLibrary);
    window.addEventListener(VISUAL_EDIT_EVENTS.openRevisions, handleOpenRevisions);
    window.addEventListener(VISUAL_EDIT_EVENTS.openSettings, handleOpenSettings);
    window.addEventListener(VISUAL_EDIT_EVENTS.selectRegion, handleSelectRegion);

    return () => {
      window.removeEventListener(VISUAL_EDIT_EVENTS.focusSection, handleFocusSection);
      window.removeEventListener(VISUAL_EDIT_EVENTS.toggleSection, handleToggleSectionVisual);
      window.removeEventListener(VISUAL_EDIT_EVENTS.moveSection, handleMoveSectionEvent);
      window.removeEventListener(VISUAL_EDIT_EVENTS.addBlockAt, handleAddBlockAtEvent);
      window.removeEventListener(VISUAL_EDIT_EVENTS.addBlock, handleAddBlockGeneral);
      window.removeEventListener(VISUAL_EDIT_EVENTS.duplicateSection, handleDuplicateSectionEvent);
      window.removeEventListener(VISUAL_EDIT_EVENTS.deleteSection, handleDeleteSectionEvent);
      window.removeEventListener(VISUAL_EDIT_EVENTS.openMediaLibrary, handleOpenMediaLibrary);
      window.removeEventListener(VISUAL_EDIT_EVENTS.openRevisions, handleOpenRevisions);
      window.removeEventListener(VISUAL_EDIT_EVENTS.openSettings, handleOpenSettings);
      window.removeEventListener(VISUAL_EDIT_EVENTS.selectRegion, handleSelectRegion);
    };
  }, [
    activeRegionId,
    enabled,
    isAdmin,
    handleAddNewSection,
    handleDeleteSection,
    handleDuplicateSection,
    handleMoveSection,
    handleOpenEditSection,
    handleOpenRevisions,
    jumpTo,
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

      const res = await saveContent({
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
            className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-secondary hover:bg-accent-gold"
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
              key={item.index}
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
                    className="rounded p-1 text-accent-gold hover:bg-white/15 hover:text-white transition-colors"
                  >
                    <PenLine size={13} />
                  </button>

                  {/* Duplicate section */}
                  <button
                    type="button"
                    onClick={() => handleDuplicateSection(item.blockIndex)}
                    title="Duplicate section"
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
                      className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
                    >
                      <ArrowDown size={13} />
                    </button>
                  )}

                  {/* Add block below */}
                  <button
                    type="button"
                    onClick={() => handleAddNewSection('paragraph', item.blockIndex)}
                    title="Add block below"
                    className="rounded p-1 text-emerald-400 hover:bg-white/15 hover:text-emerald-300 transition-colors"
                  >
                    <Plus size={13} />
                  </button>

                  {/* Turn off visual frame for this section */}
                  <button
                    type="button"
                    onClick={() => toggleSectionFrame(item.blockIndex)}
                    title="Hide visual frame for this section"
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
                  ? 'bg-accent text-secondary hover:bg-accent-gold'
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

            {/* Add Section Menu */}
            <div className="relative group">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-bright px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-colors hover:bg-primary-light focus-visible:ring-2 focus-visible:ring-accent-gold"
              >
                <Plus size={14} />
                <span>Add Block</span>
              </button>
              <div className="absolute bottom-full right-0 mb-2 hidden w-48 rounded-xl border border-white/15 bg-secondary p-1.5 shadow-float group-hover:block z-50">
                <button
                  type="button"
                  onClick={() => handleAddNewSection('heading')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10"
                >
                  Heading (H2)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewSection('paragraph')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10"
                >
                  Paragraph Text
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewSection('bulletList')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10"
                >
                  Bullet List
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewSection('orderedList')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10"
                >
                  Numbered Steps
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewSection('image')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10"
                >
                  Image (S3 Storage)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewSection('callout')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10"
                >
                  Alert / Callout
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewSection('button')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10"
                >
                  Button CTA
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewSection('quote')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10"
                >
                  Quote Block
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewSection('divider')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10"
                >
                  Divider Line
                </button>
              </div>
            </div>

            {/* S3 Storage Media Library */}
            <button
              type="button"
              onClick={() => {
                setMediaTarget('section');
                setMediaModalOpen(true);
              }}
              title="Open Supabase S3 Media Library"
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
              >
                <History size={14} />
                <span className="hidden sm:inline">Revisions</span>
              </button>
            )}

            {/* Quick CRM Studio Link */}
            <a
              href="/admin/crm/broadcasts"
              target="_blank"
              rel="noreferrer"
              title="Open CRM Studio (Broadcasts & Constituents)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
            >
              <ExternalLink size={14} className="text-primary-on-dark" />
              <span className="hidden lg:inline">CRM Studio</span>
            </a>

            {/* Backend Health Badge */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowHealthDetails((p) => !p)}
                title="Supabase Backend & Edge Function Health"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-bold text-ink-muted-on-dark hover:bg-white/10"
              >
                <Activity
                  size={13}
                  className={backendStatus?.database ? 'text-emerald-400' : 'text-amber-400'}
                />
                <span
                  className={`size-2 rounded-full ${
                    backendStatus?.database && backendStatus?.storage
                      ? 'bg-emerald-400'
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
                        <span className="font-bold">{backendSummary.mediaItems} recent files</span>
                      </div>
                    </div>
                  )}
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

        {/* Section List Quick Links bar */}
        {blocks.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2 overflow-x-auto border-t border-white/10 pt-2 text-xs no-scrollbar">
            <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-ink-muted-on-dark">
              Blocks:
            </span>
            {blocks.map((block, idx) => (
              <div
                key={block.id}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-ink-on-dark"
              >
                <span className="font-semibold capitalize truncate max-w-[90px]">{block.type}</span>
                <button
                  type="button"
                  onClick={() => handleOpenEditSection(idx)}
                  title="Edit block"
                  className="text-accent-gold hover:text-white p-0.5"
                >
                  <PenLine size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicateSection(idx)}
                  title="Duplicate block"
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  <Copy size={11} />
                </button>
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => handleMoveSection(idx, 'up')}
                    title="Move up"
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
                    className="text-slate-400 hover:text-white p-0.5"
                  >
                    <ArrowDown size={11} />
                  </button>
                )}
              </div>
            ))}
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
          <DialogContent className="max-w-2xl bg-white text-secondary p-6 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-secondary">
                {activeSectionLabel || `Block ${(editingBlockIndex ?? 0) + 1}`}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Editing a {editingBlock.type} block. Changes persist directly to the Supabase
                backend, and undo brings this one back if you change your mind.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2 max-h-[60vh] overflow-y-auto pr-1">
              {/* Block Type Selector */}
              <div>
                <label
                  htmlFor={blockTypeId}
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Block Type
                </label>
                <select
                  id={blockTypeId}
                  value={editingBlock.type}
                  onChange={(e) => {
                    const newType = e.target.value as Block['type'];
                    if (newType === 'heading') {
                      setEditingBlock({
                        id: editingBlock.id,
                        type: 'heading',
                        level: 2,
                        html: 'Heading',
                      });
                    } else if (newType === 'bulletList') {
                      setEditingBlock({
                        id: editingBlock.id,
                        type: 'bulletList',
                        items: ['Action item 1', 'Action item 2'],
                      });
                    } else if (newType === 'orderedList') {
                      setEditingBlock({
                        id: editingBlock.id,
                        type: 'orderedList',
                        items: ['Step 1', 'Step 2'],
                      });
                    } else if (newType === 'callout') {
                      setEditingBlock({
                        id: editingBlock.id,
                        type: 'callout',
                        tone: 'info',
                        html: 'Note',
                      });
                    } else if (newType === 'image') {
                      setEditingBlock({
                        id: editingBlock.id,
                        type: 'image',
                        src: '',
                        alt: '',
                        caption: '',
                        width: null,
                        height: null,
                      });
                    } else if (newType === 'button') {
                      setEditingBlock({
                        id: editingBlock.id,
                        type: 'button',
                        label: 'Click',
                        href: '/',
                      });
                    } else if (newType === 'quote') {
                      setEditingBlock({ id: editingBlock.id, type: 'quote', html: 'Quote text' });
                    } else if (newType === 'divider') {
                      setEditingBlock({ id: editingBlock.id, type: 'divider' });
                    } else {
                      setEditingBlock({
                        id: editingBlock.id,
                        type: 'paragraph',
                        html: 'Paragraph copy',
                      });
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary"
                >
                  <option value="paragraph">Paragraph Text</option>
                  <option value="heading">Heading</option>
                  <option value="bulletList">Bullet List</option>
                  <option value="orderedList">Numbered Steps</option>
                  <option value="image">Image (Supabase S3)</option>
                  <option value="callout">Callout / Alert</option>
                  <option value="button">Button CTA</option>
                  <option value="quote">Quote</option>
                  <option value="divider">Divider</option>
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
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        H{lvl}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label
                      htmlFor={headingContentId}
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Heading Content
                    </label>
                    <input
                      id={headingContentId}
                      type="text"
                      value={editingBlock.html}
                      onChange={(e) => setEditingBlock({ ...editingBlock, html: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Paragraph Fields */}
              {editingBlock.type === 'paragraph' && (
                <div>
                  <label
                    htmlFor={paragraphContentId}
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Paragraph Content
                  </label>
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    {/* Inline formatting toolbar */}
                    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
                      <button
                        type="button"
                        onClick={() => wrapSelection(paragraphContentId, '<strong>', '</strong>')}
                        title="Bold (⌘B)"
                        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                        aria-label="Bold"
                      >
                        <Bold size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => wrapSelection(paragraphContentId, '<em>', '</em>')}
                        title="Italic (⌘I)"
                        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                        aria-label="Italic"
                      >
                        <Italic size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => wrapSelection(paragraphContentId, '<code>', '</code>')}
                        title="Inline Code"
                        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                        aria-label="Inline Code"
                      >
                        <Code size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => wrapSelection(paragraphContentId, '<s>', '</s>')}
                        title="Strikethrough"
                        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                        aria-label="Strikethrough"
                      >
                        <Strikethrough size={14} />
                      </button>
                      <div className="w-px h-5 bg-slate-300 mx-1" />
                      <button
                        type="button"
                        onClick={() => insertLink(paragraphContentId)}
                        title="Insert Link (⌘K)"
                        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                        aria-label="Insert Link"
                      >
                        <LinkIcon size={14} />
                      </button>
                      <span className="flex-1" />
                      <span className="text-[10px] text-slate-400 font-mono">HTML supported</span>
                    </div>
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
                </div>
              )}

              {/* List Fields */}
              {(editingBlock.type === 'bulletList' || editingBlock.type === 'orderedList') && (
                <div>
                  <label
                    htmlFor={listItemsId}
                    className="block text-xs font-bold text-slate-700 mb-1"
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
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-primary font-mono"
                  />
                </div>
              )}

              {/* Callout Fields */}
              {editingBlock.type === 'callout' && (
                <div className="space-y-3">
                  <fieldset className="border-0 p-0 m-0">
                    <legend className="block text-xs font-bold text-slate-700 mb-1">Tone</legend>
                    <div className="flex gap-2">
                      {CALLOUT_TONES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEditingBlock({ ...editingBlock, tone: t })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${
                            editingBlock.tone === t
                              ? 'bg-accent-gold text-secondary'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Callout Message
                    </label>
                    <textarea
                      id={calloutMessageId}
                      rows={3}
                      value={editingBlock.html}
                      onChange={(e) => setEditingBlock({ ...editingBlock, html: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Image Fields (with Supabase S3 storage modal) */}
              {editingBlock.type === 'image' && (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor={imageSrcId}
                      className="block text-xs font-bold text-slate-700 mb-1"
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
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setMediaTarget('section');
                          setMediaModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 shadow-2xs shrink-0"
                      >
                        <FolderOpen size={14} className="text-primary" />
                        <span>S3 Storage</span>
                      </button>
                    </div>
                  </div>
                  {editingBlock.src && (
                    <div className="relative aspect-video w-full max-h-48 rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
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
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Alt Text
                      </label>
                      <input
                        id={imageAltId}
                        type="text"
                        value={editingBlock.alt}
                        onChange={(e) => setEditingBlock({ ...editingBlock, alt: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={imageCaptionId}
                        className="block text-xs font-bold text-slate-700 mb-1"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
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
                        className="block text-xs font-bold text-slate-700 mb-1"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={buttonHrefId}
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Destination URL
                      </label>
                      <input
                        id={buttonHrefId}
                        type="text"
                        value={editingBlock.href}
                        onChange={(e) => setEditingBlock({ ...editingBlock, href: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
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
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition-colors"
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
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Quote Text
                  </label>
                  <textarea
                    id={quoteTextId}
                    rows={3}
                    value={editingBlock.html}
                    onChange={(e) => setEditingBlock({ ...editingBlock, html: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                  />
                </div>
              )}

              {/* Divider Notice */}
              {editingBlock.type === 'divider' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                  A visual horizontal rule dividing sections.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
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
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsSectionModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
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
          <DialogContent className="max-w-lg bg-white text-secondary p-6 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-secondary">
                Page Settings &amp; Metadata
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Update document metadata and the featured hero image stored in Supabase S3 storage.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSavePageSettings} className="space-y-4 my-2">
              <div>
                <label htmlFor={titleId} className="block text-xs font-bold text-slate-700 mb-1">
                  Page Title
                </label>
                <input
                  id={titleId}
                  type="text"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor={slugId} className="block text-xs font-bold text-slate-700 mb-1">
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
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                    />
                    {/*
                      Read-only, and saying why. The slug is the registry's
                      identity for this region — `CopyRegion` renders
                      `copy-home-hero`, and renaming it here would leave the page
                      rendering a row nobody reads while the page's copy stays
                      frozen. That is the shadowed-CMS failure in a new costume.
                    */}
                    <p className="mt-1 text-[11px] text-slate-500">
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  />
                )}
              </div>

              <div>
                <label
                  htmlFor={featuredImageId}
                  className="block text-xs font-bold text-slate-700 mb-1"
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
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMediaTarget('featured');
                      setMediaModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 shrink-0"
                  >
                    <FolderOpen size={14} className="text-primary" />
                    <span>S3 Storage</span>
                  </button>
                </div>
              </div>

              {pageFeaturedImage && (
                <div className="relative aspect-video w-full max-h-36 rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
                  <Image
                    src={pageFeaturedImage}
                    alt="Hero preview"
                    unoptimized
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              <fieldset className="border-0 p-0 m-0">
                <legend className="block text-xs font-bold text-slate-700 mb-1">
                  Publication Status
                </legend>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPageStatus('publish')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                      pageStatus === 'publish'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Draft
                  </button>
                </div>
              </fieldset>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
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
            if (mediaTarget === 'featured') {
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
            }
            setMediaModalOpen(false);
          }}
          initialFolder="content"
        />
      )}

      {/* ── Revisions History Modal ────────────────────────────────────── */}
      {isRevisionsOpen && (
        <Dialog open={isRevisionsOpen} onOpenChange={setIsRevisionsOpen}>
          <DialogContent className="max-w-xl bg-white text-secondary p-6 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-secondary flex items-center gap-2">
                <History size={20} className="text-accent-gold" />
                <span>Page Revision History</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
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
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:border-accent-gold/50 bg-slate-50 transition-colors gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {rev.title || 'Untitled Snapshot'}
                      </p>
                      <p className="text-[11px] text-slate-500">
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
                <p className="text-center py-6 text-xs text-slate-500">
                  No previous revisions recorded yet for this page.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRevisionsOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
