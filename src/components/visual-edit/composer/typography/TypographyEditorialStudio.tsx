'use client';

import { Columns, FileText, Sparkles } from 'lucide-react';
import type {
  VisualComposerStyles,
  VisualComposerTypographyEditorialPreset,
} from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export const FONT_STYLE_OPTIONS = [
  { value: 'normal', label: 'Normal Upright' },
  { value: 'italic', label: 'Italic Emphasis' },
] as const;

export const TEXT_WRAP_OPTIONS = [
  { value: '', label: 'Normal Flow' },
  { value: 'text-balance', label: 'Balanced Headlines (text-balance)' },
  { value: 'text-pretty', label: 'Editorial Pretty (text-pretty)' },
  { value: 'truncate', label: 'Single Line Truncate (truncate)' },
  { value: 'break-words', label: 'Break Words (break-words)' },
] as const;

export const WORD_BREAK_OPTIONS = [
  { value: '', label: 'Default (Browser)' },
  { value: 'break-normal', label: 'Normal (break-normal)' },
  { value: 'break-words', label: 'Wrap Long Words (break-words)' },
  { value: 'break-all', label: 'Force Break Anywhere (break-all)' },
  { value: 'break-keep', label: 'Keep Words Whole (break-keep)' },
] as const;

export const TEXT_COLUMNS_OPTIONS = [
  { value: '', label: 'Single Column (Standard)' },
  { value: 'columns-1 md:columns-2 gap-8', label: '2 Newspaper Columns' },
  { value: 'columns-1 md:columns-3 gap-8', label: '3 Editorial Columns' },
  { value: 'columns-1 sm:columns-2 lg:columns-4 gap-6', label: '4 Magazine Columns' },
] as const;

export const FONT_SMOOTHING_OPTIONS = [
  { value: '', label: 'Default (Subpixel)' },
  { value: 'antialiased', label: 'Antialiased (Crisp High-DPI)' },
  { value: 'subpixel-antialiased', label: 'Subpixel Antialiased' },
] as const;

export const TYPOGRAPHY_EDITORIAL_PRESETS: readonly VisualComposerTypographyEditorialPreset[] = [
  {
    id: 'newspaper-columns',
    name: '2-Column Newspaper',
    description: 'Two editorial newspaper columns with balanced pretty flow and crisp antialiasing',
    badge: '2 Columns',
    apply: () => ({
      textColumns: 'columns-1 md:columns-2 gap-8',
      textWrap: 'text-pretty',
      fontStyle: 'normal',
      fontSmoothing: 'antialiased',
      wordBreak: 'break-normal',
    }),
  },
  {
    id: 'three-col-digest',
    name: '3-Column Digest',
    description:
      'Three desktop magazine columns ideal for multi-point newsletters and civic summaries',
    badge: '3 Columns',
    apply: () => ({
      textColumns: 'columns-1 md:columns-3 gap-8',
      textWrap: 'text-pretty',
      fontStyle: 'normal',
      fontSmoothing: 'antialiased',
      wordBreak: 'break-normal',
    }),
  },
  {
    id: 'balanced-headline',
    name: 'Balanced Headline',
    description: 'Single column with CSS text-balance to eliminate awkward orphan words in headers',
    badge: 'Headline',
    apply: () => ({
      textColumns: '',
      textWrap: 'text-balance',
      fontStyle: 'normal',
      fontSmoothing: 'antialiased',
      wordBreak: 'break-normal',
    }),
  },
  {
    id: 'italic-pullquote',
    name: 'Editorial Pullquote',
    description:
      'Single column with elegant italic posture and balanced flow for testimonial quotes',
    badge: 'Pullquote',
    apply: () => ({
      textColumns: '',
      textWrap: 'text-pretty',
      fontStyle: 'italic',
      fontSmoothing: 'antialiased',
      wordBreak: 'break-normal',
    }),
  },
  {
    id: 'reset-editorial',
    name: 'Reset Editorial',
    description:
      'Standard single column, normal flow, upright posture, and browser default smoothing',
    badge: 'Standard',
    apply: () => ({
      textColumns: '',
      textWrap: '',
      fontStyle: 'normal',
      fontSmoothing: '',
      wordBreak: '',
    }),
  },
] as const;

export interface TypographyEditorialStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  fontStyleSelectId?: string;
  textWrapSelectId?: string;
  wordBreakSelectId?: string;
  textColumnsSelectId?: string;
  fontSmoothingSelectId?: string;
}

export function TypographyEditorialStudio({
  styles,
  setStyles,
  fontStyleSelectId,
  textWrapSelectId,
  wordBreakSelectId = 'typography-word-break-select',
  textColumnsSelectId = 'typography-text-columns-select',
  fontSmoothingSelectId = 'typography-font-smoothing-select',
}: TypographyEditorialStudioProps) {
  const activeColumnsLabel =
    TEXT_COLUMNS_OPTIONS.find((o) => o.value === styles.typography.textColumns)?.label ||
    'Single Column';
  const activeWrapLabel =
    TEXT_WRAP_OPTIONS.find((o) => o.value === styles.typography.textWrap)?.label || 'Normal Flow';
  const activeSmoothingLabel =
    FONT_SMOOTHING_OPTIONS.find((o) => o.value === styles.typography.fontSmoothing)?.label ||
    'Default';

  return (
    <StudioSection title="Editorial Posture, Wrap & Columns" badge="Layout">
      <div className="space-y-4">
        {/* Live Multi-Column & Editorial Stage */}
        <div
          data-testid="typography-editorial-preview-card"
          className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm p-3 shadow-inner"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Columns className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Live Editorial Flow Stage
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Flow &amp; Columns Render</span>
          </div>

          <div className="bg-black/20 dark:bg-black/40 rounded-md border border-white/10 p-3 max-h-36 overflow-y-auto">
            <div
              data-testid="typography-editorial-preview-text"
              className={`text-xs text-foreground/90 transition-all duration-200 ${
                styles.typography.textColumns || ''
              } ${styles.typography.textWrap || ''} ${styles.typography.wordBreak || ''} ${
                styles.typography.fontStyle === 'italic' ? 'italic' : 'not-italic'
              } ${styles.typography.fontSmoothing || ''}`}
            >
              <p className="mb-2">
                Grassroots democracy thrives when community members actively participate,
                collaborate, and advocate for equitable representation across Fair Oaks, Carmichael,
                and Sacramento County.
              </p>
              <p>
                Engaging neighbors, organizing local rallies, and keeping voters informed builds
                sustainable civic power from the ground up for our community.
              </p>
            </div>
          </div>

          {/* Active Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
              <Columns className="w-2.5 h-2.5 text-amber-500" />
              {activeColumnsLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
              <FileText className="w-2.5 h-2.5 text-blue-400" />
              {activeWrapLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
              Posture: {styles.typography.fontStyle === 'italic' ? 'Italic' : 'Normal Upright'}
            </span>
            {styles.typography.fontSmoothing && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                {activeSmoothingLabel}
              </span>
            )}
          </div>
        </div>

        {/* 1-Click Editorial Presets */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              1-Click Editorial Presets
            </span>
            <span className="text-[10px] text-slate-400">Layout Profiles</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {TYPOGRAPHY_EDITORIAL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-testid={`editorial-preset-${preset.id}`}
                onClick={() =>
                  setStyles((prev) => ({
                    ...prev,
                    typography: {
                      ...prev.typography,
                      ...preset.apply(),
                    },
                  }))
                }
                className="group p-2 rounded-md border border-border/40 bg-card/40 hover:bg-card hover:border-amber-500/40 text-left transition-all"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-medium text-foreground group-hover:text-accent-gold transition-colors">
                    {preset.name}
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-white/5 text-slate-400 border border-white/10">
                    {preset.badge}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Granular Dropdowns */}
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
    </StudioSection>
  );
}
