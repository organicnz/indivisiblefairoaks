'use client';

import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { VisualComposerStyles, VisualComposerTypographyPalettePreset } from '@/types/unified';
import { ColorSwatchPicker, StudioSection, TYPOGRAPHY_COLOR_SWATCHES } from '../ui';

export const TYPOGRAPHY_PALETTE_PRESETS: readonly VisualComposerTypographyPalettePreset[] = [
  {
    id: 'civic-gold',
    name: 'Civic Gold Hero',
    description: 'Vibrant civic gold focus color with centered headline alignment',
    badge: 'Gold',
    apply: () => ({
      color: 'text-amber-500',
      textAlign: 'center',
      textGradient: '',
    }),
  },
  {
    id: 'crisp-white',
    name: 'Crisp Light Header',
    description: 'Clean bright foreground contrast with left-aligned structure',
    badge: 'Clean',
    apply: () => ({
      color: 'text-white',
      textAlign: 'left',
      textGradient: '',
    }),
  },
  {
    id: 'grassroots-emerald',
    name: 'Community Emerald',
    description: 'Organic grassroots forest green tone with center alignment',
    badge: 'Eco',
    apply: () => ({
      color: 'text-emerald-500',
      textAlign: 'center',
      textGradient: '',
    }),
  },
  {
    id: 'patriotic-navy',
    name: 'Patriotic Navy Depth',
    description: 'Deep authoritative blue tone with left-aligned body text',
    badge: 'Navy',
    apply: () => ({
      color: 'text-blue-950 dark:text-blue-300',
      textAlign: 'left',
      textGradient: '',
    }),
  },
  {
    id: 'editorial-justified',
    name: 'Editorial Justified',
    description: 'Formal justified newspaper column alignment with standard foreground tone',
    badge: 'Column',
    apply: () => ({
      color: 'text-foreground',
      textAlign: 'justify',
      textGradient: '',
    }),
  },
] as const;

export interface TypographyPaletteStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
}

export function TypographyPaletteStudio({ styles, setStyles }: TypographyPaletteStudioProps) {
  const getAlignmentClass = () => {
    switch (styles.typography.textAlign) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      case 'justify':
        return 'text-justify';
      default:
        return 'text-left';
    }
  };

  return (
    <StudioSection title="Text Alignment & Color Palette" badge="Color & Align">
      {/* 1. Live Alignment & Color Preview Banner */}
      <div className="p-3 rounded-xl border border-white/10 bg-slate-900/60 flex flex-col gap-2.5 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
            <Sparkles size={12} className="text-accent-gold" />
            <span>Live Palette &amp; Alignment Preview</span>
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
            Align: <strong className="text-white capitalize">{styles.typography.textAlign}</strong>
          </span>
        </div>

        {/* Live Staged Demonstration Card */}
        <div className="relative w-full p-3 rounded-lg bg-black/40 border border-white/5 overflow-hidden">
          <p
            data-testid="typography-palette-preview-text"
            className={`text-xs font-semibold leading-relaxed transition-all ${getAlignmentClass()} ${styles.typography.color || 'text-foreground'}`}
          >
            "Democracy is not a spectator sport — it belongs to all of us."
          </p>
          <span className="text-[8px] text-slate-400 font-mono block mt-1">
            Active Palette Class: {styles.typography.color || 'text-foreground'}
          </span>
        </div>

        {/* 1-Click Palette Presets */}
        <div className="pt-1 border-t border-white/5">
          <span className="text-[10px] font-bold text-slate-300 mb-1.5 block">
            1-Click Civic Palette Presets
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {TYPOGRAPHY_PALETTE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  const applied = preset.apply();
                  setStyles((prev) => ({
                    ...prev,
                    typography: {
                      ...prev.typography,
                      ...applied,
                    },
                  }));
                  toast.success(`Applied ${preset.name}`);
                }}
                className="flex items-center justify-between text-left px-2 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-accent-gold/40 transition-all cursor-pointer group"
              >
                <span className="text-[10px] font-medium text-white group-hover:text-accent-gold truncate">
                  {preset.name}
                </span>
                <span className="text-[8px] px-1 py-0.2 rounded font-mono font-bold bg-accent-gold/20 text-accent-gold border border-accent-gold/30 shrink-0 ml-1">
                  {preset.badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Alignment Buttons */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">Alignment</span>
        <div className="flex gap-2">
          {[
            { align: 'left', icon: AlignLeft },
            { align: 'center', icon: AlignCenter },
            { align: 'right', icon: AlignRight },
            { align: 'justify', icon: AlignJustify },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = styles.typography.textAlign === item.align;
            return (
              <button
                key={item.align}
                type="button"
                onClick={() =>
                  setStyles({
                    ...styles,
                    typography: {
                      ...styles.typography,
                      textAlign: item.align as typeof styles.typography.textAlign,
                    },
                  })
                }
                className={`flex-1 flex items-center justify-center p-2 rounded-lg border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-accent-gold text-ink-strong border-accent-gold'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Color Swatches */}
      <div className="mt-3">
        <ColorSwatchPicker
          label="Typography Color"
          value={styles.typography.color}
          swatches={TYPOGRAPHY_COLOR_SWATCHES}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, color: val, textGradient: '' },
            })
          }
        />
      </div>
    </StudioSection>
  );
}
