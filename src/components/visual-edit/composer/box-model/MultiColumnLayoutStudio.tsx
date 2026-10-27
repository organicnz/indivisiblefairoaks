'use client';

import { Columns3 } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export interface MultiColumnLayoutStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  layoutColumnsSelectId?: string;
  layoutMaxWidthSelectId?: string;
  layoutGapSelectId?: string;
  layoutAlignSelectId?: string;
  layoutJustifySelectId?: string;
}

const QUICK_GRID_PRESETS = [
  { id: '1col', label: '1 Col', value: '', preview: 'w-full' },
  {
    id: '2col-equal',
    label: '50 / 50',
    value: 'grid grid-cols-1 md:grid-cols-2 gap-6',
    preview: 'grid grid-cols-2 gap-1',
  },
  {
    id: '2col-asym-66',
    label: '66 / 33',
    value: 'grid grid-cols-1 md:grid-cols-3 gap-6 [&>*:first-child]:md:col-span-2',
    preview: 'grid grid-cols-3 gap-1 [&>*:first-child]:col-span-2',
  },
  {
    id: '2col-asym-33',
    label: '33 / 66',
    value: 'grid grid-cols-1 md:grid-cols-3 gap-6 [&>*:last-child]:md:col-span-2',
    preview: 'grid grid-cols-3 gap-1 [&>*:last-child]:col-span-2',
  },
  {
    id: '3col-equal',
    label: '33 / 33 / 33',
    value: 'grid grid-cols-1 md:grid-cols-3 gap-6',
    preview: 'grid grid-cols-3 gap-1',
  },
  {
    id: '4col-equal',
    label: '4 Col (25%)',
    value: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
    preview: 'grid grid-cols-4 gap-1',
  },
] as const;

export function MultiColumnLayoutStudio({
  styles,
  setStyles,
  layoutColumnsSelectId = 'layout-columns-select',
  layoutMaxWidthSelectId = 'layout-max-width-select',
  layoutGapSelectId = 'layout-gap-select',
  layoutAlignSelectId = 'layout-align-select',
  layoutJustifySelectId = 'layout-justify-select',
}: MultiColumnLayoutStudioProps) {
  return (
    <StudioSection
      title="Layout & Multi-Columns"
      badge="Multi-Col"
      description="Configure responsive column grids, gutters, max widths, and auto-stacking."
      action={<Columns3 size={13} className="text-accent-gold" />}
    >
      {/* 1-Click Column Layout Presets */}
      <div className="mb-3 space-y-1.5">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          1-Click Column Presets
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {QUICK_GRID_PRESETS.map((preset) => {
            const isSelected = styles.layout.columns === preset.value;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  setStyles({
                    ...styles,
                    layout: { ...styles.layout, columns: preset.value },
                  })
                }
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[11px] font-bold transition-all ${
                  isSelected
                    ? 'border-accent-gold/60 bg-accent-gold/20 text-accent-gold shadow-sm'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className={`w-full h-3 mb-1.5 rounded ${preset.preview}`}>
                  {preset.id === '1col' ? (
                    <div className="h-full bg-white/20 rounded-xs" />
                  ) : preset.id === '4col-equal' ? (
                    <>
                      <div className="h-full bg-white/20 rounded-xs" />
                      <div className="h-full bg-white/20 rounded-xs" />
                      <div className="h-full bg-white/20 rounded-xs" />
                      <div className="h-full bg-white/20 rounded-xs" />
                    </>
                  ) : preset.id.includes('3col') ? (
                    <>
                      <div className="h-full bg-white/20 rounded-xs" />
                      <div className="h-full bg-white/20 rounded-xs" />
                      <div className="h-full bg-white/20 rounded-xs" />
                    </>
                  ) : (
                    <>
                      <div className="h-full bg-white/20 rounded-xs" />
                      <div className="h-full bg-white/20 rounded-xs" />
                    </>
                  )}
                </div>
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <StudioSelect
          id={layoutColumnsSelectId}
          label="Columns Grid"
          value={styles.layout.columns}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, columns: val },
            })
          }
          options={[
            { value: '', label: 'Full Width (1 Col)' },
            { value: 'grid grid-cols-1 md:grid-cols-2 gap-6', label: '2 Columns (50/50)' },
            { value: 'grid grid-cols-1 md:grid-cols-3 gap-6', label: '3 Columns (33/33/33)' },
            {
              value: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
              label: '4 Columns (25% each)',
            },
            {
              value: 'grid grid-cols-1 md:grid-cols-3 gap-6 [&>*:first-child]:md:col-span-2',
              label: 'Asymmetric (66% / 33%)',
            },
            {
              value: 'grid grid-cols-1 md:grid-cols-3 gap-6 [&>*:last-child]:md:col-span-2',
              label: 'Asymmetric (33% / 66%)',
            },
          ]}
        />
        <StudioSelect
          id={layoutMaxWidthSelectId}
          label="Container Width"
          value={styles.layout.maxWidth}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, maxWidth: val },
            })
          }
          options={[
            { value: '', label: 'Default (Inherit)' },
            { value: 'max-w-2xl mx-auto', label: 'Compact (2XL)' },
            { value: 'max-w-4xl mx-auto', label: 'Standard (4XL)' },
            { value: 'max-w-6xl mx-auto', label: 'Wide Canvas (6XL)' },
            { value: 'w-full', label: 'Full Bleed (100%)' },
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StudioSelect
          id={layoutGapSelectId}
          label="Column Gap"
          value={styles.layout.gap || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, gap: val },
            })
          }
          options={[
            { value: '', label: 'Default Gap' },
            { value: 'gap-0', label: 'None (0px)' },
            { value: 'gap-2', label: 'Tight (8px)' },
            { value: 'gap-4', label: 'Compact (16px)' },
            { value: 'gap-6', label: 'Standard (24px)' },
            { value: 'gap-8', label: 'Spacious (32px)' },
            { value: 'gap-12', label: 'Loose (48px)' },
          ]}
        />
        <StudioSelect
          id={layoutAlignSelectId}
          label="Item Alignment"
          value={styles.layout.alignItems}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, alignItems: val },
            })
          }
          options={[
            { value: '', label: 'Inherit' },
            { value: 'items-start', label: 'Top' },
            { value: 'items-center', label: 'Center' },
            { value: 'items-end', label: 'Bottom' },
            { value: 'items-stretch', label: 'Stretch' },
          ]}
        />
        <StudioSelect
          id={layoutJustifySelectId}
          label="Distribution"
          value={styles.layout.justifyContent}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, justifyContent: val },
            })
          }
          options={[
            { value: '', label: 'Inherit' },
            { value: 'justify-start', label: 'Start' },
            { value: 'justify-center', label: 'Center' },
            { value: 'justify-between', label: 'Between' },
            { value: 'justify-around', label: 'Around' },
            { value: 'justify-end', label: 'End' },
          ]}
        />
      </div>
    </StudioSection>
  );
}
