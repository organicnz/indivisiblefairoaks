'use client';

import { Sparkles, Wand2 } from 'lucide-react';
import type { StylePreset } from '@/types/unified';
import { VC_STYLE_PRESETS } from './constants';
import { StudioSection } from './ui';

export interface PresetStudioProps {
  onApplyPreset: (preset: StylePreset) => void;
}

const PRESET_ACCENTS: Record<string, { dot: string; border: string }> = {
  'editorial-card': { dot: 'bg-slate-400', border: 'border-white/20' },
  'civic-callout': { dot: 'bg-amber-400', border: 'border-amber-500/40' },
  'patriotic-hero': { dot: 'bg-blue-400', border: 'border-blue-500/40' },
  'glass-surface': { dot: 'bg-white/80', border: 'border-white/30' },
  'alert-announcement': { dot: 'bg-rose-400', border: 'border-rose-500/40' },
  'grassroots-petition': { dot: 'bg-emerald-400', border: 'border-emerald-500/40' },
  'minimalist-mono': { dot: 'bg-sky-400', border: 'border-sky-500/40' },
  'high-contrast-statement': { dot: 'bg-amber-300', border: 'border-amber-400/40' },
};

export function PresetStudio({ onApplyPreset }: PresetStudioProps) {
  return (
    <div className="space-y-4">
      <StudioSection title="Civic & Editorial Presets" badge="1-Click Apply">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="block text-slate-300 font-bold mb-0.5 flex items-center gap-1.5">
              <Sparkles size={13} className="text-accent-gold" />
              <span>Professional 1-Click Design Presets</span>
            </span>
            <p className="text-[11px] text-slate-400">
              Instantly style this block with curated civic palettes, typography, and elevations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {VC_STYLE_PRESETS.map((preset) => {
            const accent = PRESET_ACCENTS[preset.id] || {
              dot: 'bg-amber-400',
              border: 'border-white/10',
            };
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset)}
                className={`flex items-start justify-between rounded-xl border ${accent.border} bg-white/5 p-3 text-left transition-all hover:border-accent-gold/50 hover:bg-white/10 group cursor-pointer`}
              >
                <div className="flex items-start gap-2.5">
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
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{preset.description}</p>
                  </div>
                </div>
                <Wand2
                  size={13}
                  className="text-slate-400 group-hover:text-accent-gold transition-colors shrink-0 mt-0.5 ml-2"
                />
              </button>
            );
          })}
        </div>
      </StudioSection>
    </div>
  );
}
