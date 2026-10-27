'use client';

import { Columns, Layout, Maximize2, MoveHorizontal } from 'lucide-react';
import type { VisualComposerSectionLayoutPreset, VisualComposerStyles } from '@/types/unified';
import { VC_COLUMN_PRESETS } from '../constants';
import { StudioSection, StudioSelect, StudioToggle } from '../ui';

export const SECTION_LAYOUT_PRESETS: readonly VisualComposerSectionLayoutPreset[] = [
  {
    id: 'hero-showcase',
    name: 'Hero Showcase Split',
    description: 'Full width background with 7XL container, 75vh min-height and 2-column split',
    badge: 'Hero 50/50',
    apply: () => ({
      rowLayout: 'full-width-bg',
      containerWidth: 'max-w-7xl mx-auto px-6',
      minHeight: 'min-h-[75vh] flex flex-col justify-center',
      paddingY: 'py-16',
      columns: 'grid grid-cols-1 md:grid-cols-2',
      columnGap: 'gap-8',
      verticalAlign: 'items-center',
    }),
  },
  {
    id: 'three-col-cards',
    name: '3-Column Civic Cards',
    description: '7XL container width, standard breathing room and 3 equal cards grid',
    badge: '3 Columns',
    apply: () => ({
      rowLayout: '',
      containerWidth: 'max-w-7xl mx-auto px-6',
      minHeight: '',
      paddingY: 'py-16',
      columns: 'grid grid-cols-1 md:grid-cols-3',
      columnGap: 'gap-6',
      verticalAlign: 'items-stretch',
      equalHeight: true,
    }),
  },
  {
    id: 'editorial-focused',
    name: 'Focused Editorial Reader',
    description: 'Standard 4XL container, auto height, py-8 and clean single column reading flow',
    badge: 'Editorial',
    apply: () => ({
      rowLayout: '',
      containerWidth: 'max-w-4xl mx-auto px-4',
      minHeight: '',
      paddingY: 'py-8',
      columns: '',
      columnGap: 'gap-4',
      verticalAlign: 'items-start',
    }),
  },
  {
    id: 'asymmetric-spotlight',
    name: 'Asymmetric Left Spotlight',
    description: '66% wide primary column with 33% sidebar for actions and signups',
    badge: '66% / 33%',
    apply: () => ({
      rowLayout: 'full-width-bg',
      containerWidth: 'max-w-7xl mx-auto px-6',
      minHeight: '',
      paddingY: 'py-16',
      columns: 'grid grid-cols-1 md:grid-cols-3 [&>*:first-child]:md:col-span-2',
      columnGap: 'gap-8',
      verticalAlign: 'items-start',
    }),
  },
  {
    id: 'reset-layout',
    name: 'Reset Layout',
    description: 'Default boxed container, 4XL editorial width, auto height and single column',
    badge: 'Default',
    apply: () => ({
      rowLayout: '',
      containerWidth: 'max-w-4xl mx-auto px-4',
      minHeight: '',
      paddingY: 'py-8',
      paddingX: 'px-4',
      marginY: '',
      marginX: '',
      columns: '',
      columnGap: 'gap-6',
      verticalAlign: 'items-start',
      equalHeight: false,
      reverseMobile: false,
    }),
  },
] as const;

export interface SectionLayoutStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  showStructure?: boolean;
  showSpacing?: boolean;
  showColumns?: boolean;
  sectionWidthSelectId?: string;
  sectionPaddingYSelectId?: string;
  sectionPaddingXSelectId?: string;
  sectionMarginYSelectId?: string;
  sectionMarginXSelectId?: string;
  sectionMinHeightSelectId?: string;
  sectionRowLayoutSelectId?: string;
  sectionColumnsSelectId?: string;
  sectionGapSelectId?: string;
  sectionAlignSelectId?: string;
  sectionJustifyContentSelectId?: string;
}

export function SectionLayoutStudio({
  styles,
  setStyles,
  showStructure = true,
  showSpacing = true,
  showColumns = true,
  sectionWidthSelectId,
  sectionPaddingYSelectId,
  sectionPaddingXSelectId,
  sectionMarginYSelectId,
  sectionMarginXSelectId,
  sectionMinHeightSelectId,
  sectionRowLayoutSelectId = 'section-row-layout',
  sectionColumnsSelectId,
  sectionGapSelectId,
  sectionAlignSelectId,
  sectionJustifyContentSelectId,
}: SectionLayoutStudioProps) {
  // Determine wireframe columns preview configuration
  const getWireframeColumns = () => {
    const colStr = styles.section.columns || '';
    if (colStr.includes('md:col-span-2') && colStr.includes('first-child')) {
      return [
        { label: 'Primary (66%)', span: 'col-span-2' },
        { label: 'Sidebar (33%)', span: 'col-span-1' },
      ];
    }
    if (colStr.includes('md:col-span-2') && colStr.includes('last-child')) {
      return [
        { label: 'Sidebar (33%)', span: 'col-span-1' },
        { label: 'Primary (66%)', span: 'col-span-2' },
      ];
    }
    if (colStr.includes('lg:grid-cols-4') || colStr.includes('sm:grid-cols-2')) {
      return [
        { label: 'Col 1 (25%)', span: 'col-span-1' },
        { label: 'Col 2 (25%)', span: 'col-span-1' },
        { label: 'Col 3 (25%)', span: 'col-span-1' },
        { label: 'Col 4 (25%)', span: 'col-span-1' },
      ];
    }
    if (colStr.includes('md:grid-cols-3')) {
      return [
        { label: 'Col 1 (33%)', span: 'col-span-1' },
        { label: 'Col 2 (33%)', span: 'col-span-1' },
        { label: 'Col 3 (33%)', span: 'col-span-1' },
      ];
    }
    if (colStr.includes('md:grid-cols-2')) {
      return [
        { label: 'Col 1 (50%)', span: 'col-span-1' },
        { label: 'Col 2 (50%)', span: 'col-span-1' },
      ];
    }
    return [{ label: 'Single Column (100%)', span: 'col-span-1' }];
  };

  const wireframeSlots = getWireframeColumns();

  return (
    <>
      {/* ── 1. Canvas & Sizing ─────────────────────────────────────────── */}
      {showStructure && (
        <StudioSection
          title="Canvas & Container Structure"
          badge="Layout"
          description="Configure row layout stretching, maximum responsive width, and min-height behavior."
        >
          <div className="space-y-4">
            {/* Live Section Layout Wireframe Visualizer */}
            <div
              data-testid="section-layout-preview-stage"
              className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm p-3 shadow-inner"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Layout className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                    Live Section Layout Wireframe
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">Geometry Stage</span>
              </div>

              {/* Wireframe Container Simulator */}
              <div className="relative rounded-md border border-white/10 bg-black/30 p-2.5">
                <div
                  className={`grid gap-2 ${
                    wireframeSlots.length === 1
                      ? 'grid-cols-1'
                      : wireframeSlots.length === 2
                        ? 'grid-cols-2'
                        : wireframeSlots.length === 3
                          ? 'grid-cols-3'
                          : 'grid-cols-4'
                  }`}
                >
                  {wireframeSlots.map((slot) => (
                    <div
                      key={slot.label}
                      className="rounded border border-amber-500/30 bg-amber-500/5 p-2 flex flex-col justify-between min-h-16 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="h-1.5 w-1/2 bg-amber-500/30 rounded" />
                        <div className="h-1.5 w-3/4 bg-white/10 rounded" />
                        <div className="h-1.5 w-2/3 bg-white/10 rounded" />
                      </div>
                      <span className="text-[9px] font-mono text-accent-gold mt-2 block">
                        {slot.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Badges */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                  <Maximize2 className="w-2.5 h-2.5 text-amber-500" />
                  Mode: {styles.section.rowLayout || 'Boxed'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                  <MoveHorizontal className="w-2.5 h-2.5 text-blue-400" />
                  Width:{' '}
                  {styles.section.containerWidth?.includes('7xl')
                    ? '7XL'
                    : styles.section.containerWidth?.includes('5xl')
                      ? '5XL'
                      : styles.section.containerWidth?.includes('w-full')
                        ? 'Full Bleed'
                        : '4XL'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                  <Columns className="w-2.5 h-2.5 text-emerald-400" />
                  Grid: {styles.section.columns ? `${wireframeSlots.length} Cols` : 'Single Col'}
                </span>
              </div>
            </div>

            {/* 1-Click Section Layout Presets */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  1-Click Section Layout Presets
                </span>
                <span className="text-[10px] text-slate-400">Architecture Profiles</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {SECTION_LAYOUT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`layout-preset-${preset.id}`}
                    onClick={() =>
                      setStyles((prev) => ({
                        ...prev,
                        section: {
                          ...prev.section,
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

            {/* Granular Canvas Selects */}
            <div className="grid grid-cols-2 gap-2">
              <StudioSelect
                id={sectionRowLayoutSelectId}
                label="Row Canvas Mode"
                value={styles.section.rowLayout || ''}
                onChange={(val) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, rowLayout: val },
                  })
                }
                options={[
                  { value: '', label: 'Boxed Container (Default)' },
                  { value: 'full-width-bg', label: 'Full Width Background' },
                  { value: 'full-width-content', label: 'Stretched Full Canvas (Edge-to-Edge)' },
                  { value: 'screen-height', label: 'Screen Height Hero (100vh)' },
                ]}
              />
              <StudioSelect
                id={sectionWidthSelectId}
                label="Section Container Width"
                value={styles.section.containerWidth}
                onChange={(val) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, containerWidth: val },
                  })
                }
                options={[
                  { value: 'max-w-4xl mx-auto px-4', label: 'Standard Editorial (4XL - 896px)' },
                  { value: 'max-w-5xl mx-auto px-4', label: 'Wide Content (5XL - 1024px)' },
                  { value: 'max-w-7xl mx-auto px-6', label: 'Ultra Wide Showcase (7XL - 1280px)' },
                  {
                    value: 'max-w-2xl mx-auto px-4',
                    label: 'Compact Focused Reader (2XL - 672px)',
                  },
                  { value: 'w-full px-4', label: 'Full Bleed Fluid (100% Width)' },
                ]}
              />
            </div>

            <StudioSelect
              id={sectionMinHeightSelectId}
              label="Section Viewport & Min Height"
              value={styles.section.minHeight}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, minHeight: val },
                })
              }
              options={[
                { value: '', label: 'Auto (Content Derived)' },
                {
                  value: 'min-h-[250px] flex flex-col justify-center',
                  label: 'Compact Band (min-h-[250px])',
                },
                {
                  value: 'min-h-[400px] flex flex-col justify-center',
                  label: 'Medium Section (min-h-[400px])',
                },
                {
                  value: 'min-h-[50vh] flex flex-col justify-center',
                  label: 'Half Viewport (min-h-[50vh])',
                },
                {
                  value: 'min-h-[75vh] flex flex-col justify-center',
                  label: 'Hero Prominence (min-h-[75vh])',
                },
                {
                  value: 'min-h-screen flex flex-col justify-center',
                  label: 'Full Viewport Screen (min-h-screen)',
                },
              ]}
            />
          </div>
        </StudioSection>
      )}

      {/* ── 2. Spacing Rhythm ──────────────────────────────────────────── */}
      {showSpacing && (
        <StudioSection
          title="Spacing & Geometry"
          badge="Box"
          description="Rhythm controls for inner padding and outer section margins."
        >
          <div className="grid grid-cols-2 gap-2">
            <StudioSelect
              id={sectionPaddingYSelectId}
              label="Vertical Section Padding"
              value={styles.section.paddingY}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, paddingY: val },
                })
              }
              options={[
                { value: 'py-8', label: 'Standard Breathing Room (py-8 / 32px)' },
                { value: 'py-16', label: 'Generous Space (py-16 / 64px)' },
                { value: 'py-24', label: 'Hero Spotlight (py-24 / 96px)' },
                { value: 'py-4', label: 'Compact Spacing (py-4 / 16px)' },
                { value: 'py-0', label: 'Flush Edge (py-0 / 0px)' },
              ]}
            />
            <StudioSelect
              id={sectionPaddingXSelectId}
              label="Horizontal Padding"
              value={styles.section.paddingX}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, paddingX: val },
                })
              }
              options={[
                { value: 'px-4', label: 'Standard (px-4 / 16px)' },
                { value: 'px-6', label: 'Spacious (px-6 / 24px)' },
                { value: 'px-8', label: 'Generous (px-8 / 32px)' },
                { value: 'px-12', label: 'Deep Inset (px-12 / 48px)' },
                { value: 'px-0', label: 'Edge to Edge (px-0)' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StudioSelect
              id={sectionMarginYSelectId}
              label="Vertical Section Margin"
              value={styles.section.marginY || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, marginY: val },
                })
              }
              options={[
                { value: '', label: 'Default (Flush / None)' },
                { value: 'my-4', label: 'Compact (my-4 / 16px)' },
                { value: 'my-8', label: 'Standard Rhythm (my-8 / 32px)' },
                { value: 'my-12', label: 'Spacious Rhythm (my-12 / 48px)' },
                { value: 'my-16', label: 'Deep Separation (my-16 / 64px)' },
                { value: 'my-24', label: 'Dramatic Separation (my-24 / 96px)' },
              ]}
            />
            <StudioSelect
              id={sectionMarginXSelectId}
              label="Horizontal Margin / Float"
              value={styles.section.marginX || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, marginX: val },
                })
              }
              options={[
                { value: '', label: 'Default (None / Edge)' },
                { value: 'mx-auto', label: 'Auto Center (mx-auto)' },
                { value: 'mx-4', label: 'Compact Inset (mx-4 / 16px)' },
                { value: 'mx-8', label: 'Medium Floating (mx-8 / 32px)' },
                { value: 'mx-12', label: 'Spacious Floating (mx-12 / 48px)' },
                { value: 'mx-16', label: 'Island Card (mx-16 / 64px)' },
              ]}
            />
          </div>
        </StudioSection>
      )}

      {/* ── 3. Multi-Column Grid System ─────────────────────────────────── */}
      {showColumns && (
        <StudioSection
          title="Row Multi-Column Layout"
          badge="Grid"
          description="Responsive multi-column arrangements, alignment, and column gaps."
        >
          {/* 1-Click Column Ratio Presets */}
          <div className="grid grid-cols-4 gap-1.5">
            {VC_COLUMN_PRESETS.map((preset) => {
              const isSelected = styles.section.columns === preset.value;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    setStyles({
                      ...styles,
                      section: { ...styles.section, columns: preset.value },
                    })
                  }
                  className={`flex flex-col items-center justify-between p-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'border-accent-gold bg-accent-gold/20 text-accent-gold shadow-xs'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                  title={`Set columns to ${preset.label}`}
                  aria-label={`Column layout ${preset.label}`}
                >
                  <div className="w-full flex gap-0.5 h-2.5 mb-1">
                    {preset.cols.map((col) => (
                      <div
                        key={`${preset.id}-${col.id}`}
                        style={{ width: col.width }}
                        className={`h-full rounded-2xs ${
                          isSelected ? 'bg-accent-gold' : 'bg-white/30'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="truncate w-full text-center text-[9px]">{preset.label}</span>
                </button>
              );
            })}
          </div>

          <StudioSelect
            id={sectionColumnsSelectId}
            label="Columns System"
            value={styles.section.columns}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, columns: val },
              })
            }
            options={[
              { value: '', label: 'Single Column (Standard Container)' },
              { value: 'grid grid-cols-1 md:grid-cols-2', label: '2 Columns (50/50 Split)' },
              { value: 'grid grid-cols-1 md:grid-cols-3', label: '3 Columns (33/33/33)' },
              {
                value: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
                label: '4 Columns (25% each)',
              },
              {
                value: 'grid grid-cols-1 md:grid-cols-3 [&>*:first-child]:md:col-span-2',
                label: 'Asymmetric Left Focus (66% / 33%)',
              },
              {
                value: 'grid grid-cols-1 md:grid-cols-3 [&>*:last-child]:md:col-span-2',
                label: 'Asymmetric Right Focus (33% / 66%)',
              },
            ]}
          />

          {Boolean(styles.section.columns) && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <StudioSelect
                  id={sectionGapSelectId}
                  label="Column Gap Spacing"
                  value={styles.section.columnGap}
                  onChange={(val) =>
                    setStyles({
                      ...styles,
                      section: { ...styles.section, columnGap: val },
                    })
                  }
                  options={[
                    { value: 'gap-4', label: 'Compact Spacing (gap-4 / 16px)' },
                    { value: 'gap-6', label: 'Standard Rhythm (gap-6 / 24px)' },
                    { value: 'gap-8', label: 'Generous Separation (gap-8 / 32px)' },
                    { value: 'gap-12', label: 'Expansive Columns (gap-12 / 48px)' },
                    { value: 'gap-0', label: 'Flush Columns (gap-0 / 0px)' },
                  ]}
                />
                <StudioSelect
                  id="section-row-gap-select"
                  label="Row Gap Spacing"
                  value={styles.section.rowGap || ''}
                  onChange={(val) =>
                    setStyles({
                      ...styles,
                      section: { ...styles.section, rowGap: val },
                    })
                  }
                  options={[
                    { value: '', label: 'Inherit / Same as Column' },
                    { value: 'gap-y-4', label: 'Compact (16px)' },
                    { value: 'gap-y-6', label: 'Standard (24px)' },
                    { value: 'gap-y-8', label: 'Spacious (32px)' },
                    { value: 'gap-y-12', label: 'Expansive (48px)' },
                    { value: 'gap-y-0', label: 'Flush (0px)' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StudioSelect
                  id={sectionAlignSelectId}
                  label="Column Vertical Align"
                  value={styles.section.verticalAlign}
                  onChange={(val) =>
                    setStyles({
                      ...styles,
                      section: { ...styles.section, verticalAlign: val },
                    })
                  }
                  options={[
                    { value: 'items-start', label: 'Top Aligned (items-start)' },
                    { value: 'items-center', label: 'Center Aligned (items-center)' },
                    { value: 'items-end', label: 'Bottom Aligned (items-end)' },
                    { value: 'items-stretch', label: 'Stretch Full Height (items-stretch)' },
                  ]}
                />
                <StudioSelect
                  id={sectionJustifyContentSelectId}
                  label="Column Justification"
                  size="xs"
                  value={styles.section.justifyContent || ''}
                  onChange={(val) =>
                    setStyles({
                      ...styles,
                      section: { ...styles.section, justifyContent: val },
                    })
                  }
                  options={[
                    { value: '', label: 'Default (Start)' },
                    { value: 'justify-start', label: 'Left / Start' },
                    { value: 'justify-center', label: 'Center Distribution' },
                    { value: 'justify-between', label: 'Space Between Columns' },
                    { value: 'justify-around', label: 'Space Around' },
                    { value: 'justify-end', label: 'Right / End' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StudioToggle
                  label="Equal Height"
                  description="Stretch column heights"
                  active={Boolean(styles.section.equalHeight)}
                  statusLabel={styles.section.equalHeight ? 'ON' : 'OFF'}
                  onToggle={() =>
                    setStyles({
                      ...styles,
                      section: {
                        ...styles.section,
                        equalHeight: !styles.section.equalHeight,
                      },
                    })
                  }
                />
                <StudioToggle
                  label="Reverse Mobile"
                  description="Invert column order"
                  active={Boolean(styles.section.reverseMobile)}
                  activeTone="gold"
                  statusLabel={styles.section.reverseMobile ? 'ON' : 'OFF'}
                  onToggle={() =>
                    setStyles({
                      ...styles,
                      section: {
                        ...styles.section,
                        reverseMobile: !styles.section.reverseMobile,
                      },
                    })
                  }
                />
              </div>
            </>
          )}
        </StudioSection>
      )}
    </>
  );
}
