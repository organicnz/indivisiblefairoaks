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
  Heading,
  Image as ImageIcon,
  List as ListIcon,
  Minus,
  PenTool,
  Quote as QuoteIcon,
  Share2,
  Trash2,
  Type,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { uploadCRMMedia } from '@/lib/actions/crm';
import { CRMMediaLibraryModal } from './CRMMediaLibraryModal';
import { ComposerBlockForm } from './ComposerBlockForm';
import { ComposerBlockPalette } from './ComposerBlockPalette';
import { ComposerBlockPreview } from './ComposerBlockPreview';
import { ComposerCanvasToolbar } from './ComposerCanvasToolbar';
import type { ComposerBlock } from './types';

interface Props {
  blocks: ComposerBlock[];
  onChange: (blocks: ComposerBlock[]) => void;
}

function genId(): string {
  return `b_${Math.random().toString(36).slice(2, 9)}`;
}


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
  const tokenPickerRef = useRef<HTMLDivElement | null>(null);
  const tokenTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Close token picker on Escape or outside click
  useEffect(() => {
    if (!activeTokenBlockId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setActiveTokenBlockId(null);
        tokenTriggerRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (tokenPickerRef.current && !tokenPickerRef.current.contains(e.target as Node)) {
        setActiveTokenBlockId(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeTokenBlockId]);

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
    const targetBlock = blocks.find((b) => b.id === id);
    const label = targetBlock ? `${targetBlock.type} block` : 'Block';
    if (blocks.length <= 1) {
      commitChange([{ id: genId(), type: 'text', content: '' }]);
      toast(`${label} reset to empty text block`, {
        action: { label: 'Undo', onClick: handleUndo },
      });
      return;
    }
    commitChange(blocks.filter((b) => b.id !== id));
    toast(`${label} removed`, {
      action: { label: 'Undo', onClick: handleUndo },
    });
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
        if (b.type === 'signoff') return { ...b, sender: `${b.sender} ${token}` };
        if (b.type === 'event') return { ...b, title: `${b.title} ${token}` };
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
    <div className="compose-canvas space-y-4">
      <ComposerCanvasToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        blockCount={blocks.length}
        readingStats={readingStats}
        canvasViewport={canvasViewport}
        onCanvasViewportChange={setCanvasViewport}
        onBrowseMedia={openMediaLibraryGlobal}
        allPreviewing={previewBlockIds.size === blocks.length}
        onToggleAllPreviews={toggleAllPreviews}
        allCollapsed={collapsedBlockIds.size === blocks.length}
        onToggleAllCollapse={toggleAllCollapse}
      />

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
                        aria-label={`Convert block ${idx + 1} type`}
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
                      className="p-1 rounded text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Block Content Rendering: Live Visual Preview vs Form */}
                {!isCollapsed &&
                  (isPreviewing ? (
                    <ComposerBlockPreview block={block} />
                  ) : (
                    /* Form Input Mode for Block Editing */
                    <ComposerBlockForm
                      block={block}
                      updateBlock={updateBlock}
                      activeTokenBlockId={activeTokenBlockId}
                      setActiveTokenBlockId={setActiveTokenBlockId}
                      tokenPickerRef={tokenPickerRef}
                      tokenTriggerRef={tokenTriggerRef}
                      insertTokenIntoBlock={insertTokenIntoBlock}
                      openMediaLibraryForBlock={openMediaLibraryForBlock}
                      uploadingBlockId={uploadingBlockId}
                      handleQuickUploadForBlock={handleQuickUploadForBlock}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      </div>

      <ComposerBlockPalette onAddBlock={addBlock} />

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
