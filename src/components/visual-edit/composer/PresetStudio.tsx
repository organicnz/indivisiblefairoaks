'use client';

import { Wand2 } from 'lucide-react';
import type { StylePreset } from '@/types/unified';
import { VC_STYLE_PRESETS } from './constants';

export interface PresetStudioProps {
  onApplyPreset: (preset: StylePreset) => void;
}

export function PresetStudio({ onApplyPreset }: PresetStudioProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="block text-slate-300 font-bold mb-0.5">
            Professional 1-Click Design Presets
          </span>
          <p className="text-[11px] text-slate-400">
            Instantly style this block with curated civic palettes and elevations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {VC_STYLE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApplyPreset(preset)}
            className="flex items-start justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-accent-gold/50 hover:bg-white/10 group"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white group-hover:text-accent-gold transition-colors">
                  {preset.name}
                </span>
                <span className="rounded-md bg-accent-gold/20 px-1.5 py-0.5 text-[9px] font-bold text-accent-gold">
                  {preset.badge}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">{preset.description}</p>
            </div>
            <Wand2
              size={13}
              className="text-slate-400 group-hover:text-accent-gold transition-colors shrink-0 mt-0.5"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
