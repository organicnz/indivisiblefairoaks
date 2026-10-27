'use client';

import type { VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export const LETTER_SPACING_OPTIONS = [
  { value: 'tracking-normal', label: 'Normal' },
  { value: 'tracking-wide', label: 'Wide (+0.025em)' },
  { value: 'tracking-wider', label: 'Wider (+0.05em)' },
  { value: 'tracking-tight', label: 'Tight (-0.025em)' },
] as const;

export const TEXT_TRANSFORM_OPTIONS = [
  { value: 'none', label: 'Normal Casing' },
  { value: 'uppercase', label: 'ALL CAPS' },
  { value: 'capitalize', label: 'Capitalize Words' },
  { value: 'lowercase', label: 'all lowercase' },
] as const;

export const TEXT_DECORATION_OPTIONS = [
  { value: '', label: 'None (Standard)' },
  { value: 'underline underline-offset-4 decoration-border', label: 'Subtle Underline' },
  {
    value: 'underline underline-offset-4 decoration-amber-500/60 decoration-2',
    label: 'Civic Gold Underline',
  },
  {
    value: 'underline underline-offset-4 decoration-blue-500/60 decoration-2',
    label: 'Navy Accent Underline',
  },
  { value: 'line-through decoration-rose-500/70', label: 'Strikethrough' },
] as const;

export const TEXT_SHADOW_OPTIONS = [
  { value: '', label: 'None (Crisp Flat)' },
  { value: 'drop-shadow-sm', label: 'Subtle Soft (sm)' },
  { value: 'drop-shadow-md', label: 'High Contrast (md)' },
  { value: 'drop-shadow-lg', label: 'Dramatic Depth (lg)' },
] as const;

export interface TypographyEffectsStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  letterSpacingSelectId?: string;
  textTransformSelectId?: string;
  textDecorationSelectId?: string;
  textShadowSelectId?: string;
}

export function TypographyEffectsStudio({
  styles,
  setStyles,
  letterSpacingSelectId,
  textTransformSelectId,
  textDecorationSelectId,
  textShadowSelectId,
}: TypographyEffectsStudioProps) {
  return (
    <StudioSection title="Letter Spacing, Casing & Accents" badge="Styling">
      <div>
        <span className="text-[10px] text-slate-400 mb-1 block">Letter Spacing &amp; Casing</span>
        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={letterSpacingSelectId}
            value={styles.typography.letterSpacing}
            onChange={(val) =>
              setStyles({
                ...styles,
                typography: { ...styles.typography, letterSpacing: val },
              })
            }
            options={LETTER_SPACING_OPTIONS}
          />
          <StudioSelect
            id={textTransformSelectId}
            value={styles.typography.textTransform}
            onChange={(val) =>
              setStyles({
                ...styles,
                typography: {
                  ...styles.typography,
                  textTransform: val as typeof styles.typography.textTransform,
                },
              })
            }
            options={TEXT_TRANSFORM_OPTIONS}
          />
        </div>
      </div>

      <div className="mt-2">
        <StudioSelect
          id={textDecorationSelectId}
          label="Text Decoration & Accents"
          value={styles.typography.textDecoration || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, textDecoration: val },
            })
          }
          options={TEXT_DECORATION_OPTIONS}
        />
      </div>

      <div className="mt-2">
        <StudioSelect
          id={textShadowSelectId}
          label="Text Drop Shadow"
          value={styles.typography.textShadow}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, textShadow: val },
            })
          }
          options={TEXT_SHADOW_OPTIONS}
        />
      </div>
    </StudioSection>
  );
}
