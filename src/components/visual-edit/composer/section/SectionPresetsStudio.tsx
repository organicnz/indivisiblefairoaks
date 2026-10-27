'use client';

import { Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import type { VisualComposerStyles } from '@/types/unified';
import { SECTION_PRESETS } from '../constants';
import { StudioSection } from '../ui';

export interface SectionPresetsStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
}

export function SectionPresetsStudio({ setStyles }: SectionPresetsStudioProps) {
  return (
    <StudioSection
      title="1-Click Section Presets"
      badge="Pro Templates"
      description="Instant civic layouts: heroes, matrices, split callouts, and liquid glass bands."
    >
      <div className="grid grid-cols-2 gap-2">
        {SECTION_PRESETS.map((preset) => (
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
    </StudioSection>
  );
}
