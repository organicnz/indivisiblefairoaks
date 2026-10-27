'use client';

import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';
import { ColorSwatchPicker, StudioSection, TYPOGRAPHY_COLOR_SWATCHES } from '../ui';

export interface TypographyPaletteStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
}

export function TypographyPaletteStudio({ styles, setStyles }: TypographyPaletteStudioProps) {
  return (
    <StudioSection title="Text Alignment & Color Palette" badge="Color & Align">
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
