'use client';

import type { VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export const FONT_FAMILY_OPTIONS = [
  { value: '', label: 'Default Clean Sans' },
  { value: 'font-outfit', label: 'Civic Display Bold (Outfit)' },
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
  { value: 'text-8xl', label: 'Colossal (8xl)' },
  { value: 'text-9xl', label: 'Epic Display (9xl)' },
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
  {
    value:
      'bg-gradient-to-r from-amber-400 via-rose-400 to-indigo-500 bg-clip-text text-transparent',
    label: 'Sunset Civic Horizon',
  },
  {
    value: 'bg-gradient-to-r from-rose-500 via-red-400 to-amber-400 bg-clip-text text-transparent',
    label: 'Urgent Action Crimson',
  },
  {
    value:
      'bg-gradient-to-r from-purple-400 via-pink-300 to-indigo-400 bg-clip-text text-transparent',
    label: 'Amethyst Violet Glow',
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

const QUICK_FONT_SIZES = [
  { label: 'XS', value: 'text-xs' },
  { label: 'SM', value: 'text-sm' },
  { label: 'MD', value: 'text-base' },
  { label: 'LG', value: 'text-lg' },
  { label: 'XL', value: 'text-xl' },
  { label: '2X', value: 'text-2xl' },
  { label: '3X', value: 'text-3xl' },
  { label: '4X', value: 'text-4xl' },
  { label: '5X', value: 'text-5xl' },
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
      {/* Interactive Live Typography Preview Banner */}
      <div className="mb-3 rounded-xl border border-white/10 bg-slate-900/60 p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            Live Typography Preview
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-accent-gold/20 text-accent-gold border border-accent-gold/30">
            {styles.typography.fontSize}
          </span>
        </div>
        <div
          className={`p-2 rounded-lg bg-black/40 border border-white/5 overflow-hidden text-center truncate ${
            styles.typography.fontFamily
          } ${styles.typography.fontWeight} ${
            styles.typography.fontStyle === 'italic' ? 'italic' : ''
          } ${styles.typography.letterSpacing} ${
            styles.typography.textTransform !== 'none' ? styles.typography.textTransform : ''
          } ${styles.typography.textDecoration} ${styles.typography.textShadow} ${
            styles.typography.textGradient || styles.typography.color
          }`}
          style={{ fontSize: '1.125rem' }}
        >
          Democracy in Action · Fair Oaks
        </div>
      </div>

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

      {/* 1-Click Quick Font Size Chips */}
      <div className="mt-2">
        <span className="text-[10px] text-slate-400 block mb-1">Quick Scale Presets:</span>
        <div className="grid grid-cols-9 gap-1">
          {QUICK_FONT_SIZES.map((sz) => {
            const isActive = styles.typography.fontSize === sz.value;
            return (
              <button
                key={sz.value}
                type="button"
                onClick={() =>
                  setStyles({
                    ...styles,
                    typography: { ...styles.typography, fontSize: sz.value },
                  })
                }
                className={`py-1 text-center rounded text-[9px] font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-accent-gold text-ink-strong shadow-xs'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {sz.label}
              </button>
            );
          })}
        </div>
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
