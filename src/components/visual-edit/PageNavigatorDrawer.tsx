'use client';

import {
  ArrowDown,
  ArrowUp,
  Code,
  Copy,
  FolderTree,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  List,
  ListTree,
  Megaphone,
  Minus,
  MousePointerClick,
  Pilcrow,
  Plus,
  Quote,
  Search,
  SlidersHorizontal,
  Table,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import type { Block, ContentBlockType } from '@/lib/blocks';
import type { VisualSection } from '@/lib/visual-sections';

export interface PageNavigatorDrawerProps {
  open: boolean;
  onClose: () => void;
  sections: VisualSection[];
  blocks: Block[];
  activeBlockIndex: number | null;
  onSelectBlock: (index: number) => void;
  onMoveBlock: (index: number, direction: 'up' | 'down') => void;
  onDuplicateBlock: (index: number) => void;
  onDeleteBlock: (index: number) => void;
  onOpenComposer: (index: number, mode?: 'block' | 'section') => void;
  onOpenLibrary: (targetIndex?: number) => void;
}

function getBlockIcon(blockType: ContentBlockType) {
  switch (blockType) {
    case 'heading':
      return Type;
    case 'paragraph':
      return Pilcrow;
    case 'image':
      return ImageIcon;
    case 'button':
      return MousePointerClick;
    case 'callout':
      return Megaphone;
    case 'quote':
      return Quote;
    case 'bulletList':
    case 'orderedList':
      return List;
    case 'table':
      return Table;
    case 'divider':
      return Minus;
    case 'code':
      return Code;
    default:
      return Layers;
  }
}

export function PageNavigatorDrawer({
  open,
  onClose,
  sections,
  blocks,
  activeBlockIndex,
  onSelectBlock,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onOpenComposer,
  onOpenLibrary,
}: PageNavigatorDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const titleId = useId();
  const descId = useId();
  const searchInputId = useId();

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const query = searchQuery.toLowerCase().trim();
    return sections.filter(
      (sec) =>
        sec.label.toLowerCase().includes(query) ||
        sec.blockType.toLowerCase().includes(query) ||
        `#${sec.ordinal}`.includes(query)
    );
  }, [sections, searchQuery]);

  if (!open) return null;

  return (
    <aside
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-y-0 left-0 z-[10010] flex w-full max-w-sm flex-col border-r border-white/20 bg-slate-950/95 text-white shadow-2xl backdrop-blur-2xl animate-in slide-in-from-left duration-200 pointer-events-auto"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-gold/20 text-accent-gold">
            <ListTree size={16} />
          </div>
          <div>
            <h2 id={titleId} className="text-sm font-bold text-white tracking-wide">
              Structure Navigator
            </h2>
            <p id={descId} className="text-[11px] text-slate-400">
              {sections.length} {sections.length === 1 ? 'block' : 'blocks'} on page
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenLibrary(sections.length)}
            title="Add Block from Library"
            aria-label="Add Block from Library"
            className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-slate-300 hover:bg-accent-gold hover:text-ink-strong transition-colors"
          >
            <Plus size={13} />
            <span>Add</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Navigator"
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="border-b border-white/10 bg-slate-900/60 p-3">
        <div className="relative">
          <label htmlFor={searchInputId} className="sr-only">
            Search document structure
          </label>
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            id={searchInputId}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter sections &amp; blocks..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/40"
          />
        </div>
      </div>

      {/* Structure Tree List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs">
        {filteredSections.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <FolderTree size={28} className="mx-auto mb-2 text-slate-400" />
            <p className="text-xs font-medium">No matching blocks found</p>
          </div>
        ) : (
          filteredSections.map((sec) => {
            const Icon = getBlockIcon(sec.blockType);
            const isActive = sec.blockIndex === activeBlockIndex;
            const canMoveUp = sec.blockIndex > 0;
            const canMoveDown = sec.blockIndex < blocks.length - 1;

            return (
              <div
                key={sec.key}
                className={`group flex items-center justify-between rounded-xl border p-2 transition-all ${
                  isActive
                    ? 'border-accent-gold bg-accent-gold/15 text-white shadow-md'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {/* Clickable Title & Details */}
                <button
                  type="button"
                  onClick={() => onSelectBlock(sec.blockIndex)}
                  className="flex flex-1 items-center gap-2.5 text-left overflow-hidden mr-2"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      isActive ? 'bg-accent-gold text-ink-strong' : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    <Icon size={12} />
                  </span>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400">#{sec.ordinal}</span>
                      <span className="truncate text-xs font-semibold text-white">
                        {sec.label || `Untitled ${sec.blockType}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 capitalize">{sec.blockType}</span>
                  </div>
                </button>

                {/* Quick Action Controls */}
                <div className="flex items-center gap-0.5 opacity-90 group-hover:opacity-100 shrink-0">
                  {canMoveUp && (
                    <button
                      type="button"
                      onClick={() => onMoveBlock(sec.blockIndex, 'up')}
                      title="Move Up"
                      aria-label={`Move block #${sec.ordinal} up`}
                      className="rounded p-1 text-slate-400 hover:bg-white/15 hover:text-white transition-colors"
                    >
                      <ArrowUp size={12} />
                    </button>
                  )}
                  {canMoveDown && (
                    <button
                      type="button"
                      onClick={() => onMoveBlock(sec.blockIndex, 'down')}
                      title="Move Down"
                      aria-label={`Move block #${sec.ordinal} down`}
                      className="rounded p-1 text-slate-400 hover:bg-white/15 hover:text-white transition-colors"
                    >
                      <ArrowDown size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenComposer(sec.blockIndex, 'block')}
                    title="Customize Block Styles & Box Model in Visual Composer"
                    aria-label={`Customize block #${sec.ordinal} in Visual Composer`}
                    className="rounded p-1 text-accent-gold hover:bg-white/15 hover:text-white transition-colors"
                  >
                    <SlidersHorizontal size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenComposer(sec.blockIndex, 'section')}
                    title="Customize Section / Row Settings (Containers, Dividers & Columns)"
                    aria-label={`Customize section #${sec.ordinal} settings`}
                    className="rounded p-1 text-sky-400 hover:bg-white/15 hover:text-white transition-colors"
                  >
                    <LayoutTemplate size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicateBlock(sec.blockIndex)}
                    title="Duplicate block"
                    aria-label={`Duplicate block #${sec.ordinal}`}
                    className="rounded p-1 text-slate-400 hover:bg-white/15 hover:text-white transition-colors"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteBlock(sec.blockIndex)}
                    title="Delete block"
                    aria-label={`Delete block #${sec.ordinal}`}
                    className="rounded p-1 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Drawer Footer */}
      <div className="border-t border-white/10 bg-slate-900/80 px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-400">
        <span>Click any row to focus on canvas</span>
        <span className="font-mono text-accent-gold">⌘7</span>
      </div>
    </aside>
  );
}
