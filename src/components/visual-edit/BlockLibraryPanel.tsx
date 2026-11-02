'use client';

import {
  Layers,
  Search,
  X,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { BLOCK_TEMPLATES, type BlockTemplate } from './BlockLibraryModal';

export interface BlockLibraryPanelProps {
  onInsertBlock: (template: BlockTemplate, targetIndex?: number) => void;
  insertTargetIndex?: number | null;
  onClose?: () => void;
  className?: string;
  embedded?: boolean;
}

export function BlockLibraryPanel({
  onInsertBlock,
  insertTargetIndex,
  onClose,
  className = '',
  embedded = false,
}: BlockLibraryPanelProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const titleId = useId();
  const descId = useId();

  const categories = ['All', 'Typography', 'Media', 'Action', 'Structure'];

  const filteredTemplates = useMemo(() => {
    const q = search.toLowerCase().trim();
    return BLOCK_TEMPLATES.filter((t) => {
      const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  return (
    <div
      data-testid="block-library-panel"
      className={`flex flex-col flex-1 min-h-0 text-white overflow-hidden overscroll-contain ${className}`}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 bg-slate-900/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-gold/20 text-accent-gold">
            <Layers size={15} />
          </div>
          <div>
            <div id={titleId} role="heading" aria-level={3} className="text-xs font-bold text-white tracking-wide uppercase">
              Visual Composer Element Library
            </div>
            <p id={descId} className="text-[10px] text-slate-400">
              {insertTargetIndex !== null && insertTargetIndex !== undefined
                ? `Insert element above block #${insertTargetIndex + 1}`
                : 'Click an element to insert into page'}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Element Library"
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-accent-gold"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="shrink-0 border-b border-white/10 bg-slate-900/60 p-3 space-y-2">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-3 top-2.5 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            aria-label="Search elements"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search elements (e.g. heading, button, callout, table)…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-7 text-xs text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-accent-gold ${
                selectedCategory === cat
                  ? 'bg-accent-gold text-ink-strong font-black'
                  : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid / List */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 grid grid-cols-1 gap-2.5">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No elements match &ldquo;{search}&rdquo; in {selectedCategory}.
          </div>
        ) : (
          filteredTemplates.map((template) => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  onInsertBlock(template, insertTargetIndex ?? undefined);
                  onClose?.();
                }}
                className="group flex flex-col items-start p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-accent-gold/50 text-left transition-[border-color,background-color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-gold/15 text-accent-gold group-hover:scale-105 transition-transform">
                      <Icon size={13} />
                    </div>
                    <h3 className="text-xs font-bold text-white group-hover:text-accent-gold transition-colors">
                      {template.title}
                    </h3>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    {template.category}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2 pl-8">
                  {template.description}
                </p>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/10 bg-slate-900/80 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>{filteredTemplates.length} elements available</span>
        {onClose && !embedded && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 font-bold text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
