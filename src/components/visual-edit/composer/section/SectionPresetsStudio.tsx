'use client';

import { Search, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  VisualComposerSectionPresetCategoryFilter,
  VisualComposerStyles,
} from '@/types/unified';
import { SECTION_PRESETS } from '../constants';
import { StudioSection } from '../ui';

export interface SectionPresetsStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
}

const CATEGORY_PILLS: {
  id: VisualComposerSectionPresetCategoryFilter;
  label: string;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'hero', label: 'Hero' },
  { id: 'grid', label: 'Grid' },
  { id: 'split', label: 'Split' },
  { id: 'glass', label: 'Glass' },
  { id: 'alert', label: 'Alert' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'video', label: 'Video' },
  { id: 'clean', label: 'Clean' },
  { id: 'faq', label: 'FAQ' },
];

export function SectionPresetsStudio({ setStyles }: SectionPresetsStudioProps) {
  const [activeCategory, setActiveCategory] =
    useState<VisualComposerSectionPresetCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPresets = SECTION_PRESETS.filter((preset) => {
    const matchesCategory =
      activeCategory === 'all' || preset.badge.toLowerCase() === activeCategory;
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      preset.name.toLowerCase().includes(query) ||
      preset.description.toLowerCase().includes(query) ||
      preset.badge.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  return (
    <StudioSection
      title="1-Click Section Presets"
      badge={`${SECTION_PRESETS.length} Pro Templates`}
      description="Instant civic layouts: heroes, matrices, split callouts, and liquid glass bands."
    >
      <div className="flex flex-col gap-2.5">
        {/* Search bar */}
        <div className="relative flex items-center">
          <Search size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search section presets..."
            className="w-full pl-7 pr-7 py-1 text-xs rounded-lg border border-white/10 bg-slate-900/60 text-white placeholder:text-white/40 focus:outline-none focus:border-accent-gold/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1">
          {CATEGORY_PILLS.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/40'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Presets Grid */}
        {filteredPresets.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  const applied = preset.apply();
                  setStyles((prev) => ({
                    ...prev,
                    ...applied,
                    section: { ...prev.section, ...applied.section },
                  }));
                  toast.success(`Applied ${preset.name}`);
                }}
                className="flex flex-col text-left p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-accent-gold/40 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-white group-hover:text-accent-gold transition-colors flex items-center gap-1">
                    <Wand2 size={10} className="text-accent-gold" />
                    <span>{preset.name}</span>
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-accent-gold/20 text-accent-gold border border-accent-gold/30">
                    {preset.badge}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-2">{preset.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-white/10 bg-slate-900/40 text-center flex flex-col items-center justify-center gap-1">
            <span className="text-xs font-semibold text-slate-300">No section presets found</span>
            <span className="text-[10px] text-slate-400">
              Try adjusting your category filter or search query.
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('all');
                setSearchQuery('');
              }}
              className="mt-1 text-[10px] px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-accent-gold border border-accent-gold/30 cursor-pointer transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </StudioSection>
  );
}
