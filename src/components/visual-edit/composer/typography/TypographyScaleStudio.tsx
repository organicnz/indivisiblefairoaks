'use client';

import type { VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export const FONT_FAMILY_OPTIONS = [
  { value: '', label: 'Default Clean Sans' },
  { value: 'font-serif', label: 'Civic Editorial Serif' },
  { value: 'font-mono', label: 'Technical Monospace' },
] as const;

export const FONT_SIZE_OPTIONS = [
  { value: 'text-xs', label: 'Compact (xs)' },
  { value: 'text-sm', label: 'Small (sm)' },
  { value: 'text-base', label: 'Body (base)' },
  { value: 'text-lg', label: 'Large (lg)' },
  { value: 'text-xl', label: 'XL (xl)' },
  { value: 'text-2xl', label: 'Hero (2xl)' },
  { value: 'text-3xl', label: 'Display (3xl)' },
  { value: 'text-4xl', label: 'Title (4xl)' },
  { value: 'text-5xl', label: 'Heroic (5xl)' },
  { value: 'text-6xl', label: 'Billboard (6xl)' },
  { value: 'text-7xl', label: 'Monumental (7xl)' },
] as const;

export const FONT_WEIGHT_OPTIONS = [
  { value: 'font-thin', label: 'Thin (100)' },
  { value: 'font-light', label: 'Light (300)' },
  { value: 'font-normal', label: 'Regular (400)' },
  { value: 'font-medium', label: 'Medium (500)' },
  { value: 'font-semibold', label: 'Semi-Bold (600)' },
  { value: 'font-bold', label: 'Bold (700)' },
  { value: 'font-extrabold', label: 'Extra Bold (800)' },
  { value: 'font-black', label: 'Black (900)' },
] as const;

export const TEXT_GRADIENT_OPTIONS = [
  { value: '', label: 'None (Solid Color)' },
  {
    value:
      'bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent',
    label: 'Brand Gold Shine',
  },
  {
    value: 'bg-gradient-to-r from-blue-400 via-slate-100 to-rose-400 bg-clip-text text-transparent',
    label: 'Patriotic Tristate',
  },
  {
    value:
      'bg-gradient-to-r from-emerald-400 via-teal-200 to-emerald-500 bg-clip-text text-transparent',
    label: 'Grassroots Emerald',
  },
] as const;

export const LINE_HEIGHT_OPTIONS = [
  { value: 'leading-relaxed', label: 'Relaxed Body (1.625)' },
  { value: 'leading-normal', label: 'Normal (1.5)' },
  { value: 'leading-snug', label: 'Snug (1.375)' },
  { value: 'leading-tight', label: 'Tight Headline (1.25)' },
  { value: 'leading-none', label: 'Flush None (1.0)' },
  { value: 'leading-loose', label: 'Loose Breathing (2.0)' },
] as const;

export interface TypographyScaleStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  fontFamilySelectId?: string;
  fontSizeSelectId?: string;
  fontWeightSelectId?: string;
  textGradientSelectId?: string;
  lineHeightSelectId?: string;
}

export function TypographyScaleStudio({
  styles,
  setStyles,
  fontFamilySelectId,
  fontSizeSelectId,
  fontWeightSelectId,
  textGradientSelectId,
  lineHeightSelectId,
}: TypographyScaleStudioProps) {
  return (
    <StudioSection title="Font Family, Scale & Hierarchy" badge="Core">
      <div className="grid grid-cols-2 gap-2">
        <StudioSelect
          id={fontFamilySelectId}
          label="Font Family"
          value={styles.typography.fontFamily}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, fontFamily: val },
            })
          }
          options={FONT_FAMILY_OPTIONS}
        />
        <StudioSelect
          id={fontSizeSelectId}
          label="Font Size"
          value={styles.typography.fontSize}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, fontSize: val },
            })
          }
          options={FONT_SIZE_OPTIONS}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <StudioSelect
          id={fontWeightSelectId}
          label="Weight"
          value={styles.typography.fontWeight}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, fontWeight: val },
            })
          }
          options={FONT_WEIGHT_OPTIONS}
        />
        <StudioSelect
          id={textGradientSelectId}
          label="Text Gradient"
          value={styles.typography.textGradient}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, textGradient: val },
            })
          }
          options={TEXT_GRADIENT_OPTIONS}
        />
      </div>

      <div className="mt-2">
        <StudioSelect
          id={lineHeightSelectId}
          label="Line Height"
          value={styles.typography.lineHeight}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, lineHeight: val },
            })
          }
          options={LINE_HEIGHT_OPTIONS}
        />
      </div>
    </StudioSection>
  );
}
