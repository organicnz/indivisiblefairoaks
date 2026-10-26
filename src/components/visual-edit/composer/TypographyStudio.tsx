'use client';

import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';
import { StudioSelect } from './ui';

export interface TypographyStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  fontFamilySelectId: string;
  fontSizeSelectId: string;
  fontWeightSelectId: string;
  textGradientSelectId: string;
  lineHeightSelectId: string;
  letterSpacingSelectId: string;
  textTransformSelectId: string;
  textDecorationSelectId: string;
  textShadowSelectId: string;
  fontStyleSelectId: string;
  textWrapSelectId: string;
  wordBreakSelectId?: string;
  textColumnsSelectId?: string;
  fontSmoothingSelectId?: string;
}

const FONT_FAMILY_OPTIONS = [
  { value: '', label: 'Default Clean Sans' },
  { value: 'font-serif', label: 'Civic Editorial Serif' },
  { value: 'font-mono', label: 'Technical Monospace' },
] as const;

const FONT_SIZE_OPTIONS = [
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

const FONT_WEIGHT_OPTIONS = [
  { value: 'font-thin', label: 'Thin (100)' },
  { value: 'font-light', label: 'Light (300)' },
  { value: 'font-normal', label: 'Regular (400)' },
  { value: 'font-medium', label: 'Medium (500)' },
  { value: 'font-semibold', label: 'Semi-Bold (600)' },
  { value: 'font-bold', label: 'Bold (700)' },
  { value: 'font-extrabold', label: 'Extra Bold (800)' },
  { value: 'font-black', label: 'Black (900)' },
] as const;

const TEXT_GRADIENT_OPTIONS = [
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

const LINE_HEIGHT_OPTIONS = [
  { value: 'leading-relaxed', label: 'Relaxed Body (1.625)' },
  { value: 'leading-normal', label: 'Normal (1.5)' },
  { value: 'leading-snug', label: 'Snug (1.375)' },
  { value: 'leading-tight', label: 'Tight Headline (1.25)' },
  { value: 'leading-none', label: 'Flush None (1.0)' },
  { value: 'leading-loose', label: 'Loose Breathing (2.0)' },
] as const;

const LETTER_SPACING_OPTIONS = [
  { value: 'tracking-normal', label: 'Normal' },
  { value: 'tracking-wide', label: 'Wide (+0.025em)' },
  { value: 'tracking-wider', label: 'Wider (+0.05em)' },
  { value: 'tracking-tight', label: 'Tight (-0.025em)' },
] as const;

const TEXT_TRANSFORM_OPTIONS = [
  { value: 'none', label: 'Normal Casing' },
  { value: 'uppercase', label: 'ALL CAPS' },
  { value: 'capitalize', label: 'Capitalize Words' },
  { value: 'lowercase', label: 'all lowercase' },
] as const;

const TEXT_DECORATION_OPTIONS = [
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

const TEXT_SHADOW_OPTIONS = [
  { value: '', label: 'None (Crisp Flat)' },
  { value: 'drop-shadow-sm', label: 'Subtle Soft (sm)' },
  { value: 'drop-shadow-md', label: 'High Contrast (md)' },
  { value: 'drop-shadow-lg', label: 'Dramatic Depth (lg)' },
] as const;

const FONT_STYLE_OPTIONS = [
  { value: 'normal', label: 'Normal Upright' },
  { value: 'italic', label: 'Italic Emphasis' },
] as const;

const TEXT_WRAP_OPTIONS = [
  { value: '', label: 'Normal Flow' },
  { value: 'text-balance', label: 'Balanced Headlines (text-balance)' },
  { value: 'text-pretty', label: 'Editorial Pretty (text-pretty)' },
  { value: 'truncate', label: 'Single Line Truncate (truncate)' },
  { value: 'break-words', label: 'Break Words (break-words)' },
] as const;

const WORD_BREAK_OPTIONS = [
  { value: '', label: 'Default (Browser)' },
  { value: 'break-normal', label: 'Normal (break-normal)' },
  { value: 'break-words', label: 'Wrap Long Words (break-words)' },
  { value: 'break-all', label: 'Force Break Anywhere (break-all)' },
  { value: 'break-keep', label: 'Keep Words Whole (break-keep)' },
] as const;

const TEXT_COLUMNS_OPTIONS = [
  { value: '', label: 'Single Column (Standard)' },
  { value: 'columns-1 md:columns-2 gap-8', label: '2 Newspaper Columns' },
  { value: 'columns-1 md:columns-3 gap-8', label: '3 Editorial Columns' },
  { value: 'columns-1 sm:columns-2 lg:columns-4 gap-6', label: '4 Magazine Columns' },
] as const;

const FONT_SMOOTHING_OPTIONS = [
  { value: '', label: 'Default (Subpixel)' },
  { value: 'antialiased', label: 'Antialiased (Crisp High-DPI)' },
  { value: 'subpixel-antialiased', label: 'Subpixel Antialiased' },
] as const;

const COLOR_SWATCHES = [
  { color: 'text-foreground', label: 'Default Ink', dot: 'bg-white/40' },
  { color: 'text-accent-gold', label: 'Civic Gold', dot: 'bg-amber-400' },
  { color: 'text-white', label: 'Bright White', dot: 'bg-white/95' },
  { color: 'text-sky-300', label: 'Patriotic Sky', dot: 'bg-sky-400' },
  { color: 'text-rose-400', label: 'Alert Crimson', dot: 'bg-rose-400' },
  { color: 'text-emerald-400', label: 'Success Green', dot: 'bg-emerald-500' },
] as const;

export function TypographyStudio({
  styles,
  setStyles,
  fontFamilySelectId,
  fontSizeSelectId,
  fontWeightSelectId,
  textGradientSelectId,
  lineHeightSelectId,
  letterSpacingSelectId,
  textTransformSelectId,
  textDecorationSelectId,
  textShadowSelectId,
  fontStyleSelectId,
  textWrapSelectId,
  wordBreakSelectId = 'typography-word-break-select',
  textColumnsSelectId = 'typography-text-columns-select',
  fontSmoothingSelectId = 'typography-font-smoothing-select',
}: TypographyStudioProps) {
  return (
    <div className="space-y-4">
      {/* Alignment Buttons */}
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

      {/* Font Family & Size */}
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

      {/* Weight & Text Gradient */}
      <div className="grid grid-cols-2 gap-2">
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

      {/* Line Height */}
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

      {/* Text Color Swatches */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">Typography Color</span>
        <div className="grid grid-cols-3 gap-1.5">
          {COLOR_SWATCHES.map((item) => {
            const isSelected = styles.typography.color === item.color;
            return (
              <button
                key={item.color}
                type="button"
                onClick={() =>
                  setStyles({
                    ...styles,
                    typography: { ...styles.typography, color: item.color, textGradient: '' },
                  })
                }
                className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-accent-gold bg-accent-gold/15 text-accent-gold font-bold'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Letter Spacing & Casing */}
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

      {/* Text Decoration & Accents */}
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

      {/* Text Drop Shadow */}
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

      {/* Font Style, Editorial Text Wrapping & Multi-Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <StudioSelect
          id={fontStyleSelectId}
          label="Font Posture / Style"
          value={styles.typography.fontStyle || 'normal'}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: {
                ...styles.typography,
                fontStyle: val as 'normal' | 'italic',
              },
            })
          }
          options={FONT_STYLE_OPTIONS}
          size="xs"
        />
        <StudioSelect
          id={textWrapSelectId}
          label="Text Wrapping & Overflow"
          value={styles.typography.textWrap || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, textWrap: val },
            })
          }
          options={TEXT_WRAP_OPTIONS}
          size="xs"
        />
        <StudioSelect
          id={wordBreakSelectId}
          label="Word Break Behavior"
          value={styles.typography.wordBreak || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, wordBreak: val },
            })
          }
          options={WORD_BREAK_OPTIONS}
          size="xs"
        />
        <StudioSelect
          id={textColumnsSelectId}
          label="Editorial Multi-Columns"
          value={styles.typography.textColumns || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, textColumns: val },
            })
          }
          options={TEXT_COLUMNS_OPTIONS}
          size="xs"
        />
        <StudioSelect
          id={fontSmoothingSelectId}
          label="Font Smoothing (Rendering)"
          value={styles.typography.fontSmoothing || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, fontSmoothing: val },
            })
          }
          options={FONT_SMOOTHING_OPTIONS}
          size="xs"
        />
      </div>
    </div>
  );
}
