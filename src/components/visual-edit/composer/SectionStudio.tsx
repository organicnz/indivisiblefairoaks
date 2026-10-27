'use client';

import { Eye, EyeOff } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';
import { VC_COLUMN_PRESETS } from './constants';
import {
  ColorSwatchPicker,
  StudioInput,
  StudioSection,
  StudioSelect,
  StudioToggle,
  ThemeModeSelector,
} from './ui';

export interface SectionStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  sectionWidthSelectId?: string;
  sectionPaddingYSelectId?: string;
  sectionPaddingXSelectId?: string;
  sectionMarginYSelectId?: string;
  sectionMarginXSelectId?: string;
  sectionMinHeightSelectId?: string;
  sectionBgSelectId?: string;
  bgGradientSelectId?: string;
  sectionPatternSelectId?: string;
  sectionDividerSelectId?: string;
  sectionTopDividerSelectId?: string;
  sectionBottomDividerSelectId?: string;
  sectionOverflowSelectId?: string;
  sectionZIndexSelectId?: string;
  sectionColumnsSelectId?: string;
  sectionGapSelectId?: string;
  sectionAlignSelectId?: string;
  sectionJustifyContentSelectId?: string;
  sectionRadiusSelectId?: string;
  sectionShadowSelectId?: string;
  sectionBackdropBlurSelectId?: string;
  sectionBorderSelectId?: string;
  sectionBorderColorSelectId?: string;
  sectionOverlaySelectId?: string;
  sectionBgAttachmentSelectId?: string;
  sectionBgPositionSelectId?: string;
  sectionBgSizeSelectId?: string;
  sectionBgRepeatSelectId?: string;
  sectionAnchorIdInputId?: string;
  sectionCustomClassesInputId?: string;
  sectionBgBlendModeSelectId?: string;
  sectionInnerShadowSelectId?: string;
  sectionRowLayoutSelectId?: string;
  sectionDividerColorSelectId?: string;
  sectionCustomStyleInputId?: string;
  sectionThemeModeSelectId?: string;
  compiledClassNames?: string;
}

export function SectionStudio({
  styles,
  setStyles,
  sectionWidthSelectId,
  sectionPaddingYSelectId,
  sectionPaddingXSelectId,
  sectionMarginYSelectId,
  sectionMarginXSelectId,
  sectionMinHeightSelectId,
  sectionBgSelectId,
  bgGradientSelectId,
  sectionPatternSelectId,
  sectionDividerSelectId,
  sectionTopDividerSelectId,
  sectionBottomDividerSelectId,
  sectionOverflowSelectId,
  sectionZIndexSelectId,
  sectionColumnsSelectId,
  sectionGapSelectId,
  sectionAlignSelectId,
  sectionJustifyContentSelectId,
  sectionRadiusSelectId,
  sectionShadowSelectId,
  sectionBackdropBlurSelectId,
  sectionBorderSelectId,
  sectionBorderColorSelectId,
  sectionOverlaySelectId,
  sectionBgAttachmentSelectId,
  sectionBgPositionSelectId,
  sectionBgSizeSelectId,
  sectionBgRepeatSelectId,
  sectionAnchorIdInputId,
  sectionCustomClassesInputId,
  sectionBgBlendModeSelectId = 'section-bg-blend-mode',
  sectionInnerShadowSelectId = 'section-inner-shadow',
  sectionRowLayoutSelectId = 'section-row-layout',
  sectionDividerColorSelectId = 'section-divider-color',
  sectionCustomStyleInputId = 'section-custom-style-input',
  sectionThemeModeSelectId = 'section-theme-mode-select',
  compiledClassNames,
}: SectionStudioProps) {
  return (
    <div className="space-y-5">
      {/* ── 1. Canvas & Sizing ─────────────────────────────────────────── */}
      <StudioSection
        title="Canvas & Container Structure"
        badge="Layout"
        description="Configure row layout stretching, maximum responsive width, and min-height behavior."
      >
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
              { value: 'max-w-2xl mx-auto px-4', label: 'Compact Focused Reader (2XL - 672px)' },
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
      </StudioSection>

      {/* ── 2. Spacing Rhythm ──────────────────────────────────────────── */}
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

      {/* ── 3. Multi-Column Grid System ─────────────────────────────────── */}
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
          label="Column Ratio Preset"
          value={styles.section.columns}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, columns: val },
            })
          }
          options={[
            { value: '', label: 'Single Column (Full Width)' },
            { value: 'grid grid-cols-1 md:grid-cols-2', label: '2 Equal Columns (50 / 50)' },
            { value: 'grid grid-cols-1 md:grid-cols-3', label: '3 Columns (33 / 33 / 33)' },
            {
              value: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
              label: '4 Columns (25 / 25 / 25 / 25)',
            },
            {
              value: 'grid grid-cols-1 md:grid-cols-3 [&>*:first-child]:md:col-span-2',
              label: 'Asymmetric Main + Sidebar (66% / 33%)',
            },
            {
              value: 'grid grid-cols-1 md:grid-cols-3 [&>*:last-child]:md:col-span-2',
              label: 'Asymmetric Sidebar + Main (33% / 66%)',
            },
            {
              value: 'grid grid-cols-1 md:grid-cols-4 [&>*:nth-child(2)]:md:col-span-2',
              label: 'Three Column Focus (25% / 50% / 25%)',
            },
            {
              value: 'grid grid-cols-1 md:grid-cols-4 [&>*:first-child]:md:col-span-3',
              label: 'Dominant Feature + Rail (75% / 25%)',
            },
            {
              value: 'grid grid-cols-1 md:grid-cols-4 [&>*:last-child]:md:col-span-3',
              label: 'Rail + Dominant Feature (25% / 75%)',
            },
            {
              value: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
              label: '5 Gallery Columns (20% x 5)',
            },
          ]}
        />

        {styles.section.columns && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <StudioSelect
                id={sectionGapSelectId}
                label="Column Gap"
                size="xs"
                value={styles.section.columnGap}
                onChange={(val) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, columnGap: val },
                  })
                }
                options={[
                  { value: 'gap-0', label: 'Flush (gap-0)' },
                  { value: 'gap-4', label: 'Compact (gap-4)' },
                  { value: 'gap-8', label: 'Standard (gap-8)' },
                  { value: 'gap-12', label: 'Generous (gap-12)' },
                  { value: 'gap-16', label: 'Spacious (gap-16)' },
                ]}
              />
              <StudioSelect
                id={sectionAlignSelectId}
                label="Vertical Alignment"
                size="xs"
                value={styles.section.verticalAlign}
                onChange={(val) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, verticalAlign: val },
                  })
                }
                options={[
                  { value: 'items-start', label: 'Top Aligned' },
                  { value: 'items-center', label: 'Middle Centered' },
                  { value: 'items-end', label: 'Bottom Aligned' },
                  { value: 'items-stretch', label: 'Stretch Equal Height' },
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
                    section: { ...styles.section, equalHeight: !styles.section.equalHeight },
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
                    section: { ...styles.section, reverseMobile: !styles.section.reverseMobile },
                  })
                }
              />
            </div>
          </>
        )}
      </StudioSection>

      {/* ── 4. Theme & Atmospheric Overlays ────────────────────────────── */}
      <StudioSection
        title="Theme, Atmosphere & Background"
        badge="Tone"
        description="Palettes, gradients, textures, and dark/light mode overrides."
      >
        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={sectionBgSelectId}
            label="Section Background Theme"
            value={styles.section.background}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: {
                  ...styles.section,
                  background: val,
                  bgGradient: '',
                  pattern: '',
                },
              })
            }
            options={[
              { value: 'bg-transparent', label: 'Transparent (Default)' },
              { value: 'bg-card text-foreground', label: 'Clean Card Surface' },
              { value: 'bg-slate-950 text-white', label: 'Midnight Slate Surface' },
              { value: 'bg-navy-950 text-white', label: 'Patriotic Navy Deep' },
              { value: 'bg-amber-500/10 text-foreground', label: 'Civic Gold Warmth' },
              {
                value: 'bg-white/10 backdrop-blur-md border border-white/20 text-white',
                label: 'Frost Liquid Glass',
              },
              { value: 'bg-rose-500/10 text-foreground', label: 'Alert Crimson Tint' },
              { value: 'bg-emerald-500/10 text-foreground', label: 'Grassroots Forest Green' },
            ]}
          />
          <ColorSwatchPicker
            label="Quick Canvas Tint"
            value={styles.section.background}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: {
                  ...styles.section,
                  background: val,
                  bgGradient: '',
                  pattern: '',
                },
              })
            }
          />
          <ThemeModeSelector
            id={sectionThemeModeSelectId}
            label="Tone Mode Override"
            value={styles.section.themeMode || 'inherit'}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: {
                  ...styles.section,
                  themeMode: val,
                },
              })
            }
            description="Locks section to light, dark, or system mode regardless of reader OS setting."
          />
        </div>

        <StudioSelect
          id={bgGradientSelectId}
          label="Civic Gradient Background (Optional)"
          value={styles.section.bgGradient}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, bgGradient: val, pattern: '' },
            })
          }
          options={[
            { value: '', label: 'None (Use Solid Theme Above)' },
            {
              value: 'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white',
              label: 'Patriotic Midnight Navy',
            },
            {
              value:
                'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-foreground',
              label: 'Civic Gold Glow',
            },
            {
              value: 'bg-gradient-to-br from-rose-950/80 via-slate-900 to-black text-white',
              label: 'Alert Crimson Stand',
            },
            {
              value: 'bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 text-white',
              label: 'Grassroots Forest Emerald',
            },
            {
              value:
                'bg-gradient-to-br from-white/15 via-white/5 to-white/10 backdrop-blur-lg border border-white/20 text-white',
              label: 'Iridescent Liquid Frost Glass',
            },
          ]}
        />

        <StudioSelect
          id={sectionPatternSelectId}
          label="Civic Background Texture & Patterns"
          value={styles.section.pattern}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, pattern: val },
            })
          }
          options={[
            { value: '', label: 'None (Solid / Plain)' },
            {
              value:
                'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_1.5px,transparent_1.5px)] [background-size:24px_24px]',
              label: 'Civic Dot Matrix (24px Grid)',
            },
            {
              value:
                'bg-[linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.04)_50%,rgba(255,255,255,0.04)_75%,transparent_75%,transparent)] [background-size:24px_24px]',
              label: 'Architectural Diagonal Hatch',
            },
            {
              value:
                'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/15 via-slate-950 to-slate-950 text-white',
              label: 'Radiant Golden Civic Aura',
            },
            {
              value:
                'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-900 to-slate-950 text-white',
              label: 'Midnight Deep Blue Mesh',
            },
          ]}
        />

        <StudioSelect
          id={sectionOverlaySelectId}
          label="Section Atmosphere & Overlay Tint"
          value={styles.section.overlay || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, overlay: val },
            })
          }
          options={[
            { value: '', label: 'None (Clear Atmosphere)' },
            { value: 'bg-black/40', label: 'Dark Dramatic Vignette (bg-black/40)' },
            { value: 'bg-blue-950/60', label: 'Midnight Navy Cast (bg-blue-950/60)' },
            { value: 'bg-amber-950/25', label: 'Warm Civic Gold Dust (bg-amber-950/25)' },
            {
              value: 'backdrop-blur-sm bg-slate-900/40',
              label: 'Frosted Mist Overlay',
            },
            { value: 'bg-rose-950/30', label: 'Alert Crimson Aura (bg-rose-950/30)' },
          ]}
        />

        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={sectionBgBlendModeSelectId}
            label="Background Blend Mode"
            size="xs"
            value={styles.section.bgBlendMode || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, bgBlendMode: val },
              })
            }
            options={[
              { value: '', label: 'Normal (Default)' },
              { value: 'bg-blend-multiply', label: 'Multiply' },
              { value: 'bg-blend-screen', label: 'Screen' },
              { value: 'bg-blend-overlay', label: 'Overlay' },
              { value: 'bg-blend-darken', label: 'Darken' },
              { value: 'bg-blend-lighten', label: 'Lighten' },
              { value: 'bg-blend-color-dodge', label: 'Color Dodge' },
              { value: 'bg-blend-soft-light', label: 'Soft Light' },
              { value: 'bg-blend-difference', label: 'Difference' },
              { value: 'bg-blend-luminosity', label: 'Luminosity' },
            ]}
          />
          <StudioSelect
            id={sectionInnerShadowSelectId}
            label="Inner Recessed Shadow"
            size="xs"
            value={styles.section.innerShadow || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, innerShadow: val },
              })
            }
            options={[
              { value: '', label: 'None (Flat Surface)' },
              { value: 'shadow-inner', label: 'Subtle Inset Well (shadow-inner)' },
              {
                value: 'shadow-[inset_0_4px_16px_rgba(0,0,0,0.6)]',
                label: 'Deep Recessed Well',
              },
              {
                value: 'shadow-[inset_0_2px_16px_rgba(245,158,11,0.25)]',
                label: 'Civic Gold Horizon',
              },
              {
                value: 'shadow-[inset_0_2px_16px_rgba(30,58,138,0.35)]',
                label: 'Navy Horizon Inset',
              },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={sectionBgAttachmentSelectId}
            label="Scroll Parallax Effect"
            size="xs"
            value={styles.section.bgAttachment || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, bgAttachment: val },
              })
            }
            options={[
              { value: '', label: 'Normal Scroll' },
              { value: 'bg-fixed', label: 'Fixed Scroll Parallax (bg-fixed)' },
            ]}
          />
          <StudioSelect
            id={sectionBgPositionSelectId}
            label="Background Image Fit"
            size="xs"
            value={styles.section.bgPosition || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, bgPosition: val },
              })
            }
            options={[
              { value: '', label: 'Default Fit' },
              { value: 'bg-cover bg-center', label: 'Cover Center' },
              { value: 'bg-contain bg-center', label: 'Contain Center' },
              { value: 'bg-cover bg-top', label: 'Cover Top' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={sectionBgSizeSelectId}
            label="Background Scale / Size"
            size="xs"
            value={styles.section.bgSize || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, bgSize: val },
              })
            }
            options={[
              { value: '', label: 'Default Sizing' },
              { value: 'bg-cover', label: 'Cover Canvas (bg-cover)' },
              { value: 'bg-contain', label: 'Contain Proportional (bg-contain)' },
              { value: 'bg-auto', label: 'Original Scale (bg-auto)' },
            ]}
          />
          <StudioSelect
            id={sectionBgRepeatSelectId}
            label="Background Tiling / Repeat"
            size="xs"
            value={styles.section.bgRepeat || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, bgRepeat: val },
              })
            }
            options={[
              { value: '', label: 'Default (No Repeat)' },
              { value: 'bg-no-repeat', label: 'Single Image (bg-no-repeat)' },
              { value: 'bg-repeat', label: 'Tile Both Axis (bg-repeat)' },
              { value: 'bg-repeat-x', label: 'Horizontal Strip (bg-repeat-x)' },
              { value: 'bg-repeat-y', label: 'Vertical Column (bg-repeat-y)' },
            ]}
          />
        </div>
      </StudioSection>

      {/* ── 5. Borders & Glassmorphism ──────────────────────────────────── */}
      <StudioSection
        title="Borders, Radius & Glassmorphism"
        badge="Style"
        description="Surface curvature, shadow elevations, hairline framing, and frost blur."
      >
        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={sectionRadiusSelectId}
            label="Section Corner Radius"
            size="xs"
            value={styles.section.radius}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, radius: val },
              })
            }
            options={[
              { value: 'rounded-none', label: 'Square (0)' },
              { value: 'rounded-xl', label: 'Subtle (12px)' },
              { value: 'rounded-2xl', label: 'Modern Card (16px)' },
              { value: 'rounded-3xl', label: 'Pill Smooth (24px)' },
              { value: 'rounded-[2.5rem]', label: 'Deep Dramatic (40px)' },
            ]}
          />
          <StudioSelect
            id={sectionShadowSelectId}
            label="Section Shadow"
            size="xs"
            value={styles.section.shadow}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, shadow: val },
              })
            }
            options={[
              { value: 'shadow-none', label: 'Flat (None)' },
              { value: 'shadow-md', label: 'Medium' },
              { value: 'shadow-xl', label: 'High Elevation' },
              { value: 'shadow-2xl', label: 'Maximum Depth' },
              { value: 'shadow-2xl shadow-amber-500/10', label: 'Civic Gold Glow' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={sectionBorderSelectId}
            label="Section Border Frame"
            size="xs"
            value={styles.section.border || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, border: val },
              })
            }
            options={[
              { value: '', label: 'None (No Border)' },
              { value: 'border', label: 'Thin Hairline (1px)' },
              { value: 'border-2', label: 'Medium Border (2px)' },
              { value: 'border-4', label: 'Heavy Frame (4px)' },
              { value: 'border-y-2', label: 'Top & Bottom Frame' },
              { value: 'border-t-4', label: 'Top Accent Bar' },
              { value: 'border-b-4', label: 'Bottom Accent Bar' },
            ]}
          />
          <StudioSelect
            id={sectionBorderColorSelectId}
            label="Section Border Color"
            size="xs"
            value={styles.section.borderColor || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, borderColor: val },
              })
            }
            options={[
              { value: 'border-border', label: 'Default Frame Color' },
              { value: 'border-amber-500/50', label: 'Civic Gold Outline' },
              { value: 'border-blue-900/60', label: 'Patriotic Navy Outline' },
              { value: 'border-white/20', label: 'Frost Glass Outline' },
              { value: 'border-rose-500/50', label: 'Alert Crimson Outline' },
              { value: 'border-emerald-500/50', label: 'Grassroots Emerald Outline' },
            ]}
          />
        </div>

        <StudioSelect
          id={sectionBackdropBlurSelectId}
          label="Section Backdrop Glass Effect"
          value={styles.effects.backdropBlur}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, backdropBlur: val },
            })
          }
          options={[
            { value: '', label: 'None (Standard Clear)' },
            { value: 'backdrop-blur-sm', label: 'Subtle Frosted (blur-sm)' },
            { value: 'backdrop-blur-md', label: 'Medium Frosted Glass (blur-md)' },
            { value: 'backdrop-blur-lg', label: 'Deep Glass Surface (blur-lg)' },
            { value: 'backdrop-blur-xl', label: 'Ultra Liquid Glass (blur-xl)' },
          ]}
        />
      </StudioSection>

      {/* ── 6. Shape Dividers & Separators ─────────────────────────────── */}
      <StudioSection
        title="Shape Dividers & Cutouts"
        badge="Visual"
        description="Top and bottom geometric slants, curved arches, and glowing horizons."
      >
        <StudioSelect
          id={sectionDividerSelectId}
          label="Section Separator Dividers & Cutouts"
          value={styles.section.divider}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, divider: val },
            })
          }
          options={[
            { value: '', label: 'No Divider (None)' },
            { value: 'border-t border-border', label: 'Top Hairline Separator' },
            { value: 'border-b border-border', label: 'Bottom Hairline Separator' },
            { value: 'border-y border-border', label: 'Top & Bottom Separators' },
            { value: 'border-t-4 border-amber-500', label: 'Gold Accent Header Bar' },
            { value: 'border-t-4 border-blue-900', label: 'Navy Accent Header Bar' },
            {
              value: '[clip-path:polygon(0_0,100%_3vw,100%_100%,0_100%)]',
              label: 'Diagonal Slant Cutout (3vw)',
            },
            {
              value: '[clip-path:polygon(0_3vw,100%_0,100%_100%,0_100%)]',
              label: 'Reverse Diagonal Slant (-3vw)',
            },
            {
              value: '[clip-path:polygon(0_0,100%_0,100%_calc(100%-3vw),0_100%)]',
              label: 'Bottom Diagonal Slant (3vw)',
            },
            {
              value: '[clip-path:polygon(0_0,50%_3vw,100%_0,100%_100%,0_100%)]',
              label: 'Triangle Arrow Transition',
            },
            {
              value: 'rounded-t-[3rem] border-t-2 border-border',
              label: 'Curved Arch Header (3rem)',
            },
            {
              value: 'rounded-b-[3rem] border-b-2 border-border',
              label: 'Pill Arch Footer (3rem)',
            },
            {
              value: 'shadow-[0_-8px_24px_-6px_rgba(245,158,11,0.25)] border-t border-amber-500/40',
              label: 'Top Civic Gold Horizon Glow',
            },
            {
              value: 'shadow-[0_8px_24px_-6px_rgba(245,158,11,0.25)] border-b border-amber-500/40',
              label: 'Bottom Civic Gold Horizon Glow',
            },
          ]}
        />

        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={sectionTopDividerSelectId}
            label="Top Shape Divider (Pro)"
            size="xs"
            value={styles.section.topDivider || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, topDivider: val },
              })
            }
            options={[
              { value: '', label: 'None (Flush Top)' },
              { value: 'border-t border-border/80', label: 'Hairline Border Top' },
              { value: 'border-t-2 border-accent-gold', label: 'Gold Accent Bar (2px)' },
              { value: 'border-t-4 border-amber-500', label: 'Bold Gold Banner (4px)' },
              { value: 'border-t-4 border-blue-900', label: 'Navy Accent Header (4px)' },
              {
                value: 'rounded-t-[2.5rem] border-t-2 border-border',
                label: 'Curved Arch Top',
              },
              {
                value: 'rounded-t-[4rem] border-t-2 border-border',
                label: 'Deep Arch Dome Top',
              },
              {
                value: '[clip-path:polygon(0_3vw,100%_0,100%_100%,0_100%)]',
                label: 'Slanted Slope (-3vw)',
              },
              {
                value: '[clip-path:polygon(0_0,100%_3vw,100%_100%,0_100%)]',
                label: 'Inverse Slope (+3vw)',
              },
              {
                value:
                  'shadow-[0_-12px_32px_-8px_rgba(245,158,11,0.3)] border-t border-amber-500/50',
                label: 'Top Radiant Gold Glow',
              },
            ]}
          />
          <StudioSelect
            id={sectionBottomDividerSelectId}
            label="Bottom Shape Divider (Pro)"
            size="xs"
            value={styles.section.bottomDivider || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, bottomDivider: val },
              })
            }
            options={[
              { value: '', label: 'None (Flush Bottom)' },
              { value: 'border-b border-border/80', label: 'Hairline Border Bottom' },
              { value: 'border-b-2 border-accent-gold', label: 'Gold Accent Bar (2px)' },
              { value: 'border-b-4 border-amber-500', label: 'Bold Gold Banner (4px)' },
              { value: 'border-b-4 border-blue-900', label: 'Navy Accent Footer (4px)' },
              {
                value: 'rounded-b-[2.5rem] border-b-2 border-border',
                label: 'Pill Arch Footer',
              },
              {
                value: 'rounded-b-[4rem] border-b-2 border-border',
                label: 'Deep Arch Cradle',
              },
              {
                value: '[clip-path:polygon(0_0,100%_0,100%_calc(100%-3vw),0_100%)]',
                label: 'Slanted Slant (3vw)',
              },
              {
                value: '[clip-path:polygon(0_0,100%_0,100%_100%,0_calc(100%-3vw))]',
                label: 'Inverse Slant (-3vw)',
              },
              {
                value:
                  'shadow-[0_12px_32px_-8px_rgba(245,158,11,0.3)] border-b border-amber-500/50',
                label: 'Bottom Radiant Gold Glow',
              },
            ]}
          />
        </div>

        <StudioSelect
          id={sectionDividerColorSelectId}
          label="Divider Accent Color (Pro)"
          size="xs"
          value={styles.section.dividerColor || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              section: { ...styles.section, dividerColor: val },
            })
          }
          options={[
            { value: '', label: 'Default Border Frame' },
            { value: 'text-amber-500/40', label: 'Civic Gold Accent' },
            { value: 'text-blue-900/50', label: 'Patriotic Navy Depth' },
            { value: 'text-white/20', label: 'Frost Glass Accent' },
            { value: 'text-emerald-500/40', label: 'Grassroots Emerald' },
            { value: 'text-rose-500/40', label: 'Alert Crimson' },
          ]}
        />
      </StudioSection>

      {/* ── 7. Overflow & Stacking Z-Index ──────────────────────────────── */}
      <StudioSection
        title="Clipping & Stacking Elevation"
        badge="Z-Index"
        description="Boundary clipping and layer stacking order."
      >
        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={sectionOverflowSelectId}
            label="Section Overflow & Shape Boundary Clipping"
            value={styles.section.overflow || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, overflow: val },
              })
            }
            options={[
              { value: '', label: 'Visible (Default)' },
              { value: 'overflow-hidden', label: 'Hidden (Clip Bleeds)' },
              { value: 'overflow-clip', label: 'Clip (Strict Boundary)' },
              { value: 'overflow-x-hidden', label: 'Horizontal Hidden Only' },
              { value: 'overflow-y-auto', label: 'Vertical Scrollable (Auto)' },
            ]}
          />
          <StudioSelect
            id={sectionZIndexSelectId}
            label="Stacking Z-Index"
            value={styles.section.zIndex || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, zIndex: val },
              })
            }
            options={[
              { value: '', label: 'Auto (Default 0)' },
              { value: 'relative z-10', label: 'Low Float (z-10)' },
              { value: 'relative z-20', label: 'Mid Floating (z-20)' },
              { value: 'relative z-30', label: 'High Elevation (z-30)' },
              { value: 'relative z-40', label: 'Modal / Sticky Layer (z-40)' },
              { value: 'relative z-50', label: 'Topmost Foreground (z-50)' },
            ]}
          />
        </div>
      </StudioSection>

      {/* ── 8. Developer Controls & Responsive Visibility ───────────────── */}
      <StudioSection
        title="Developer Attributes & Visibility"
        badge="Advanced"
        description="HTML anchor IDs, extra custom Tailwind classes, and device display controls."
      >
        <div className="grid grid-cols-2 gap-2">
          <StudioInput
            id={sectionAnchorIdInputId}
            label="Section Anchor ID"
            prefix="#"
            value={styles.anchorId}
            onChange={(val) =>
              setStyles({
                ...styles,
                anchorId: val.replace(/[^a-zA-Z0-9_-]/g, ''),
              })
            }
            placeholder="speakers, rsvp"
          />
          <StudioInput
            id={sectionCustomClassesInputId}
            label="Section Custom Classes"
            value={styles.customClasses}
            onChange={(val) => setStyles({ ...styles, customClasses: val })}
            placeholder="border-t border-white/10"
          />
        </div>

        <div>
          <label
            htmlFor={sectionCustomStyleInputId}
            className="block text-slate-300 font-bold mb-1"
          >
            Section Custom Inline CSS (style="...")
          </label>
          <input
            id={sectionCustomStyleInputId}
            type="text"
            value={styles.customStyle || ''}
            onChange={(e) => setStyles({ ...styles, customStyle: e.target.value })}
            placeholder="e.g. min-height: 480px; background-attachment: fixed;"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Custom inline CSS rules applied directly to the outer row / section container.
          </p>
        </div>

        {/* Sticky Row Pinning & Print Visibility */}
        <div className="grid grid-cols-2 gap-2">
          <StudioToggle
            label="Sticky Row"
            description="Pin to top on scroll"
            active={Boolean(styles.section.sticky)}
            statusLabel={styles.section.sticky ? 'ON' : 'OFF'}
            onToggle={() =>
              setStyles({
                ...styles,
                section: { ...styles.section, sticky: !styles.section.sticky },
              })
            }
          />
          <StudioToggle
            label="Hide on Print"
            description="Exclude from print"
            active={Boolean(styles.responsive.hidePrint)}
            activeTone="rose"
            statusLabel={styles.responsive.hidePrint ? 'HIDDEN' : 'VISIBLE'}
            onToggle={() =>
              setStyles({
                ...styles,
                responsive: { ...styles.responsive, hidePrint: !styles.responsive.hidePrint },
              })
            }
          />
        </div>

        {/* Section Responsive Device Visibility */}
        <div>
          <span className="block text-slate-400 text-[10px] mb-1.5 font-medium">
            Hide on Devices
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              {
                key: 'hideMobile' as const,
                label: 'Mobile',
                active: styles.responsive.hideMobile,
              },
              {
                key: 'hideTablet' as const,
                label: 'Tablet',
                active: styles.responsive.hideTablet,
              },
              {
                key: 'hideDesktop' as const,
                label: 'Desktop',
                active: styles.responsive.hideDesktop,
              },
            ].map((item) => (
              <StudioToggle
                key={item.key}
                label={item.label}
                active={Boolean(item.active)}
                activeTone="rose"
                icon={
                  item.active ? (
                    <EyeOff size={12} className="text-rose-300" />
                  ) : (
                    <Eye size={12} className="text-slate-400" />
                  )
                }
                onToggle={() =>
                  setStyles({
                    ...styles,
                    responsive: {
                      ...styles.responsive,
                      [item.key]: !styles.responsive[item.key],
                    },
                  })
                }
              />
            ))}
          </div>
        </div>

        {/* Generated CSS Classes Preview */}
        {compiledClassNames !== undefined && (
          <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Compiled Classnames Preview
            </span>
            <p className="font-mono text-[10px] text-accent-gold break-all">
              {compiledClassNames || '(default section styles)'}
            </p>
          </div>
        )}
      </StudioSection>
    </div>
  );
}
