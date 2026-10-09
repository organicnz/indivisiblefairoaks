'use client';

import {
  Activity,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  FolderOpen,
  Layers,
  Loader2,
  PenLine,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
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
  getContentBySlugForEdit,
  getContentForEdit,
  saveContent,
  setContentStatus,
} from '@/lib/actions/content';
import { getCRMEdgeFunctionHealth } from '@/lib/actions/crm';
import {
  type Block,
  CALLOUT_TONES,
  type HeadingLevel,
  parseHtml,
  serializeBlocks,
} from '@/lib/blocks';
import { cmsSlugForPath } from '@/lib/edit-target';
import type { PageSection } from '@/lib/visual-edit-mode';
import { collectPageSections } from '@/lib/visual-edit-mode';
import type {
  CRMBackendStatus,
  CRMMediaTarget,
  VisualContentRow,
  VisualSectionOverlayItem,
} from '@/types/crm';

/**
 * Visual editing surface for every page across the site.
 *
 * Full in-page visual editor with CRUD connected directly to the Supabase backend:
 * - Live section discovery, highlighting, and on-section quick controls
 * - Section editor supporting Headings, Paragraphs, Lists, Images, Callouts, Quotes, Buttons
 * - Supabase S3 Storage media library integration for image picking and uploading
 * - Supabase Edge Functions health status and latency monitoring
 * - Direct optimistic updates with server-side validation and concurrency safety
 */

export const VISUAL_EDIT_ROOT_ATTR = 'data-visual-edit-root';
const HIGHLIGHT_MS = 1600;

export function VisualEditOverlay() {
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = rawPathname ?? '/';
  const { enabled, toggle } = useVisualEditMode(pathname);
  const { isAdmin, target } = useEditContext(pathname);

  const rootRef = useRef<HTMLElement | null>(null);
  const [sections, setSections] = useState<PageSection[]>([]);
  const [contentRow, setContentRow] = useState<VisualContentRow | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [backendStatus, setBackendStatus] = useState<CRMBackendStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [savingBackend, setSavingBackend] = useState(false);

  // In-page section badge and outline states
  const [showSectionBadges, setShowSectionBadges] = useState(true);
  const [showAllSectionBorders, setShowAllSectionBorders] = useState(true);
  const [sectionOverlays, setSectionOverlays] = useState<VisualSectionOverlayItem[]>([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(null);

  // Section editor modal state
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);

  // Page settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageFeaturedImage, setPageFeaturedImage] = useState('');
  const [pageStatus, setPageStatus] = useState<'publish' | 'draft'>('draft');

  // Supabase S3 Storage media library modal state
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<CRMMediaTarget>('section');

  // Backend health details popover state
  const [showHealthDetails, setShowHealthDetails] = useState(false);

  const titleId = useId();
  const slugId = useId();
  const featuredImageId = useId();

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

  const locate = useCallback((index: number): HTMLElement | null => {
    const root = rootRef.current;
    if (!root) return null;
    return root.children[index] instanceof HTMLElement
      ? (root.children[index] as HTMLElement)
      : null;
  }, []);

  // Load content row and blocks when visual editing is turned on
  const loadContentData = useCallback(async () => {
    let slug = cmsSlugForPath(pathname);
    if (!slug && (pathname === '/' || pathname === '')) {
      slug = 'home';
    }
    if (!slug) {
      setContentRow(null);
      setBlocks([]);
      return;
    }

    try {
      let row = null;
      if (target?.editUrl) {
        const id = Number.parseInt(target.editUrl.split('/').pop() || '', 10);
        if (!Number.isNaN(id) && id > 0) {
          row = await getContentForEdit(id);
        }
      }
      if (!row) {
        row = await getContentBySlugForEdit(slug);
      }

      if (row) {
        setContentRow(row as VisualContentRow);
        setPageTitle(row.title);
        setPageSlug(row.slug);
        setPageFeaturedImage(row.featured_image || '');
        setPageStatus((row.status === 'publish' ? 'publish' : 'draft') as 'publish' | 'draft');
        setBlocks(parseHtml(row.body || ''));
      }
    } catch {
      // Non-fatal if loading row fails
    }
  }, [pathname, target]);

  // Connect / Initialize a static page into a Supabase CMS row
  const handleInitializeCMSPage = async () => {
    let slug = cmsSlugForPath(pathname);
    if (!slug) {
      if (pathname === '/' || pathname === '') slug = 'home';
      else
        slug = pathname
          .replace(/^\//, '')
          .replace(/[^a-z0-9-]/gi, '-')
          .toLowerCase();
    }
    const title =
      document.querySelector('h1')?.textContent?.trim() ||
      target?.label ||
      slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const initialBlocks: Block[] =
      sections.length > 0
        ? sections.map((sec, i) => ({
            id: `init-${i}`,
            type: 'paragraph' as const,
            html: sec.label,
          }))
        : [{ id: 'init-0', type: 'paragraph' as const, html: 'Add section copy here...' }];

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

  // Probe backend health (DB, S3 Storage, Edge Functions)
  const probeBackendHealth = useCallback(async () => {
    setStatusLoading(true);
    try {
      const health = await getCRMEdgeFunctionHealth();
      setBackendStatus(health);
    } catch {
      setBackendStatus({ database: false, storage: false, edgeFunction: false });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // Collect DOM sections and load data when enabled
  useEffect(() => {
    if (!enabled || !isAdmin) {
      setSections([]);
      return;
    }

    const root =
      document.querySelector<HTMLElement>(`[${VISUAL_EDIT_ROOT_ATTR}]`) ||
      document.querySelector<HTMLElement>('main');
    rootRef.current = root;
    setSections(root ? collectPageSections(root) : []);

    loadContentData();
    probeBackendHealth();
  }, [enabled, isAdmin, loadContentData, probeBackendHealth]);

  const updateOverlays = useCallback(() => {
    if (!enabled || !isAdmin || !rootRef.current) {
      setSectionOverlays([]);
      return;
    }
    const items: VisualSectionOverlayItem[] = [];

    sections.forEach((sec) => {
      const el = locate(sec.index);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;

      const blockIdx = sec.index < blocks.length ? sec.index : undefined;
      const bType = blockIdx !== undefined ? blocks[blockIdx]?.type : undefined;

      items.push({
        index: sec.index,
        label: sec.label,
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        bottom: r.bottom,
        right: r.right,
        blockIndex: blockIdx,
        blockType: bType,
      });
    });

    setSectionOverlays(items);
  }, [enabled, isAdmin, sections, blocks, locate]);

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

  function jumpTo(section: PageSection): void {
    const element = locate(section.index);
    if (!element) return;

    setActiveSectionIndex(section.index);

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    element.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center',
    });

    const accent =
      getComputedStyle(document.documentElement).getPropertyValue('--accent-gold').trim() ||
      '#f59e0b';

    element.animate(
      [
        { boxShadow: `0 0 0 0 ${accent}` },
        { boxShadow: `0 0 0 4px ${accent}` },
        { boxShadow: `0 0 0 0 ${accent}` },
      ],
      { duration: reduceMotion ? HIGHLIGHT_MS / 3 : HIGHLIGHT_MS, easing: 'ease-out' }
    );
    located.set(String(section.index), element);
  }

  if (!enabled || !isAdmin) return null;

  // --- CRUD Operations connected to Supabase Backend ---

  const handlePersistBlocks = async (newBlocks: Block[], successMessage = 'Page saved') => {
    if (!contentRow) return;
    setSavingBackend(true);
    const newBody = serializeBlocks(newBlocks);

    try {
      const res = await saveContent({
        id: contentRow.id,
        title: contentRow.title,
        slug: contentRow.slug,
        excerpt: contentRow.excerpt,
        type: (contentRow.type as 'page' | 'post') || 'page',
        status: (contentRow.status === 'publish' ? 'publish' : 'draft') as 'publish' | 'draft',
        body: newBody,
        featuredImage: contentRow.featured_image,
        expectedUpdatedAt: contentRow.updated_at ?? undefined,
        metadata: contentRow.metadata ?? {},
      });

      if (res.success) {
        toast.success(successMessage);
        setContentRow((prev) =>
          prev ? { ...prev, body: newBody, updated_at: res.data?.updatedAt } : null
        );
        setBlocks(newBlocks);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to save changes to backend');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error syncing with backend');
    } finally {
      setSavingBackend(false);
    }
  };

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

  const handleOpenEditSection = (index: number) => {
    const targetBlock = blocks[index] || {
      id: String(Date.now()),
      type: 'paragraph',
      html: '',
    };
    setEditingBlockIndex(index);
    setEditingBlock({ ...targetBlock });
    setIsSectionModalOpen(true);
  };

  const handleAddNewSection = (type: Block['type'], insertAfterIndex?: number) => {
    const freshId = String(Date.now());
    let freshBlock: Block;
    switch (type) {
      case 'heading':
        freshBlock = { id: freshId, type: 'heading', level: 2, html: 'New Section Heading' };
        break;
      case 'paragraph':
        freshBlock = { id: freshId, type: 'paragraph', html: 'Add section copy here...' };
        break;
      case 'bulletList':
        freshBlock = { id: freshId, type: 'bulletList', items: ['Action item 1', 'Action item 2'] };
        break;
      case 'orderedList':
        freshBlock = { id: freshId, type: 'orderedList', items: ['Step 1', 'Step 2'] };
        break;
      case 'callout':
        freshBlock = { id: freshId, type: 'callout', tone: 'info', html: 'Important action note.' };
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
        freshBlock = { id: freshId, type: 'button', label: 'Take Action', href: '/donate' };
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

    const nextBlocks = [...blocks];
    let newIndex: number;
    if (
      insertAfterIndex !== undefined &&
      insertAfterIndex >= 0 &&
      insertAfterIndex < nextBlocks.length
    ) {
      nextBlocks.splice(insertAfterIndex + 1, 0, freshBlock);
      newIndex = insertAfterIndex + 1;
    } else {
      nextBlocks.push(freshBlock);
      newIndex = nextBlocks.length - 1;
    }
    setBlocks(nextBlocks);
    setEditingBlockIndex(newIndex);
    setEditingBlock(freshBlock);
    setIsSectionModalOpen(true);
  };

  const handleSaveSectionModal = async () => {
    if (!editingBlock || editingBlockIndex === null) return;
    const nextBlocks = [...blocks];
    nextBlocks[editingBlockIndex] = editingBlock;
    setIsSectionModalOpen(false);
    await handlePersistBlocks(nextBlocks, 'Section updated');
  };

  const handleDeleteSection = async (index: number) => {
    const nextBlocks = blocks.filter((_, i) => i !== index);
    setBlocks(nextBlocks);
    await handlePersistBlocks(nextBlocks, 'Section deleted');
  };

  const handleMoveSection = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const nextBlocks = [...blocks];
    const temp = nextBlocks[index];
    nextBlocks[index] = nextBlocks[targetIdx];
    nextBlocks[targetIdx] = temp;
    setBlocks(nextBlocks);
    await handlePersistBlocks(nextBlocks, 'Section order updated');
  };

  const handleSavePageSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentRow) return;
    setSavingBackend(true);
    try {
      const res = await saveContent({
        id: contentRow.id,
        title: pageTitle,
        slug: pageSlug,
        excerpt: contentRow.excerpt,
        type: (contentRow.type as 'page' | 'post') || 'page',
        status: pageStatus,
        body: contentRow.body || '',
        featuredImage: pageFeaturedImage || null,
        expectedUpdatedAt: contentRow.updated_at ?? undefined,
        metadata: contentRow.metadata ?? {},
      });

      if (res.success) {
        toast.success('Page settings saved to backend');
        setContentRow((prev) =>
          prev
            ? {
                ...prev,
                title: pageTitle,
                slug: pageSlug,
                featured_image: pageFeaturedImage || null,
                status: pageStatus,
                updated_at: res.data?.updatedAt,
              }
            : null
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

  return (
    <>
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
                  activeSectionIndex === item.index
                    ? 'border-2 border-accent-gold ring-4 ring-accent-gold/20 bg-accent-gold/5 shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                    : showAllSectionBorders
                      ? 'border border-dashed border-accent-gold/30'
                      : 'border border-transparent'
                }`}
              />

              {/* Floating Action Pill */}
              <div
                role="toolbar"
                aria-label={`Actions for section ${item.index + 1}`}
                className="pointer-events-auto absolute -top-3.5 left-3 sm:left-6 inline-flex items-center gap-1.5 rounded-full border border-accent-gold/50 bg-secondary/95 px-3 py-1 text-xs text-ink-on-dark shadow-float backdrop-blur-md transition-all hover:scale-105"
              >
                <span className="size-2 rounded-full bg-accent-gold animate-pulse" />
                <span className="font-black text-accent-gold uppercase text-[10px] tracking-wider">
                  Section #{item.index + 1}
                </span>
                <span className="max-w-[120px] sm:max-w-[180px] truncate font-semibold text-white text-[11px]">
                  {item.label}
                </span>
                {item.blockType && (
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-accent-gold font-mono">
                    {item.blockType}
                  </span>
                )}

                <div className="ml-1.5 flex items-center gap-0.5 border-l border-white/20 pl-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSectionIndex(item.index);
                      if (item.blockIndex !== undefined && item.blockIndex < blocks.length) {
                        handleOpenEditSection(item.blockIndex);
                      } else {
                        jumpTo({ index: item.index, label: item.label });
                      }
                    }}
                    title="Edit section content"
                    className="rounded p-1 text-accent-gold hover:bg-white/15 hover:text-white transition-colors"
                  >
                    <PenLine size={13} />
                  </button>
                  {item.blockIndex !== undefined && item.blockIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (item.blockIndex !== undefined) {
                          handleMoveSection(item.blockIndex, 'up');
                        }
                      }}
                      title="Move section up"
                      className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
                    >
                      <ArrowUp size={13} />
                    </button>
                  )}
                  {item.blockIndex !== undefined && item.blockIndex < blocks.length - 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (item.blockIndex !== undefined) {
                          handleMoveSection(item.blockIndex, 'down');
                        }
                      }}
                      title="Move section down"
                      className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
                    >
                      <ArrowDown size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddNewSection('paragraph', item.blockIndex ?? item.index)}
                    title="Add block below"
                    className="rounded p-1 text-emerald-400 hover:bg-white/15 hover:text-emerald-300 transition-colors"
                  >
                    <Plus size={13} />
                  </button>
                  {item.blockIndex !== undefined && (
                    <button
                      type="button"
                      onClick={() => {
                        if (item.blockIndex !== undefined) {
                          handleDeleteSection(item.blockIndex);
                        }
                      }}
                      title="Delete section"
                      className="rounded p-1 text-rose-400 hover:bg-white/15 hover:text-rose-300 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
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
          {/* Page Info & Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="size-2.5 rounded-full bg-accent-gold animate-pulse" />
              <PenLine size={16} className="text-accent-gold" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.15em] text-white truncate max-w-[200px] sm:max-w-[280px]">
                  {contentRow?.title || target?.label || pathname}
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
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-white/10 text-ink-muted-on-dark">
                    Static Page
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-muted-on-dark truncate">
                {sections.length} {sections.length === 1 ? 'section' : 'sections'} on page
                {contentRow ? ` · ${blocks.length} blocks` : ''}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {!contentRow && (
              <button
                type="button"
                onClick={handleInitializeCMSPage}
                disabled={savingBackend}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-secondary shadow-raised hover:bg-accent-gold transition-all"
              >
                <Sparkles size={13} />
                <span>Connect Page to Supabase CMS</span>
              </button>
            )}

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
                  aria-label="Jump to section"
                  onChange={(e) => {
                    const idx = Number.parseInt(e.target.value, 10);
                    const sec = sections.find((s) => s.index === idx);
                    if (sec) jumpTo(sec);
                  }}
                  className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  defaultValue=""
                >
                  <option value="" disabled className="bg-secondary text-ink-on-dark">
                    Jump to section…
                  </option>
                  {sections.map((sec) => (
                    <option
                      key={sec.index}
                      value={sec.index}
                      className="bg-secondary text-ink-on-dark"
                    >
                      {sec.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Add Section Menu */}
            {contentRow && (
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
            )}

            {/* Page Settings */}
            {contentRow && (
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                title="Edit page title, slug, and featured image"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
              >
                <Settings size={14} />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}

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
                <span className="size-2 rounded-full bg-emerald-400" />
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
        {contentRow && blocks.length > 0 && (
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
          <DialogContent className="max-w-2xl bg-white text-secondary p-6 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-secondary">
                Edit Section #{editingBlockIndex !== null ? editingBlockIndex + 1 : ''} (
                {editingBlock.type})
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Update section content, styles, and media. Changes persist directly to the Supabase
                backend.
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
                    Paragraph Content (HTML supported)
                  </label>
                  <textarea
                    id={paragraphContentId}
                    rows={4}
                    value={editingBlock.html}
                    onChange={(e) => setEditingBlock({ ...editingBlock, html: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-primary"
                  />
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editingBlock.src}
                        alt={editingBlock.alt || ''}
                        className="h-full w-full object-contain"
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

              {/* Button Fields */}
              {editingBlock.type === 'button' && (
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
                      onChange={(e) => setEditingBlock({ ...editingBlock, label: e.target.value })}
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
                <input
                  id={slugId}
                  type="text"
                  value={pageSlug}
                  onChange={(e) => setPageSlug(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                />
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pageFeaturedImage}
                    alt="Hero preview"
                    className="h-full w-full object-cover"
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
    </>
  );
}
