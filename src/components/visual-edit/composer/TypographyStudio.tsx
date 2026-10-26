'use client';

import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';

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
                className={`flex-1 flex items-center justify-center p-2 rounded-lg border transition-colors ${
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
        <div>
          <label htmlFor={fontFamilySelectId} className="text-[10px] text-slate-400 mb-1 block">
            Font Family
          </label>
          <select
            id={fontFamilySelectId}
            value={styles.typography.fontFamily}
            onChange={(e) =>
              setStyles({
                ...styles,
                typography: { ...styles.typography, fontFamily: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
          >
            <option value="">Default Clean Sans</option>
            <option value="font-serif">Civic Editorial Serif</option>
            <option value="font-mono">Technical Monospace</option>
          </select>
        </div>
        <div>
          <label htmlFor={fontSizeSelectId} className="text-[10px] text-slate-400 mb-1 block">
            Font Size
          </label>
          <select
            id={fontSizeSelectId}
            value={styles.typography.fontSize}
            onChange={(e) =>
              setStyles({
                ...styles,
                typography: { ...styles.typography, fontSize: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
          >
            <option value="text-xs">Compact (xs)</option>
            <option value="text-sm">Small (sm)</option>
            <option value="text-base">Body (base)</option>
            <option value="text-lg">Large (lg)</option>
            <option value="text-xl">XL (xl)</option>
            <option value="text-2xl">Hero (2xl)</option>
            <option value="text-3xl">Display (3xl)</option>
            <option value="text-4xl">Title (4xl)</option>
            <option value="text-5xl">Heroic (5xl)</option>
            <option value="text-6xl">Billboard (6xl)</option>
            <option value="text-7xl">Monumental (7xl)</option>
          </select>
        </div>
      </div>

      {/* Weight & Text Gradient */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={fontWeightSelectId} className="text-[10px] text-slate-400 mb-1 block">
            Weight
          </label>
          <select
            id={fontWeightSelectId}
            value={styles.typography.fontWeight}
            onChange={(e) =>
              setStyles({
                ...styles,
                typography: { ...styles.typography, fontWeight: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
          >
            <option value="font-thin">Thin (100)</option>
            <option value="font-light">Light (300)</option>
            <option value="font-normal">Regular (400)</option>
            <option value="font-medium">Medium (500)</option>
            <option value="font-semibold">Semi-Bold (600)</option>
            <option value="font-bold">Bold (700)</option>
            <option value="font-extrabold">Extra Bold (800)</option>
            <option value="font-black">Black (900)</option>
          </select>
        </div>
        <div>
          <label htmlFor={textGradientSelectId} className="text-[10px] text-slate-400 mb-1 block">
            Text Gradient
          </label>
          <select
            id={textGradientSelectId}
            value={styles.typography.textGradient}
            onChange={(e) =>
              setStyles({
                ...styles,
                typography: { ...styles.typography, textGradient: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">None (Solid Color)</option>
            <option value="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent">
              Brand Gold Shine
            </option>
            <option value="bg-gradient-to-r from-blue-400 via-slate-100 to-rose-400 bg-clip-text text-transparent">
              Patriotic Tristate
            </option>
            <option value="bg-gradient-to-r from-emerald-400 via-teal-200 to-emerald-500 bg-clip-text text-transparent">
              Grassroots Emerald
            </option>
          </select>
        </div>
      </div>

      {/* Line Height */}
      <div>
        <label htmlFor={lineHeightSelectId} className="text-[10px] text-slate-400 mb-1 block">
          Line Height
        </label>
        <select
          id={lineHeightSelectId}
          value={styles.typography.lineHeight}
          onChange={(e) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, lineHeight: e.target.value },
            })
          }
          className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
        >
          <option value="leading-relaxed">Relaxed Body (1.625)</option>
          <option value="leading-normal">Normal (1.5)</option>
          <option value="leading-snug">Snug (1.375)</option>
          <option value="leading-tight">Tight Headline (1.25)</option>
          <option value="leading-none">Flush None (1.0)</option>
          <option value="leading-loose">Loose Breathing (2.0)</option>
        </select>
      </div>

      {/* Text Color Swatches */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">Typography Color</span>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { color: 'text-foreground', label: 'Default Ink', dot: 'bg-white/40' },
            {
              color: 'text-navy-900 dark:text-navy-100',
              label: 'Civic Navy',
              dot: 'bg-blue-600',
            },
            {
              color: 'text-amber-600 dark:text-amber-400',
              label: 'Brand Gold',
              dot: 'bg-amber-500',
            },
            { color: 'text-muted-foreground', label: 'Subtle Muted', dot: 'bg-slate-500/80' },
            { color: 'text-white', label: 'High White', dot: 'bg-white/95' },
            {
              color: 'text-rose-600 dark:text-rose-400',
              label: 'Urgent Red',
              dot: 'bg-rose-500',
            },
            {
              color: 'text-emerald-700 dark:text-emerald-400',
              label: 'Success Green',
              dot: 'bg-emerald-500',
            },
          ].map((item) => {
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
                className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] transition-colors ${
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

      <div>
        <span className="text-[10px] text-slate-400 mb-1 block">Letter Spacing &amp; Casing</span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={letterSpacingSelectId} className="sr-only">
              Letter Spacing
            </label>
            <select
              id={letterSpacingSelectId}
              value={styles.typography.letterSpacing}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  typography: { ...styles.typography, letterSpacing: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
            >
              <option value="tracking-normal">Normal</option>
              <option value="tracking-wide">Wide (+0.025em)</option>
              <option value="tracking-wider">Wider (+0.05em)</option>
              <option value="tracking-tight">Tight (-0.025em)</option>
            </select>
          </div>
          <div>
            <label htmlFor={textTransformSelectId} className="sr-only">
              Text Transform
            </label>
            <select
              id={textTransformSelectId}
              value={styles.typography.textTransform}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  typography: {
                    ...styles.typography,
                    textTransform: e.target.value as typeof styles.typography.textTransform,
                  },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
            >
              <option value="none">Normal Casing</option>
              <option value="uppercase">ALL CAPS</option>
              <option value="capitalize">Capitalize Words</option>
              <option value="lowercase">all lowercase</option>
            </select>
          </div>
        </div>
      </div>

      {/* Text Decoration & Accents */}
      <div>
        <label htmlFor={textDecorationSelectId} className="text-[10px] text-slate-400 mb-1 block">
          Text Decoration &amp; Accents
        </label>
        <select
          id={textDecorationSelectId}
          value={styles.typography.textDecoration || ''}
          onChange={(e) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, textDecoration: e.target.value },
            })
          }
          className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
        >
          <option value="">None (Standard)</option>
          <option value="underline underline-offset-4 decoration-border">Subtle Underline</option>
          <option value="underline underline-offset-4 decoration-amber-500/60 decoration-2">
            Civic Gold Underline
          </option>
          <option value="underline underline-offset-4 decoration-blue-500/60 decoration-2">
            Navy Accent Underline
          </option>
          <option value="line-through decoration-rose-500/70">Strikethrough</option>
        </select>
      </div>

      <div>
        <label htmlFor={textShadowSelectId} className="text-[10px] text-slate-400 mb-1 block">
          Text Drop Shadow
        </label>
        <select
          id={textShadowSelectId}
          value={styles.typography.textShadow}
          onChange={(e) =>
            setStyles({
              ...styles,
              typography: { ...styles.typography, textShadow: e.target.value },
            })
          }
          className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
        >
          <option value="">None (Crisp Flat)</option>
          <option value="drop-shadow-sm">Subtle Soft (sm)</option>
          <option value="drop-shadow-md">High Contrast (md)</option>
          <option value="drop-shadow-lg">Dramatic Depth (lg)</option>
        </select>
      </div>

      {/* Font Style, Editorial Text Wrapping & Word Breaking */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label htmlFor={fontStyleSelectId} className="text-[10px] text-slate-400 mb-1 block">
            Font Posture / Style
          </label>
          <select
            id={fontStyleSelectId}
            value={styles.typography.fontStyle || 'normal'}
            onChange={(e) =>
              setStyles({
                ...styles,
                typography: {
                  ...styles.typography,
                  fontStyle: e.target.value as 'normal' | 'italic',
                },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="normal">Normal Upright</option>
            <option value="italic">Italic Emphasis</option>
          </select>
        </div>
        <div>
          <label htmlFor={textWrapSelectId} className="text-[10px] text-slate-400 mb-1 block">
            Text Wrapping &amp; Overflow
          </label>
          <select
            id={textWrapSelectId}
            value={styles.typography.textWrap || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                typography: { ...styles.typography, textWrap: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">Normal Flow</option>
            <option value="text-balance">Balanced Headlines (text-balance)</option>
            <option value="text-pretty">Editorial Pretty (text-pretty)</option>
            <option value="truncate">Single Line Truncate (truncate)</option>
            <option value="break-words">Break Words (break-words)</option>
          </select>
        </div>
        <div>
          <label htmlFor={wordBreakSelectId} className="text-[10px] text-slate-400 mb-1 block">
            Word Break Behavior
          </label>
          <select
            id={wordBreakSelectId}
            value={styles.typography.wordBreak || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                typography: { ...styles.typography, wordBreak: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">Default (Browser)</option>
            <option value="break-normal">Normal (break-normal)</option>
            <option value="break-words">Wrap Long Words (break-words)</option>
            <option value="break-all">Force Break Anywhere (break-all)</option>
            <option value="break-keep">Keep Words Whole (break-keep)</option>
          </select>
        </div>
        <div>
          <label htmlFor={textColumnsSelectId} className="text-[10px] text-slate-400 mb-1 block">
            Editorial Multi-Columns
          </label>
          <select
            id={textColumnsSelectId}
            value={styles.typography.textColumns || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                typography: { ...styles.typography, textColumns: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">Single Column (Standard)</option>
            <option value="columns-1 md:columns-2 gap-8">2 Newspaper Columns</option>
            <option value="columns-1 md:columns-3 gap-8">3 Editorial Columns</option>
            <option value="columns-1 sm:columns-2 lg:columns-4 gap-6">4 Magazine Columns</option>
          </select>
        </div>
        <div>
          <label htmlFor={fontSmoothingSelectId} className="text-[10px] text-slate-400 mb-1 block">
            Font Smoothing (Rendering)
          </label>
          <select
            id={fontSmoothingSelectId}
            value={styles.typography.fontSmoothing || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                typography: { ...styles.typography, fontSmoothing: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">Default (Subpixel)</option>
            <option value="antialiased">Antialiased (Crisp High-DPI)</option>
            <option value="subpixel-antialiased">Subpixel Antialiased</option>
          </select>
        </div>
      </div>
    </div>
  );
}
