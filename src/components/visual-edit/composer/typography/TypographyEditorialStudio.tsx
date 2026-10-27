'use client';

import type { VisualComposerStyles } from '@/types/unified';
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
  return (
    <StudioSection title="Editorial Posture, Wrap & Columns" badge="Layout">
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
    </StudioSection>
  );
}
