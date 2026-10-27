'use client';

import { BookmarkPlus, Layers, LayoutGrid, Search, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type {
  StylePreset,
  VisualComposerPresetCategoryFilter,
  VisualComposerPresetTab,
  VisualComposerSectionPreset,
  VisualComposerStyles,
} from '@/types/unified';
import { SECTION_PRESETS, VC_STYLE_PRESETS } from './constants';
import { StudioSection } from './ui';

export interface PresetStudioProps {
  onApplyPreset: (preset: StylePreset) => void;
  onApplySectionPreset?: (preset: VisualComposerSectionPreset) => void;
  styles?: VisualComposerStyles;
  setStyles?: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
}

const PRESET_ACCENTS: Record<string, { dot: string; border: string }> = {
  'editorial-card': { dot: 'bg-slate-400', border: 'border-white/20' },
  'civic-callout': { dot: 'bg-amber-400', border: 'border-amber-500/40' },
  'patriotic-hero': { dot: 'bg-blue-400', border: 'border-blue-500/40' },
  'glass-surface': { dot: 'bg-white/80', border: 'border-white/30' },
  'alert-announcement': { dot: 'bg-rose-400', border: 'border-rose-500/40' },
  'urgent-alert': { dot: 'bg-rose-400', border: 'border-rose-500/40' },
  'grassroots-emerald': { dot: 'bg-emerald-400', border: 'border-emerald-500/40' },
  'grassroots-petition': { dot: 'bg-emerald-400', border: 'border-emerald-500/40' },
  'minimal-bordered': { dot: 'bg-sky-400', border: 'border-sky-500/40' },
  'minimalist-mono': { dot: 'bg-sky-400', border: 'border-sky-500/40' },
  'left-accent-quote': { dot: 'bg-amber-400', border: 'border-amber-400/40' },
  'golden-hero-badge': { dot: 'bg-amber-300', border: 'border-amber-400/40' },
  'compact-pill-action': { dot: 'bg-teal-400', border: 'border-teal-500/40' },
  'high-contrast-statement': { dot: 'bg-amber-300', border: 'border-amber-400/40' },
};

const CATEGORY_FILTERS: readonly {
  id: VisualComposerPresetCategoryFilter;
  label: string;
}[] = [
  { id: 'all', label: 'All Styles' },
  { id: 'civic', label: 'Civic' },
  { id: 'hero', label: 'Hero' },
  { id: 'glass', label: 'Glass' },
  { id: 'card', label: 'Cards' },
  { id: 'alert', label: 'Alerts' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'clean', label: 'Minimal' },
  { id: 'saved', label: 'Custom' },
] as const;

const LOCAL_STORAGE_KEY = 'vc_user_style_presets';

function getStoredCustomPresets(): StylePreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        id: item.id || `custom-${Date.now()}`,
        name: item.name || 'Custom Saved Preset',
        description: item.description || 'Saved custom style configuration',
        badge: item.badge || 'Custom',
        apply: () => item.styles || {},
      }));
    }
  } catch {
    // Graceful fallback for non-browser or corrupted local storage
  }
  return [];
}

export function PresetStudio({
  onApplyPreset,
  onApplySectionPreset,
  styles,
  setStyles,
}: PresetStudioProps) {
  const searchInputId = useId();
  const customNameId = useId();
  const customBadgeId = useId();

  const [activeTab, setActiveTab] = useState<VisualComposerPresetTab>('blocks');
  const [activeCategory, setActiveCategory] = useState<VisualComposerPresetCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Custom user-saved presets
  const [customPresets, setCustomPresets] = useState<StylePreset[]>(getStoredCustomPresets);
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customBadge, setCustomBadge] = useState('Custom');

  const handleSaveCustomPreset = () => {
    if (!styles || !customName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }
    const newPresetId = `custom-${Date.now()}`;
    const newPresetStyles = { ...styles };
    const newPreset: StylePreset = {
      id: newPresetId,
      name: customName.trim(),
      description: 'Custom user-saved block styles & layout configuration',
      badge: customBadge.trim() || 'Custom',
      apply: () => newPresetStyles,
    };

    const updated = [newPreset, ...customPresets];
    setCustomPresets(updated);
    if (typeof window !== 'undefined') {
      try {
        const serializable = updated.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          badge: p.badge,
          styles: p.apply(),
        }));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializable));
      } catch {
        // Storage write ignored
      }
    }
    setCustomName('');
    setIsSavingCustom(false);
    setActiveCategory('saved');
    toast.success(`Saved "${newPreset.name}" to custom presets`);
  };

  const handleDeleteCustomPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    if (typeof window !== 'undefined') {
      try {
        const serializable = updated.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          badge: p.badge,
          styles: p.apply(),
        }));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializable));
      } catch {
        // Storage write ignored
      }
    }
    toast.success('Removed custom preset');
  };

  const allBlockPresets = useMemo(() => [...customPresets, ...VC_STYLE_PRESETS], [customPresets]);

  const filteredBlockPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allBlockPresets.filter((preset) => {
      // Category match
      if (activeCategory === 'saved') {
        const isCustom = customPresets.some((cp) => cp.id === preset.id);
        if (!isCustom) return false;
      } else if (activeCategory !== 'all') {
        const badgeLower = preset.badge.toLowerCase();
        const idLower = preset.id.toLowerCase();
        const matchesCategory =
          badgeLower.includes(activeCategory) || idLower.includes(activeCategory);
        if (!matchesCategory) return false;
      }

      // Search query match
      if (!q) return true;
      return (
        preset.name.toLowerCase().includes(q) ||
        preset.description.toLowerCase().includes(q) ||
        preset.badge.toLowerCase().includes(q) ||
        preset.id.toLowerCase().includes(q)
      );
    });
  }, [allBlockPresets, activeCategory, searchQuery, customPresets]);

  const filteredSectionPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SECTION_PRESETS;
    return SECTION_PRESETS.filter(
      (sec) =>
        sec.name.toLowerCase().includes(q) ||
        sec.description.toLowerCase().includes(q) ||
        sec.badge.toLowerCase().includes(q) ||
        sec.id.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleApplySection = (preset: VisualComposerSectionPreset) => {
    if (onApplySectionPreset) {
      onApplySectionPreset(preset);
      toast.success(`Applied ${preset.name} section template`);
      return;
    }
    if (setStyles) {
      const applied = preset.apply();
      setStyles((prev) => ({
        ...prev,
        ...applied,
        section: { ...prev.section, ...applied.section },
      }));
      toast.success(`Applied ${preset.name} section template`);
    } else {
      toast.info(`Section template "${preset.name}" selected`);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Preset Studio Header ── */}
      <StudioSection title="Visual Composer Preset Studio" badge="10x Pro">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="block text-slate-300 font-bold mb-0.5 flex items-center gap-1.5">
              <Sparkles size={13} className="text-accent-gold" />
              <span>Professional 1-Click Design Presets</span>
            </span>
            <p className="text-[11px] text-slate-400">
              Apply 1-click curated palettes, typography, elevations, or save your own custom block
              styles.
            </p>
          </div>
        </div>

        {/* ── Main Tab Switcher: Block Styles vs Section Templates ── */}
        <div className="grid grid-cols-2 gap-1.5 mb-3 p-1 rounded-xl bg-white/5 border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('blocks')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'blocks'
                ? 'bg-accent-gold text-ink-strong shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutGrid size={12} />
            <span>Block Styles ({allBlockPresets.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sections')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sections'
                ? 'bg-accent-gold text-ink-strong shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers size={12} />
            <span>Section Templates ({SECTION_PRESETS.length})</span>
          </button>
        </div>

        {/* ── Search Bar ── */}
        <div className="relative mb-3">
          <label htmlFor={searchInputId} className="sr-only">
            Search presets
          </label>
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'blocks'
                  ? 'Search block presets (e.g. hero, glass, civic)...'
                  : 'Search section templates (e.g. hero, split, matrix)...'
              }
              className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-white/10 bg-slate-900 text-xs text-white placeholder:text-slate-400 focus:border-accent-gold/50 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ── Category Filter Pills (Block Mode Only) ── */}
        {activeTab === 'blocks' && (
          <div className="flex flex-wrap gap-1 mb-3">
            {CATEGORY_FILTERS.map((cat) => {
              const isActive = activeCategory === cat.id;
              const count =
                cat.id === 'saved'
                  ? customPresets.length
                  : cat.id === 'all'
                    ? allBlockPresets.length
                    : allBlockPresets.filter(
                        (p) =>
                          p.badge.toLowerCase().includes(cat.id) ||
                          p.id.toLowerCase().includes(cat.id)
                      ).length;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    isActive
                      ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/40 font-bold'
                      : 'border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="text-[9px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Save Current Styles as Custom Preset Panel ── */}
        {styles && activeTab === 'blocks' && (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
            {!isSavingCustom ? (
              <button
                type="button"
                onClick={() => setIsSavingCustom(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-dashed border-accent-gold/40 text-accent-gold text-xs font-bold hover:bg-accent-gold/10 transition-colors cursor-pointer"
              >
                <BookmarkPlus size={13} />
                <span>Save Current Style as Reusable Preset</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    <BookmarkPlus size={12} className="text-accent-gold" />
                    <span>Save Custom Preset</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSavingCustom(false)}
                    className="text-slate-400 hover:text-white text-xs"
                    aria-label="Cancel saving custom preset"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor={customNameId}
                      className="block text-[10px] text-slate-400 mb-0.5"
                    >
                      Preset Name
                    </label>
                    <input
                      id={customNameId}
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. Midnight Civic Accent"
                      className="w-full px-2 py-1 rounded border border-white/10 bg-slate-900 text-xs text-white focus:border-accent-gold/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={customBadgeId}
                      className="block text-[10px] text-slate-400 mb-0.5"
                    >
                      Badge Label
                    </label>
                    <input
                      id={customBadgeId}
                      type="text"
                      value={customBadge}
                      onChange={(e) => setCustomBadge(e.target.value)}
                      placeholder="e.g. Campaign, Alert"
                      className="w-full px-2 py-1 rounded border border-white/10 bg-slate-900 text-xs text-white focus:border-accent-gold/50 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsSavingCustom(false)}
                    className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustomPreset}
                    className="px-3 py-1 rounded bg-accent-gold text-ink-strong text-xs font-bold hover:bg-accent-gold/90 transition-colors cursor-pointer"
                  >
                    Save Preset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Preset Grid List ── */}
        {activeTab === 'blocks' ? (
          filteredBlockPresets.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {filteredBlockPresets.map((preset) => {
                const accent = PRESET_ACCENTS[preset.id] || {
                  dot: 'bg-amber-400',
                  border: 'border-white/10',
                };
                const isCustom = customPresets.some((cp) => cp.id === preset.id);

                return (
                  <div
                    key={preset.id}
                    className={`flex items-start justify-between rounded-xl border ${accent.border} bg-white/5 p-3 text-left transition-all hover:border-accent-gold/50 hover:bg-white/10 group relative`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onApplyPreset(preset);
                        toast.success(`Applied ${preset.name}`);
                      }}
                      className="flex-1 flex items-start gap-2.5 text-left cursor-pointer"
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${accent.dot} mt-1 shrink-0 shadow-xs`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white group-hover:text-accent-gold transition-colors text-xs">
                            {preset.name}
                          </span>
                          <span className="rounded-md bg-accent-gold/20 px-1.5 py-0.5 text-[9px] font-bold text-accent-gold">
                            {preset.badge}
                          </span>
                          {isCustom && (
                            <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/30">
                              Saved
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{preset.description}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomPreset(preset.id, e)}
                          title="Delete custom preset"
                          aria-label={`Delete custom preset ${preset.name}`}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onApplyPreset(preset);
                          toast.success(`Applied ${preset.name}`);
                        }}
                        aria-label={`Apply ${preset.name}`}
                        className="cursor-pointer"
                      >
                        <Wand2
                          size={13}
                          className="text-slate-400 group-hover:text-accent-gold transition-colors shrink-0"
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 rounded-xl border border-white/10 bg-white/5 p-4">
              <Sparkles size={24} className="mx-auto text-accent-gold mb-2 opacity-50" />
              <p className="text-xs font-bold text-white mb-1">No presets found</p>
              <p className="text-[11px] text-slate-400 mb-3">
                No design presets matched &ldquo;{searchQuery}&rdquo;. Try another search or reset
                filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                }}
                className="px-3 py-1 rounded-lg bg-accent-gold/20 text-accent-gold border border-accent-gold/40 text-xs font-bold hover:bg-accent-gold/30 transition-colors cursor-pointer"
              >
                Reset Search & Filters
              </button>
            </div>
          )
        ) : filteredSectionPresets.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {filteredSectionPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplySection(preset)}
                className="flex items-start justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-accent-gold/50 hover:bg-white/10 group cursor-pointer w-full"
              >
                <div className="flex items-start gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent-gold mt-1 shrink-0 shadow-xs" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white group-hover:text-accent-gold transition-colors text-xs">
                        {preset.name}
                      </span>
                      <span className="rounded-md bg-accent-gold/20 px-1.5 py-0.5 text-[9px] font-bold text-accent-gold border border-accent-gold/30">
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{preset.description}</p>
                  </div>
                </div>
                <Wand2
                  size={13}
                  className="text-slate-400 group-hover:text-accent-gold transition-colors shrink-0 ml-2 mt-0.5"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 rounded-xl border border-white/10 bg-white/5 p-4">
            <Sparkles size={24} className="mx-auto text-accent-gold mb-2 opacity-50" />
            <p className="text-xs font-bold text-white mb-1">No section templates found</p>
            <p className="text-[11px] text-slate-400 mb-3">
              No section templates matched &ldquo;{searchQuery}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-3 py-1 rounded-lg bg-accent-gold/20 text-accent-gold border border-accent-gold/40 text-xs font-bold hover:bg-accent-gold/30 transition-colors cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        )}
      </StudioSection>
    </div>
  );
}
