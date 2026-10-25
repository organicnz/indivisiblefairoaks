'use client';

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  Heading,
  Image as ImageIcon,
  List as ListIcon,
  Loader2,
  Minus,
  Monitor,
  PenTool,
  Plus,
  Quote as QuoteIcon,
  Redo2,
  Share2,
  Smartphone,
  Tablet,
  Trash2,
  Type,
  Undo2,
  UploadCloud,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { uploadCRMMedia } from '@/lib/actions/crm';
import { CRMMediaLibraryModal } from './CRMMediaLibraryModal';
import type { CalloutBlock, ComposerBlock, ImageBlock, ListBlock, SocialPlatform } from './types';

interface Props {
  blocks: ComposerBlock[];
  onChange: (blocks: ComposerBlock[]) => void;
}

function genId(): string {
  return `b_${Math.random().toString(36).slice(2, 9)}`;
}

const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{last_name}}', label: 'Last Name' },
  { tag: '{{district}}', label: 'Congressional District' },
  { tag: '{{city}}', label: 'City / Neighborhood' },
  { tag: '{{email}}', label: 'Email Address' },
];

export function VisualComposerCanvas({ blocks, onChange }: Props) {
  // Undo/Redo state management
  const [history, setHistory] = useState<ComposerBlock[][]>([blocks]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isInternalUpdate = useRef(false);

  // Per-block display mode: which blocks are rendered in live visual preview vs form view
  const [previewBlockIds, setPreviewBlockIds] = useState<Set<string>>(new Set());
  // Collapsed block state for birds-eye view
  const [collapsedBlockIds, setCollapsedBlockIds] = useState<Set<string>>(new Set());
  // Token picker dropdown state per block
  const [activeTokenBlockId, setActiveTokenBlockId] = useState<string | null>(null);

  // Canvas viewport simulation: Full width, Standard email 600px, Mobile 375px
  const [canvasViewport, setCanvasViewport] = useState<'full' | 'standard' | 'mobile'>('full');

  // Realtime word count and reading time across composer blocks
  const readingStats = useMemo(() => {
    let words = 0;
    for (const b of blocks) {
      if (b.type === 'header') {
        words += (b.heading || '').trim().split(/\s+/).filter(Boolean).length;
        if (b.eyebrow) words += b.eyebrow.trim().split(/\s+/).filter(Boolean).length;
      } else if (b.type === 'text') {
        words += (b.content || '').trim().split(/\s+/).filter(Boolean).length;
      } else if (b.type === 'quote') {
        words += (b.quote || '').trim().split(/\s+/).filter(Boolean).length;
      } else if (b.type === 'callout') {
        words += (b.text || '').trim().split(/\s+/).filter(Boolean).length;
        if (b.title) words += b.title.trim().split(/\s+/).filter(Boolean).length;
      } else if (b.type === 'list') {
        words += (b.items || []).join(' ').trim().split(/\s+/).filter(Boolean).length;
      }
    }
    const readingMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, readingMinutes };
  }, [blocks]);

  // Supabase Media Library Modal state
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaTargetBlockId, setMediaTargetBlockId] = useState<string | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);

  // Commit changes to parent and push to undo/redo history
  const commitChange = useCallback(
    (nextBlocks: ComposerBlock[]) => {
      isInternalUpdate.current = true;
      onChange(nextBlocks);
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, nextBlocks];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex, onChange]
  );

  // Synchronize history when external blocks change (e.g. from template or load draft)
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    setHistory([blocks]);
    setHistoryIndex(0);
  }, [blocks]);

  // Undo / Redo handlers
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const targetIndex = historyIndex - 1;
    const prevBlocks = history[targetIndex];
    if (prevBlocks) {
      isInternalUpdate.current = true;
      setHistoryIndex(targetIndex);
      onChange(prevBlocks);
    }
  }, [canUndo, historyIndex, history, onChange]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const targetIndex = historyIndex + 1;
    const nextBlocks = history[targetIndex];
    if (nextBlocks) {
      isInternalUpdate.current = true;
      setHistoryIndex(targetIndex);
      onChange(nextBlocks);
    }
  }, [canRedo, historyIndex, history, onChange]);

  // Keyboard shortcut for Undo / Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const updateBlock = (id: string, updates: Partial<ComposerBlock>) => {
    commitChange(blocks.map((b) => (b.id === id ? ({ ...b, ...updates } as ComposerBlock) : b)));
  };

  const removeBlock = (id: string) => {
    if (blocks.length <= 1) {
      commitChange([{ id: genId(), type: 'text', content: '' }]);
      return;
    }
    commitChange(blocks.filter((b) => b.id !== id));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const next = [...blocks];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    commitChange(next);
  };

  const duplicateBlock = (index: number) => {
    const target = blocks[index];
    const clone: ComposerBlock = {
      ...JSON.parse(JSON.stringify(target)),
      id: genId(),
    };
    const next = [...blocks];
    next.splice(index + 1, 0, clone);
    commitChange(next);
  };

  const addBlock = (type: ComposerBlock['type'], initialData?: Partial<ComposerBlock>) => {
    let newBlock: ComposerBlock;
    switch (type) {
      case 'header':
        newBlock = {
          id: genId(),
          type: 'header',
          eyebrow: 'ACTION ALERT',
          heading: 'New Campaign Headline',
          level: 1,
        };
        break;
      case 'text':
        newBlock = { id: genId(), type: 'text', content: '' };
        break;
      case 'image':
        // No stock URL. A new image block starts empty and the editor leads
        // with Browse Storage / Upload New, so every image that reaches a
        // broadcast comes from the chapter's own Supabase bucket or an
        // explicitly pasted URL — never a hardcoded external file that can
        // rot, track, or change under a sent campaign. The send path refuses
        // an unsent empty block by position (see `findEmptyImageBlock` in the
        // composer); drafts may hold one, and the parser round-trips it.
        newBlock = {
          id: genId(),
          type: 'image',
          url: '',
          alt: '',
          alignment: 'center',
        };
        break;
      case 'quote':
        newBlock = {
          id: genId(),
          type: 'quote',
          quote: 'Democracy is not a spectator sport. It requires all of us.',
          author: 'Fair Oaks Neighbor',
          role: 'Precinct Organizer',
        };
        break;
      case 'stat':
        newBlock = {
          id: genId(),
          type: 'stat',
          value: '1,500+',
          label: 'Voters Mobilized',
          description: 'Across Carmichael and Fair Oaks in 2026',
          variant: 'primary',
        };
        break;
      case 'list':
        newBlock = {
          id: genId(),
          type: 'list',
          style: 'bullet',
          items: [
            'Arrive at Carmichael Park pavilion by 9:45 AM',
            'Bring a refillable water bottle and comfortable shoes',
            'Pick up your precinct packet and voter guides at the welcome table',
          ],
        };
        break;
      case 'social':
        newBlock = {
          id: genId(),
          type: 'social',
          heading: 'Connect & Mobilize',
          channels: [
            {
              platform: 'website',
              url: 'https://indivisiblefairoaks.org',
              label: 'Official Website',
            },
            {
              platform: 'actblue',
              url: 'https://indivisiblefairoaks.org/donate',
              label: 'Support Chapter',
            },
          ],
        };
        break;
      case 'callout':
        newBlock = {
          id: genId(),
          type: 'callout',
          variant: 'info',
          title: 'Important Update',
          text: 'Details for your organizers and volunteers.',
        };
        break;
      case 'button':
        newBlock = {
          id: genId(),
          type: 'button',
          label: 'RSVP / Take Action',
          url: 'https://indivisiblefairoaks.org',
          variant: 'primary',
        };
        break;
      case 'event':
        newBlock = {
          id: genId(),
          type: 'event',
          title: 'Chapter Meeting',
          date: 'Saturday, 10:00 AM',
          location: 'Carmichael Park',
          rsvpUrl: '',
        };
        break;
      case 'divider':
        newBlock = { id: genId(), type: 'divider' };
        break;
      case 'signoff':
        newBlock = {
          id: genId(),
          type: 'signoff',
          closing: 'In solidarity,',
          sender: 'Indivisible Fair Oaks Organizing Team',
        };
        break;
    }
    if (initialData) {
      newBlock = { ...newBlock, ...initialData } as ComposerBlock;
    }
    commitChange([...blocks, newBlock]);
  };

  // Convert/morph block type
  const morphBlockType = (block: ComposerBlock, newType: ComposerBlock['type']) => {
    if (block.type === newType) return;
    let converted: ComposerBlock;

    const baseText =
      'content' in block
        ? block.content
        : 'heading' in block
          ? block.heading
          : 'text' in block
            ? block.text
            : 'quote' in block
              ? block.quote
              : '';

    switch (newType) {
      case 'header':
        converted = {
          id: block.id,
          type: 'header',
          heading: baseText || 'Headline',
          level: 1,
        };
        break;
      case 'text':
        converted = {
          id: block.id,
          type: 'text',
          content: baseText || '',
        };
        break;
      case 'callout':
        converted = {
          id: block.id,
          type: 'callout',
          variant: 'info',
          title: 'Note',
          text: baseText || 'Callout text',
        };
        break;
      case 'quote':
        converted = {
          id: block.id,
          type: 'quote',
          quote: baseText || 'Inspiring activist quote',
          author: 'Community Organizer',
        };
        break;
      default:
        return;
    }
    commitChange(blocks.map((b) => (b.id === block.id ? converted : b)));
  };

  const toggleBlockPreview = (id: string) => {
    setPreviewBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPreviews = () => {
    if (previewBlockIds.size === blocks.length) {
      setPreviewBlockIds(new Set());
    } else {
      setPreviewBlockIds(new Set(blocks.map((b) => b.id)));
    }
  };

  const toggleBlockCollapse = (id: string) => {
    setCollapsedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllCollapse = () => {
    if (collapsedBlockIds.size === blocks.length) {
      setCollapsedBlockIds(new Set());
    } else {
      setCollapsedBlockIds(new Set(blocks.map((b) => b.id)));
    }
  };

  const insertTokenIntoBlock = (blockId: string, token: string) => {
    commitChange(
      blocks.map((b) => {
        if (b.id !== blockId) return b;
        if (b.type === 'text') return { ...b, content: `${b.content} ${token} ` };
        if (b.type === 'header') return { ...b, heading: `${b.heading} ${token} ` };
        if (b.type === 'callout') return { ...b, text: `${b.text} ${token} ` };
        if (b.type === 'quote') return { ...b, quote: `${b.quote} ${token} ` };
        if (b.type === 'button') return { ...b, label: `${b.label} ${token}` };
        return b;
      })
    );
    setActiveTokenBlockId(null);
  };

  const openMediaLibraryForBlock = (blockId: string) => {
    setMediaTargetBlockId(blockId);
    setMediaModalOpen(true);
  };

  const openMediaLibraryGlobal = () => {
    setMediaTargetBlockId(null);
    setMediaModalOpen(true);
  };

  const handleSelectMedia = (media: { url: string; alt?: string; name: string }) => {
    if (mediaTargetBlockId) {
      updateBlock(mediaTargetBlockId, {
        url: media.url,
        alt: media.alt || media.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      });
      toast.success('Media applied to block');
    } else {
      addBlock('image', {
        url: media.url,
        alt: media.alt || media.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
        alignment: 'center',
      });
      toast.success('Image block created from Supabase Storage');
    }
    setMediaModalOpen(false);
    setMediaTargetBlockId(null);
  };

  const handleQuickUploadForBlock = async (
    blockId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or smaller');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setUploadingBlockId(blockId);
    try {
      const res = await uploadCRMMedia(formData);
      if (res.success && res.data) {
        toast.success(`Uploaded ${res.data.name} to Supabase S3 storage`);
        updateBlock(blockId, {
          url: res.data.url,
          alt: res.data.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
        });
      } else {
        toast.error(res.error || 'Upload failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingBlockId(null);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Composer Control Toolbar: Undo/Redo & View Mode Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 bg-surface-muted border border-border rounded-2xl">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
            aria-label="Undo block edit"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-foreground hover:bg-surface-card hover:shadow-2xs disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <Undo2 size={13} />
            <span>Undo</span>
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Cmd+Shift+Z)"
            aria-label="Redo block edit"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-foreground hover:bg-surface-card hover:shadow-2xs disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <Redo2 size={13} />
            <span>Redo</span>
          </button>
          <span className="text-[11px] font-mono text-muted-foreground pl-1">
            {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground bg-surface-card px-2 py-0.5 rounded-md border border-border">
            {readingStats.words}w · ~{readingStats.readingMinutes}m read
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Email Viewport Simulation Frame Switcher */}
          <fieldset className="inline-flex items-center rounded-lg border border-border bg-surface-card p-0.5 shadow-2xs">
            <legend className="sr-only">Canvas preview framing</legend>
            <button
              type="button"
              onClick={() => setCanvasViewport('full')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                canvasViewport === 'full'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Full width layout"
              aria-label="Full width canvas"
            >
              <Monitor size={12} />
              <span className="hidden sm:inline">100%</span>
            </button>
            <button
              type="button"
              onClick={() => setCanvasViewport('standard')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                canvasViewport === 'standard'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Standard email width (600px)"
              aria-label="Standard email canvas"
            >
              <Tablet size={12} />
              <span className="hidden sm:inline">600px</span>
            </button>
            <button
              type="button"
              onClick={() => setCanvasViewport('mobile')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                canvasViewport === 'mobile'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Mobile phone email width (375px)"
              aria-label="Mobile phone canvas"
            >
              <Smartphone size={12} />
              <span className="hidden sm:inline">375px</span>
            </button>
          </fieldset>

          <button
            type="button"
            onClick={openMediaLibraryGlobal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-foreground bg-surface-card border border-border hover:bg-surface-muted transition-colors shadow-2xs"
            title="Browse Supabase S3 Media Library"
            aria-label="Browse Supabase S3 Media Library"
          >
            <FolderOpen size={13} className="text-primary dark:text-primary-on-dark" />
            <span className="hidden md:inline">Supabase Media</span>
          </button>
          <button
            type="button"
            onClick={toggleAllPreviews}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-muted-foreground bg-surface-card border border-border hover:bg-surface-muted transition-colors shadow-2xs"
          >
            {previewBlockIds.size === blocks.length ? (
              <>
                <EyeOff size={13} className="text-muted-foreground" />
                <span className="hidden sm:inline">Form View All</span>
              </>
            ) : (
              <>
                <Eye size={13} className="text-primary dark:text-primary-on-dark" />
                <span className="hidden sm:inline">Live Preview All</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={toggleAllCollapse}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-muted-foreground bg-surface-card border border-border hover:bg-surface-muted transition-colors shadow-2xs"
          >
            {collapsedBlockIds.size === blocks.length ? (
              <>
                <ChevronDown size={13} />
                <span className="hidden sm:inline">Expand All</span>
              </>
            ) : (
              <>
                <ChevronUp size={13} />
                <span className="hidden sm:inline">Collapse All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Visual Canvas Block List with responsive email simulation frame */}
      <div
        className={`transition-all duration-300 mx-auto ${
          canvasViewport === 'mobile'
            ? 'max-w-[375px] rounded-3xl border-2 border-border/80 shadow-hero p-3 bg-surface-card'
            : canvasViewport === 'standard'
              ? 'max-w-[600px] rounded-2xl border border-border shadow-card p-4 bg-surface-card'
              : 'w-full'
        }`}
      >
        <div className="space-y-3">
          {blocks.map((block, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === blocks.length - 1;
            const isPreviewing = previewBlockIds.has(block.id);
            const isCollapsed = collapsedBlockIds.has(block.id);

            return (
              <div
                key={block.id}
                className="group relative rounded-2xl border border-border bg-surface-card p-4 shadow-2xs transition-all hover:border-border hover:shadow-xs"
              >
                {/* Block Header & Action Controls */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-surface-muted text-muted-foreground">
                      {block.type === 'header' && (
                        <Heading size={12} className="text-primary dark:text-primary-on-dark" />
                      )}
                      {block.type === 'text' && (
                        <Type size={12} className="text-muted-foreground" />
                      )}
                      {block.type === 'image' && <ImageIcon size={12} className="text-cyan-600" />}
                      {block.type === 'quote' && <QuoteIcon size={12} className="text-amber-600" />}
                      {block.type === 'stat' && (
                        <BarChart3 size={12} className="text-emerald-600" />
                      )}
                      {block.type === 'list' && <ListIcon size={12} className="text-indigo-600" />}
                      {block.type === 'social' && <Share2 size={12} className="text-blue-600" />}
                      {block.type === 'callout' && (
                        <AlertCircle size={12} className="text-amber-500" />
                      )}
                      {block.type === 'button' && (
                        <ExternalLink size={12} className="text-blue-500" />
                      )}
                      {block.type === 'event' && <Calendar size={12} className="text-purple-500" />}
                      {block.type === 'divider' && (
                        <Minus size={12} className="text-muted-foreground" />
                      )}
                      {block.type === 'signoff' && (
                        <PenTool size={12} className="text-emerald-500" />
                      )}
                      {block.type}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground">#{idx + 1}</span>

                    {/* Morph Block dropdown for compatible text-like blocks */}
                    {['text', 'header', 'callout', 'quote'].includes(block.type) && (
                      <select
                        value={block.type}
                        onChange={(e) =>
                          morphBlockType(block, e.target.value as ComposerBlock['type'])
                        }
                        title="Convert block type"
                        className="text-[10px] font-bold text-muted-foreground bg-transparent border-none py-0 pl-1 pr-4 focus:ring-0 cursor-pointer hover:text-foreground"
                      >
                        <option value="text">as Text</option>
                        <option value="header">as Header</option>
                        <option value="callout">as Callout</option>
                        <option value="quote">as Quote</option>
                      </select>
                    )}
                  </div>

                  {/* Toolbar: Preview toggle, Reorder, Duplicate, Collapse, Delete */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => toggleBlockPreview(block.id)}
                      title={isPreviewing ? 'Show edit form' : 'Live visual preview'}
                      aria-label={`Toggle preview for block ${idx + 1}`}
                      className={`p-1 rounded transition-colors ${
                        isPreviewing
                          ? 'text-primary dark:text-primary-on-dark bg-primary/10 hover:bg-primary/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-surface-muted'
                      }`}
                    >
                      {isPreviewing ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlock(idx, 'up')}
                      disabled={isFirst}
                      title="Move up"
                      aria-label={`Move block ${idx + 1} up`}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-20"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlock(idx, 'down')}
                      disabled={isLast}
                      title="Move down"
                      aria-label={`Move block ${idx + 1} down`}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-20"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateBlock(idx)}
                      title="Duplicate block"
                      aria-label={`Duplicate block ${idx + 1}`}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-muted"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleBlockCollapse(block.id)}
                      title={isCollapsed ? 'Expand block' : 'Collapse block'}
                      aria-label={`Collapse block ${idx + 1}`}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-muted"
                    >
                      {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      title="Delete block"
                      aria-label={`Delete block ${idx + 1}`}
                      className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Block Content Rendering: Live Visual Preview vs Form */}
                {!isCollapsed &&
                  (isPreviewing ? (
                    <div className="py-2 px-1">
                      {/* Live Block Renderers */}
                      {block.type === 'header' && (
                        <div className="space-y-1">
                          {block.eyebrow && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-primary/10 text-primary dark:text-primary-on-dark">
                              {block.eyebrow}
                            </span>
                          )}
                          {block.level === 2 ? (
                            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">
                              {block.heading || '(Empty headline)'}
                            </h2>
                          ) : (
                            <h1 className="text-xl font-black text-foreground uppercase tracking-tight">
                              {block.heading || '(Empty headline)'}
                            </h1>
                          )}
                        </div>
                      )}

                      {block.type === 'text' && (
                        <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                          {block.content || '(Empty text block)'}
                        </div>
                      )}

                      {block.type === 'image' && (
                        <div
                          className={`space-y-1.5 ${
                            block.alignment === 'center'
                              ? 'text-center'
                              : block.alignment === 'right'
                                ? 'text-right'
                                : 'text-left'
                          }`}
                        >
                          {block.url ? (
                            // biome-ignore lint/performance/noImgElement: user-supplied external campaign banner in visual composer preview
                            <img
                              src={block.url}
                              alt={block.alt || 'Campaign banner'}
                              className="max-h-64 rounded-xl object-cover inline-block border border-border"
                            />
                          ) : (
                            <div className="h-32 bg-surface-muted rounded-xl flex items-center justify-center text-muted-foreground text-xs">
                              No image URL provided
                            </div>
                          )}
                          {block.caption && (
                            <p className="text-[11px] text-muted-foreground italic">
                              {block.caption}
                            </p>
                          )}
                        </div>
                      )}

                      {block.type === 'quote' && (
                        <div className="p-4 rounded-xl border-l-4 border-amber-500 bg-amber-50/50 space-y-1">
                          <p className="text-xs font-medium text-foreground italic">
                            “{block.quote || 'Quote text'}”
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground">
                            — {block.author}
                            {block.role ? `, ${block.role}` : ''}
                          </p>
                        </div>
                      )}

                      {block.type === 'stat' && (
                        <div className="p-4 rounded-xl border border-border bg-surface-muted text-center space-y-1">
                          <div className="text-2xl font-black text-primary dark:text-primary-on-dark tracking-tight">
                            {block.value || '0'}
                          </div>
                          <div className="text-xs font-black uppercase text-foreground">
                            {block.label || 'Metric Label'}
                          </div>
                          {block.description && (
                            <div className="text-[11px] text-muted-foreground">
                              {block.description}
                            </div>
                          )}
                        </div>
                      )}

                      {block.type === 'list' && (
                        <div className="space-y-1">
                          {block.items.map((item, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: ephemeral list items without database IDs
                            <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                              <span className="font-bold text-primary dark:text-primary-on-dark">
                                {block.style === 'numbered' ? `${i + 1}.` : '•'}
                              </span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {block.type === 'social' && (
                        <div className="p-3 rounded-xl border border-border bg-surface-muted text-center space-y-2">
                          {block.heading && (
                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                              {block.heading}
                            </p>
                          )}
                          <div className="flex flex-wrap justify-center gap-2">
                            {block.channels.map((ch, i) => (
                              <span
                                // biome-ignore lint/suspicious/noArrayIndexKey: ephemeral social link items
                                key={i}
                                className="px-2.5 py-1 rounded-full bg-surface-card border border-border text-[11px] font-bold text-foreground shadow-2xs"
                              >
                                {ch.label || ch.platform}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {block.type === 'callout' && (
                        <div
                          className={`p-3.5 rounded-xl border ${
                            block.variant === 'alert'
                              ? 'bg-rose-50 border-rose-200 text-rose-900'
                              : block.variant === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-blue-50 border-blue-200 text-blue-900'
                          }`}
                        >
                          {block.title && (
                            <h4 className="text-xs font-bold uppercase tracking-wider mb-1">
                              {block.title}
                            </h4>
                          )}
                          <p className="text-xs leading-relaxed whitespace-pre-wrap">
                            {block.text}
                          </p>
                        </div>
                      )}

                      {block.type === 'button' && (
                        <div className="py-2 text-center">
                          <span
                            className={`inline-block px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm ${
                              block.variant === 'accent'
                                ? 'bg-amber-600 text-white'
                                : block.variant === 'outline'
                                  ? 'border border-primary text-primary dark:text-primary-on-dark bg-surface-card'
                                  : 'bg-primary text-white'
                            }`}
                          >
                            {block.label || 'Action'}
                          </span>
                        </div>
                      )}

                      {block.type === 'event' && (
                        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/60 space-y-1">
                          <div className="text-xs font-black uppercase text-purple-900">
                            📅 {block.title || 'Event Title'}
                          </div>
                          <div className="text-[11px] text-purple-700 font-bold">
                            When: {block.date} {block.time && `· ${block.time}`}
                          </div>
                          <div className="text-[11px] text-purple-700">Where: {block.location}</div>
                        </div>
                      )}

                      {block.type === 'divider' && (
                        <div className="py-2">
                          <hr className="border-border" />
                        </div>
                      )}

                      {block.type === 'signoff' && (
                        <div className="text-xs text-foreground space-y-0.5">
                          <p className="italic">{block.closing}</p>
                          <p className="font-bold">{block.sender}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Form Input Mode for Block Editing */
                    <div className="space-y-3">
                      {/* HEADER BLOCK */}
                      {block.type === 'header' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <label className="sm:col-span-3 block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Eyebrow Badge (Optional)</span>
                              <input
                                type="text"
                                value={block.eyebrow || ''}
                                onChange={(e) => updateBlock(block.id, { eyebrow: e.target.value })}
                                placeholder="e.g. RALLY ALERT or BREAKING"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Hierarchy</span>
                              <select
                                value={block.level || 1}
                                onChange={(e) =>
                                  updateBlock(block.id, { level: Number(e.target.value) as 1 | 2 })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              >
                                <option value={1}>H1 (Main Title)</option>
                                <option value={2}>H2 (Section Header)</option>
                              </select>
                            </label>
                          </div>
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Headline Text</span>
                            <input
                              type="text"
                              value={block.heading}
                              onChange={(e) => updateBlock(block.id, { heading: e.target.value })}
                              placeholder="e.g. Stand Up for Democracy in Fair Oaks"
                              className="w-full px-3 py-2 rounded-xl border border-border text-sm font-black text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            />
                          </label>
                        </div>
                      )}

                      {/* TEXT BLOCK */}
                      {block.type === 'text' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="block text-[10px] font-black uppercase text-muted-foreground">
                              Message Content (Plain Text / Markdown)
                            </span>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveTokenBlockId(
                                    activeTokenBlockId === block.id ? null : block.id
                                  )
                                }
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-muted hover:bg-surface-muted text-foreground flex items-center gap-1"
                              >
                                <span>+ Insert Tag</span>
                                <ChevronDown size={11} />
                              </button>
                              {activeTokenBlockId === block.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-surface-card border border-border shadow-lg p-1.5 z-20 space-y-0.5">
                                  {MERGE_TAGS.map((t) => (
                                    <button
                                      key={t.tag}
                                      type="button"
                                      onClick={() => insertTokenIntoBlock(block.id, t.tag)}
                                      className="w-full text-left px-2 py-1 rounded text-[11px] hover:bg-surface-muted font-medium text-foreground flex items-center justify-between"
                                    >
                                      <span>{t.label}</span>
                                      <code className="text-[9px] font-mono text-muted-foreground">
                                        {t.tag}
                                      </code>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <textarea
                            rows={4}
                            value={block.content}
                            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                            placeholder="Type message narrative, bullet points, or updates..."
                            aria-label="Message Content"
                            className="w-full px-3 py-2 rounded-xl border border-border text-xs text-foreground leading-relaxed font-sans placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          />
                        </div>
                      )}

                      {/* IMAGE BLOCK */}
                      {block.type === 'image' && (
                        <div className="space-y-3">
                          {/* Supabase Storage Controls */}
                          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-muted border border-border">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                                <ImageIcon
                                  size={14}
                                  className="text-primary dark:text-primary-on-dark"
                                />
                                <span>Supabase S3 Media</span>
                              </span>
                              {block.url?.includes('/storage/v1/object/public/media/') && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                                  ✓ Hosted in Storage
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openMediaLibraryForBlock(block.id)}
                                className="px-2.5 py-1 rounded-lg bg-surface-card border border-border hover:bg-surface-muted text-foreground text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                              >
                                <FolderOpen
                                  size={13}
                                  className="text-primary dark:text-primary-on-dark"
                                />
                                <span>Browse Storage</span>
                              </button>
                              <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs">
                                {uploadingBlockId === block.id ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin" />
                                    <span>Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <UploadCloud size={13} />
                                    <span>Upload New</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  onChange={(e) => handleQuickUploadForBlock(block.id, e)}
                                  disabled={uploadingBlockId === block.id}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>

                          {/* Image preview thumbnail inside form if url is set */}
                          {block.url && (
                            <div className="relative aspect-video max-h-48 rounded-xl border border-border overflow-hidden bg-surface-muted flex items-center justify-center">
                              {/* biome-ignore lint/performance/noImgElement: user-supplied external campaign banner in visual composer preview */}
                              <img
                                src={block.url}
                                alt={block.alt || 'Preview'}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="sm:col-span-2 block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Image URL *</span>
                              <input
                                type="url"
                                value={block.url}
                                onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                                placeholder="https://... or select from Supabase Storage"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Alignment</span>
                              <select
                                value={block.alignment || 'center'}
                                onChange={(e) =>
                                  updateBlock(block.id, {
                                    alignment: e.target.value as ImageBlock['alignment'],
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              >
                                <option value="center">Center</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                                <option value="full">Full Width</option>
                              </select>
                            </label>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Alt Text (Accessibility)</span>
                              <input
                                type="text"
                                value={block.alt}
                                onChange={(e) => updateBlock(block.id, { alt: e.target.value })}
                                placeholder="e.g. Fair Oaks democracy rally attendees"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Click-through Link URL (Optional)</span>
                              <input
                                type="url"
                                value={block.linkUrl || ''}
                                onChange={(e) => updateBlock(block.id, { linkUrl: e.target.value })}
                                placeholder="https://indivisiblefairoaks.org/actions"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                          </div>
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Caption Note (Optional)</span>
                            <input
                              type="text"
                              value={block.caption || ''}
                              onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                              placeholder="Photo credit or brief note..."
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                        </div>
                      )}

                      {/* QUOTE BLOCK */}
                      {block.type === 'quote' && (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Quote Copy *</span>
                            <textarea
                              rows={2}
                              value={block.quote}
                              onChange={(e) => updateBlock(block.id, { quote: e.target.value })}
                              placeholder="Inspiring quote from an organizer, constituent, or speaker..."
                              className="w-full px-3 py-2 rounded-xl border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Author / Speaker *</span>
                              <input
                                type="text"
                                value={block.author}
                                onChange={(e) => updateBlock(block.id, { author: e.target.value })}
                                placeholder="e.g. Maria Gonzalez"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Role / Title (Optional)</span>
                              <input
                                type="text"
                                value={block.role || ''}
                                onChange={(e) => updateBlock(block.id, { role: e.target.value })}
                                placeholder="e.g. Fair Oaks Volunteer Coordinator"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* STAT BLOCK */}
                      {block.type === 'stat' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Stat / Metric *</span>
                              <input
                                type="text"
                                value={block.value}
                                onChange={(e) => updateBlock(block.id, { value: e.target.value })}
                                placeholder="e.g. $12,450 or 850+"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-black text-primary dark:text-primary-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              />
                            </label>
                            <label className="sm:col-span-2 block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Metric Label *</span>
                              <input
                                type="text"
                                value={block.label}
                                onChange={(e) => updateBlock(block.id, { label: e.target.value })}
                                placeholder="e.g. Grassroots Funds Raised or Doors Knocked"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                          </div>
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Context / Explanation (Optional)</span>
                            <input
                              type="text"
                              value={block.description || ''}
                              onChange={(e) =>
                                updateBlock(block.id, { description: e.target.value })
                              }
                              placeholder="e.g. Across Carmichael, Fair Oaks, and Citrus Heights"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                        </div>
                      )}

                      {/* LIST BLOCK */}
                      {block.type === 'list' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-muted-foreground">
                              List Items
                            </span>
                            <select
                              value={block.style}
                              onChange={(e) =>
                                updateBlock(block.id, {
                                  style: e.target.value as ListBlock['style'],
                                })
                              }
                              className="px-2 py-0.5 rounded text-[10px] font-bold border border-border text-foreground"
                            >
                              <option value="bullet">Bullet Points (•)</option>
                              <option value="numbered">Numbered List (1, 2, 3)</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            {block.items.map((item, itemIdx) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: dynamic form inputs without permanent database IDs
                              <div key={itemIdx} className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-muted-foreground w-4 text-right">
                                  {block.style === 'numbered' ? `${itemIdx + 1}.` : '•'}
                                </span>
                                <input
                                  type="text"
                                  value={item}
                                  onChange={(e) => {
                                    const nextItems = [...block.items];
                                    nextItems[itemIdx] = e.target.value;
                                    updateBlock(block.id, { items: nextItems });
                                  }}
                                  placeholder="List item copy..."
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextItems = block.items.filter((_, i) => i !== itemIdx);
                                    updateBlock(block.id, {
                                      items: nextItems.length ? nextItems : [''],
                                    });
                                  }}
                                  className="p-1 text-muted-foreground hover:text-red-600 rounded"
                                  title="Delete item"
                                  aria-label={`Delete list item ${itemIdx + 1}`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateBlock(block.id, { items: [...block.items, ''] })}
                              className="text-[10px] font-bold text-primary dark:text-primary-on-dark hover:underline flex items-center gap-1 mt-1"
                            >
                              <Plus size={11} /> Add another item
                            </button>
                          </div>
                        </div>
                      )}

                      {/* SOCIAL CHANNELS BLOCK */}
                      {block.type === 'social' && (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Section Heading</span>
                            <input
                              type="text"
                              value={block.heading || ''}
                              onChange={(e) => updateBlock(block.id, { heading: e.target.value })}
                              placeholder="e.g. Connect With Our Campaign"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                          <div className="space-y-2">
                            {block.channels.map((ch, chIdx) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: dynamic form inputs without permanent database IDs
                              <div key={chIdx} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <select
                                  value={ch.platform}
                                  onChange={(e) => {
                                    const next = [...block.channels];
                                    next[chIdx] = {
                                      ...ch,
                                      platform: e.target.value as SocialPlatform,
                                    };
                                    updateBlock(block.id, { channels: next });
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground"
                                >
                                  <option value="website">Website</option>
                                  <option value="actblue">ActBlue / Donate</option>
                                  <option value="facebook">Facebook</option>
                                  <option value="instagram">Instagram</option>
                                  <option value="twitter">X / Twitter</option>
                                  <option value="substack">Substack</option>
                                </select>
                                <input
                                  type="url"
                                  value={ch.url}
                                  onChange={(e) => {
                                    const next = [...block.channels];
                                    next[chIdx] = { ...ch, url: e.target.value };
                                    updateBlock(block.id, { channels: next });
                                  }}
                                  placeholder="https://..."
                                  className="sm:col-span-2 px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-foreground"
                                />
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                updateBlock(block.id, {
                                  channels: [
                                    ...block.channels,
                                    {
                                      platform: 'website',
                                      url: 'https://indivisiblefairoaks.org',
                                      label: 'Website',
                                    },
                                  ],
                                })
                              }
                              className="text-[10px] font-bold text-primary dark:text-primary-on-dark hover:underline flex items-center gap-1 mt-1"
                            >
                              <Plus size={11} /> Add link channel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* CALLOUT BLOCK */}
                      {block.type === 'callout' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="sm:col-span-2 block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Callout Header</span>
                              <input
                                type="text"
                                value={block.title || ''}
                                onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                                placeholder="e.g. Urgent Vote / Notice"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Callout Style</span>
                              <select
                                value={block.variant || 'info'}
                                onChange={(e) =>
                                  updateBlock(block.id, {
                                    variant: e.target.value as CalloutBlock['variant'],
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              >
                                <option value="info">Info (Blue)</option>
                                <option value="alert">Alert (Amber)</option>
                                <option value="success">Success / Match (Green)</option>
                              </select>
                            </label>
                          </div>
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Callout Message</span>
                            <textarea
                              rows={2}
                              value={block.text}
                              onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                              placeholder="Key takeaway, challenge deadline, or call script..."
                              className="w-full px-3 py-2 rounded-xl border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                        </div>
                      )}

                      {/* BUTTON BLOCK */}
                      {block.type === 'button' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Button Label</span>
                            <input
                              type="text"
                              value={block.label}
                              onChange={(e) => updateBlock(block.id, { label: e.target.value })}
                              placeholder="e.g. RSVP for Town Hall"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Target Destination URL</span>
                            <input
                              type="url"
                              value={block.url}
                              onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                              placeholder="https://indivisiblefairoaks.org/actions"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                        </div>
                      )}

                      {/* EVENT BLOCK */}
                      {block.type === 'event' && (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Event Title</span>
                            <input
                              type="text"
                              value={block.title}
                              onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                              placeholder="e.g. Saturday Rally for Democracy"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Date & Time</span>
                              <input
                                type="text"
                                value={block.date}
                                onChange={(e) => updateBlock(block.id, { date: e.target.value })}
                                placeholder="Saturday, Oct 14 · 10am"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                            <label className="sm:col-span-2 block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Location / Venue</span>
                              <input
                                type="text"
                                value={block.location}
                                onChange={(e) =>
                                  updateBlock(block.id, { location: e.target.value })
                                }
                                placeholder="Carmichael Park Main Pavilion"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* DIVIDER BLOCK */}
                      {block.type === 'divider' && (
                        <div className="py-2 text-center text-muted-foreground">
                          <div className="h-px w-full bg-surface-muted" />
                        </div>
                      )}

                      {/* SIGNOFF BLOCK */}
                      {block.type === 'signoff' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Closing Salutation</span>
                            <input
                              type="text"
                              value={block.closing}
                              onChange={(e) => updateBlock(block.id, { closing: e.target.value })}
                              placeholder="In solidarity,"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Organizer / Team Name</span>
                            <input
                              type="text"
                              value={block.sender}
                              onChange={(e) => updateBlock(block.id, { sender: e.target.value })}
                              placeholder="Indivisible Fair Oaks Steering Committee"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Block Action Bar with 12 Blocks */}
      <div className="p-4 bg-surface-muted border border-border rounded-2xl shadow-2xs space-y-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          + Add Section Block
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={() => addBlock('header')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
          >
            <Heading size={13} className="text-primary dark:text-primary-on-dark" />
            Headline
          </button>
          <button
            type="button"
            onClick={() => addBlock('text')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
          >
            <Type size={13} className="text-muted-foreground" />
            Text / Story
          </button>
          <button
            type="button"
            onClick={() => addBlock('image')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
          >
            <ImageIcon size={13} className="text-cyan-600" />
            Photo / Banner
          </button>
          <button
            type="button"
            onClick={() => addBlock('quote')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
          >
            <QuoteIcon size={13} className="text-amber-600" />
            Quote Box
          </button>
          <button
            type="button"
            onClick={() => addBlock('stat')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
          >
            <BarChart3 size={13} className="text-emerald-600" />
            Stat Counter
          </button>
          <button
            type="button"
            onClick={() => addBlock('list')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
          >
            <ListIcon size={13} className="text-indigo-600" />
            Checklist
          </button>
          <button
            type="button"
            onClick={() => addBlock('callout')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
          >
            <AlertCircle size={13} className="text-amber-600" />
            Callout Box
          </button>
          <button
            type="button"
            onClick={() => addBlock('button')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
          >
            <ExternalLink size={13} className="text-blue-600" />
            CTA Button
          </button>
          <button
            type="button"
            onClick={() => addBlock('event')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
          >
            <Calendar size={13} className="text-purple-600" />
            Event Card
          </button>
          <button
            type="button"
            onClick={() => addBlock('social')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
          >
            <Share2 size={13} className="text-blue-600" />
            Social Links
          </button>
          <button
            type="button"
            onClick={() => addBlock('divider')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
          >
            <Minus size={13} className="text-muted-foreground" />
            Divider
          </button>
          <button
            type="button"
            onClick={() => addBlock('signoff')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
          >
            <PenTool size={13} className="text-emerald-600" />
            Sign-off
          </button>
        </div>
      </div>

      {/* Supabase S3 Media Library Modal */}
      <CRMMediaLibraryModal
        isOpen={mediaModalOpen}
        onClose={() => {
          setMediaModalOpen(false);
          setMediaTargetBlockId(null);
        }}
        onSelectMedia={handleSelectMedia}
        initialFolder="crm"
      />
    </div>
  );
}
