'use client';

import { Eye, EyeOff } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';
import { VC_COLUMN_PRESETS } from './constants';

export interface SectionStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  sectionWidthSelectId: string;
  sectionPaddingYSelectId: string;
  sectionPaddingXSelectId: string;
  sectionMarginYSelectId: string;
  sectionMarginXSelectId: string;
  sectionMinHeightSelectId: string;
  sectionBgSelectId: string;
  bgGradientSelectId: string;
  sectionPatternSelectId: string;
  sectionDividerSelectId: string;
  sectionTopDividerSelectId: string;
  sectionBottomDividerSelectId: string;
  sectionOverflowSelectId: string;
  sectionZIndexSelectId: string;
  sectionColumnsSelectId: string;
  sectionGapSelectId: string;
  sectionAlignSelectId: string;
  sectionJustifyContentSelectId: string;
  sectionRadiusSelectId: string;
  sectionShadowSelectId: string;
  sectionBackdropBlurSelectId: string;
  sectionBorderSelectId: string;
  sectionBorderColorSelectId: string;
  sectionOverlaySelectId: string;
  sectionBgAttachmentSelectId: string;
  sectionBgPositionSelectId: string;
  sectionBgSizeSelectId: string;
  sectionBgRepeatSelectId: string;
  sectionAnchorIdInputId: string;
  sectionCustomClassesInputId: string;
  sectionBgBlendModeSelectId?: string;
  sectionInnerShadowSelectId?: string;
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
  compiledClassNames,
}: SectionStudioProps) {
  return (
    <div className="space-y-4">
      <div>
        <span className="block text-slate-300 font-bold mb-2">Section Container Width</span>
        <label htmlFor={sectionWidthSelectId} className="sr-only">
          Container Width
        </label>
        <select
          id={sectionWidthSelectId}
          value={styles.section.containerWidth}
          onChange={(e) =>
            setStyles({
              ...styles,
              section: { ...styles.section, containerWidth: e.target.value },
            })
          }
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
        >
          <option value="max-w-4xl mx-auto px-4">Standard Editorial (4XL - 896px)</option>
          <option value="max-w-5xl mx-auto px-4">Wide Content (5XL - 1024px)</option>
          <option value="max-w-7xl mx-auto px-6">Ultra Wide Showcase (7XL - 1280px)</option>
          <option value="max-w-2xl mx-auto px-4">Compact Focused Reader (2XL - 672px)</option>
          <option value="w-full px-4">Full Bleed Fluid (100% Width)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="block text-slate-300 font-bold mb-2">Vertical Section Padding</span>
          <label htmlFor={sectionPaddingYSelectId} className="sr-only">
            Vertical Padding
          </label>
          <select
            id={sectionPaddingYSelectId}
            value={styles.section.paddingY}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, paddingY: e.target.value },
              })
            }
            className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
          >
            <option value="py-8">Standard Breathing Room (py-8 / 32px)</option>
            <option value="py-16">Generous Space (py-16 / 64px)</option>
            <option value="py-24">Hero Spotlight (py-24 / 96px)</option>
            <option value="py-4">Compact Spacing (py-4 / 16px)</option>
            <option value="py-0">Flush Edge (py-0 / 0px)</option>
          </select>
        </div>
        <div>
          <span className="block text-slate-300 font-bold mb-2">Horizontal Padding</span>
          <label htmlFor={sectionPaddingXSelectId} className="sr-only">
            Horizontal Padding
          </label>
          <select
            id={sectionPaddingXSelectId}
            value={styles.section.paddingX}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, paddingX: e.target.value },
              })
            }
            className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
          >
            <option value="px-4">Standard (px-4 / 16px)</option>
            <option value="px-6">Spacious (px-6 / 24px)</option>
            <option value="px-8">Generous (px-8 / 32px)</option>
            <option value="px-12">Deep Inset (px-12 / 48px)</option>
            <option value="px-0">Edge to Edge (px-0)</option>
          </select>
        </div>
      </div>

      {/* Section Outer Margin Studio (Vertical & Horizontal) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="block text-slate-300 font-bold mb-2">Vertical Section Margin</span>
          <label htmlFor={sectionMarginYSelectId} className="sr-only">
            Vertical Section Margin
          </label>
          <select
            id={sectionMarginYSelectId}
            value={styles.section.marginY || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, marginY: e.target.value },
              })
            }
            className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
          >
            <option value="">Default (Flush / None)</option>
            <option value="my-4">Compact (my-4 / 16px)</option>
            <option value="my-8">Standard Rhythm (my-8 / 32px)</option>
            <option value="my-12">Spacious Rhythm (my-12 / 48px)</option>
            <option value="my-16">Deep Separation (my-16 / 64px)</option>
            <option value="my-24">Dramatic Separation (my-24 / 96px)</option>
          </select>
        </div>
        <div>
          <span className="block text-slate-300 font-bold mb-2">Horizontal Margin / Float</span>
          <label htmlFor={sectionMarginXSelectId} className="sr-only">
            Horizontal Margin
          </label>
          <select
            id={sectionMarginXSelectId}
            value={styles.section.marginX || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, marginX: e.target.value },
              })
            }
            className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
          >
            <option value="">Default (None / Edge)</option>
            <option value="mx-auto">Auto Center (mx-auto)</option>
            <option value="mx-4">Compact Inset (mx-4 / 16px)</option>
            <option value="mx-8">Medium Floating (mx-8 / 32px)</option>
            <option value="mx-12">Spacious Floating (mx-12 / 48px)</option>
            <option value="mx-16">Island Card (mx-16 / 64px)</option>
          </select>
        </div>
      </div>

      {/* Section Min-Height & Viewport Sizing */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">
          Section Viewport &amp; Min Height
        </span>
        <label htmlFor={sectionMinHeightSelectId} className="sr-only">
          Section Min Height
        </label>
        <select
          id={sectionMinHeightSelectId}
          value={styles.section.minHeight}
          onChange={(e) =>
            setStyles({
              ...styles,
              section: { ...styles.section, minHeight: e.target.value },
            })
          }
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
        >
          <option value="">Auto (Content Derived)</option>
          <option value="min-h-[250px] flex flex-col justify-center">
            Compact Band (min-h-[250px])
          </option>
          <option value="min-h-[400px] flex flex-col justify-center">
            Medium Section (min-h-[400px])
          </option>
          <option value="min-h-[50vh] flex flex-col justify-center">
            Half Viewport (min-h-[50vh])
          </option>
          <option value="min-h-[75vh] flex flex-col justify-center">
            Hero Prominence (min-h-[75vh])
          </option>
          <option value="min-h-screen flex flex-col justify-center">
            Full Viewport Screen (min-h-screen)
          </option>
        </select>
      </div>

      <div>
        <span className="block text-slate-300 font-bold mb-2">Section Background Theme</span>
        <label htmlFor={sectionBgSelectId} className="sr-only">
          Section Background
        </label>
        <select
          id={sectionBgSelectId}
          value={styles.section.background}
          onChange={(e) =>
            setStyles({
              ...styles,
              section: {
                ...styles.section,
                background: e.target.value,
                bgGradient: '',
                pattern: '',
              },
            })
          }
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
        >
          <option value="bg-transparent">Transparent (Default)</option>
          <option value="bg-card text-foreground">Clean Card Surface</option>
          <option value="bg-navy-950 text-white">Patriotic Navy Deep</option>
          <option value="bg-amber-500/10 text-foreground">Civic Gold Warmth</option>
          <option value="bg-white/10 backdrop-blur-md border border-white/20 text-white">
            Frost Liquid Glass
          </option>
          <option value="bg-rose-500/10 text-foreground">Alert Crimson Tint</option>
          <option value="bg-emerald-500/10 text-foreground">Grassroots Forest Green</option>
        </select>
      </div>

      {/* Civic Gradient Backgrounds */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">
          Civic Gradient Background (Optional)
        </span>
        <label htmlFor={bgGradientSelectId} className="sr-only">
          Section Gradient
        </label>
        <select
          id={bgGradientSelectId}
          value={styles.section.bgGradient}
          onChange={(e) =>
            setStyles({
              ...styles,
              section: { ...styles.section, bgGradient: e.target.value, pattern: '' },
            })
          }
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
        >
          <option value="">None (Use Solid Theme Above)</option>
          <option value="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
            Patriotic Midnight Navy
          </option>
          <option value="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-foreground">
            Civic Gold Glow
          </option>
          <option value="bg-gradient-to-br from-rose-950/80 via-slate-900 to-black text-white">
            Alert Crimson Stand
          </option>
          <option value="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 text-white">
            Grassroots Forest Emerald
          </option>
          <option value="bg-gradient-to-br from-white/15 via-white/5 to-white/10 backdrop-blur-lg border border-white/20 text-white">
            Iridescent Liquid Frost Glass
          </option>
        </select>
      </div>

      {/* Civic Background Texture & Patterns */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">
          Civic Background Texture &amp; Patterns
        </span>
        <label htmlFor={sectionPatternSelectId} className="sr-only">
          Section Pattern
        </label>
        <select
          id={sectionPatternSelectId}
          value={styles.section.pattern}
          onChange={(e) =>
            setStyles({
              ...styles,
              section: { ...styles.section, pattern: e.target.value },
            })
          }
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
        >
          <option value="">None (Solid / Plain)</option>
          <option value="bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_1.5px,transparent_1.5px)] [background-size:24px_24px]">
            Civic Dot Matrix (24px Grid)
          </option>
          <option value="bg-[linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.04)_50%,rgba(255,255,255,0.04)_75%,transparent_75%,transparent)] [background-size:24px_24px]">
            Architectural Diagonal Hatch
          </option>
          <option value="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/15 via-slate-950 to-slate-950 text-white">
            Radiant Golden Civic Aura
          </option>
          <option value="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-900 to-slate-950 text-white">
            Midnight Deep Blue Mesh
          </option>
        </select>
      </div>

      <div>
        <span className="block text-slate-300 font-bold mb-2">
          Section Separator Dividers &amp; Cutouts
        </span>
        <label htmlFor={sectionDividerSelectId} className="sr-only">
          Section Divider
        </label>
        <select
          id={sectionDividerSelectId}
          value={styles.section.divider}
          onChange={(e) =>
            setStyles({
              ...styles,
              section: { ...styles.section, divider: e.target.value },
            })
          }
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
        >
          <option value="">No Divider (None)</option>
          <option value="border-t border-border">Top Hairline Separator</option>
          <option value="border-b border-border">Bottom Hairline Separator</option>
          <option value="border-y border-border">Top &amp; Bottom Separators</option>
          <option value="border-t-4 border-amber-500">Gold Accent Header Bar</option>
          <option value="border-t-4 border-blue-900">Navy Accent Header Bar</option>
          <option value="[clip-path:polygon(0_0,100%_3vw,100%_100%,0_100%)]">
            Diagonal Slant Cutout (3vw)
          </option>
          <option value="[clip-path:polygon(0_3vw,100%_0,100%_100%,0_100%)]">
            Reverse Diagonal Slant (-3vw)
          </option>
          <option value="[clip-path:polygon(0_0,100%_0,100%_calc(100%-3vw),0_100%)]">
            Bottom Diagonal Slant (3vw)
          </option>
          <option value="[clip-path:polygon(0_0,50%_3vw,100%_0,100%_100%,0_100%)]">
            Triangle Arrow Transition
          </option>
          <option value="rounded-t-[3rem] border-t-2 border-border">
            Curved Arch Header (3rem)
          </option>
          <option value="rounded-b-[3rem] border-b-2 border-border">Pill Arch Footer (3rem)</option>
          <option value="shadow-[0_-8px_24px_-6px_rgba(245,158,11,0.25)] border-t border-amber-500/40">
            Top Civic Gold Horizon Glow
          </option>
          <option value="shadow-[0_8px_24px_-6px_rgba(245,158,11,0.25)] border-b border-amber-500/40">
            Bottom Civic Gold Horizon Glow
          </option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor={sectionTopDividerSelectId}
            className="block text-slate-300 font-bold mb-1 text-[11px]"
          >
            Top Shape Divider (Pro)
          </label>
          <select
            id={sectionTopDividerSelectId}
            value={styles.section.topDivider || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, topDivider: e.target.value },
              })
            }
            className="w-full rounded-xl border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">None (Flush Top)</option>
            <option value="border-t border-border/80">Hairline Border Top</option>
            <option value="border-t-2 border-accent-gold">Gold Accent Bar (2px)</option>
            <option value="border-t-4 border-amber-500">Bold Gold Banner (4px)</option>
            <option value="border-t-4 border-blue-900">Navy Accent Header (4px)</option>
            <option value="rounded-t-[2.5rem] border-t-2 border-border">Curved Arch Top</option>
            <option value="rounded-t-[4rem] border-t-2 border-border">Deep Arch Dome Top</option>
            <option value="[clip-path:polygon(0_3vw,100%_0,100%_100%,0_100%)]">
              Slanted Slope (-3vw)
            </option>
            <option value="[clip-path:polygon(0_0,100%_3vw,100%_100%,0_100%)]">
              Inverse Slope (+3vw)
            </option>
            <option value="shadow-[0_-12px_32px_-8px_rgba(245,158,11,0.3)] border-t border-amber-500/50">
              Top Radiant Gold Glow
            </option>
          </select>
        </div>

        <div>
          <label
            htmlFor={sectionBottomDividerSelectId}
            className="block text-slate-300 font-bold mb-1 text-[11px]"
          >
            Bottom Shape Divider (Pro)
          </label>
          <select
            id={sectionBottomDividerSelectId}
            value={styles.section.bottomDivider || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, bottomDivider: e.target.value },
              })
            }
            className="w-full rounded-xl border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">None (Flush Bottom)</option>
            <option value="border-b border-border/80">Hairline Border Bottom</option>
            <option value="border-b-2 border-accent-gold">Gold Accent Bar (2px)</option>
            <option value="border-b-4 border-amber-500">Bold Gold Banner (4px)</option>
            <option value="border-b-4 border-blue-900">Navy Accent Footer (4px)</option>
            <option value="rounded-b-[2.5rem] border-b-2 border-border">Pill Arch Footer</option>
            <option value="rounded-b-[4rem] border-b-2 border-border">Deep Arch Cradle</option>
            <option value="[clip-path:polygon(0_0,100%_0,100%_calc(100%-3vw),0_100%)]">
              Slanted Slant (3vw)
            </option>
            <option value="[clip-path:polygon(0_0,100%_0,100%_100%,0_calc(100%-3vw))]">
              Inverse Slant (-3vw)
            </option>
            <option value="shadow-[0_12px_32px_-8px_rgba(245,158,11,0.3)] border-b border-amber-500/50">
              Bottom Radiant Gold Glow
            </option>
          </select>
        </div>
      </div>

      {/* Section Overflow Clipping & Stacking Z-Index */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor={sectionOverflowSelectId}
            className="block text-slate-300 font-bold mb-1.5 text-xs"
          >
            Section Overflow &amp; Shape Boundary Clipping
          </label>
          <select
            id={sectionOverflowSelectId}
            value={styles.section.overflow || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, overflow: e.target.value },
              })
            }
            className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
          >
            <option value="">Visible (Default)</option>
            <option value="overflow-hidden">Hidden (Clip Bleeds)</option>
            <option value="overflow-clip">Clip (Strict Boundary)</option>
            <option value="overflow-x-hidden">Horizontal Hidden Only</option>
            <option value="overflow-y-auto">Vertical Scrollable (Auto)</option>
          </select>
        </div>
        <div>
          <label
            htmlFor={sectionZIndexSelectId}
            className="block text-slate-300 font-bold mb-1.5 text-xs"
          >
            Stacking Z-Index
          </label>
          <select
            id={sectionZIndexSelectId}
            value={styles.section.zIndex || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, zIndex: e.target.value },
              })
            }
            className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
          >
            <option value="">Auto (Default 0)</option>
            <option value="relative z-10">Low Float (z-10)</option>
            <option value="relative z-20">Mid Floating (z-20)</option>
            <option value="relative z-30">High Elevation (z-30)</option>
            <option value="relative z-40">Modal / Sticky Layer (z-40)</option>
            <option value="relative z-50">Topmost Foreground (z-50)</option>
          </select>
        </div>
      </div>

      <div>
        <span className="block text-slate-300 font-bold mb-1.5">Row Multi-Column Layout</span>

        {/* 1-Click Column Ratio Presets */}
        <div className="grid grid-cols-4 gap-1.5 mb-2">
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
                className={`flex flex-col items-center justify-between p-1.5 rounded-lg border text-[10px] font-bold transition-all ${
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

        <label htmlFor={sectionColumnsSelectId} className="sr-only">
          Column Grid
        </label>
        <select
          id={sectionColumnsSelectId}
          value={styles.section.columns}
          onChange={(e) =>
            setStyles({
              ...styles,
              section: { ...styles.section, columns: e.target.value },
            })
          }
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
        >
          <option value="">Single Column (Full Width)</option>
          <option value="grid grid-cols-1 md:grid-cols-2">2 Equal Columns (50 / 50)</option>
          <option value="grid grid-cols-1 md:grid-cols-3">3 Columns (33 / 33 / 33)</option>
          <option value="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            4 Columns (25 / 25 / 25 / 25)
          </option>
          <option value="grid grid-cols-1 md:grid-cols-3 [&>*:first-child]:md:col-span-2">
            Asymmetric Main + Sidebar (66% / 33%)
          </option>
          <option value="grid grid-cols-1 md:grid-cols-3 [&>*:last-child]:md:col-span-2">
            Asymmetric Sidebar + Main (33% / 66%)
          </option>
        </select>
      </div>

      {styles.section.columns && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label htmlFor={sectionGapSelectId} className="text-[10px] text-slate-400 mb-1 block">
                Column Gap
              </label>
              <select
                id={sectionGapSelectId}
                value={styles.section.columnGap}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, columnGap: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
              >
                <option value="gap-0">Flush (gap-0)</option>
                <option value="gap-4">Compact (gap-4)</option>
                <option value="gap-8">Standard (gap-8)</option>
                <option value="gap-12">Generous (gap-12)</option>
                <option value="gap-16">Spacious (gap-16)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor={sectionAlignSelectId}
                className="text-[10px] text-slate-400 mb-1 block"
              >
                Vertical Alignment
              </label>
              <select
                id={sectionAlignSelectId}
                value={styles.section.verticalAlign}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, verticalAlign: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
              >
                <option value="items-start">Top Aligned</option>
                <option value="items-center">Middle Centered</option>
                <option value="items-end">Bottom Aligned</option>
                <option value="items-stretch">Stretch Equal Height</option>
              </select>
            </div>
            <div>
              <label
                htmlFor={sectionJustifyContentSelectId}
                className="text-[10px] text-slate-400 mb-1 block"
              >
                Column Justification
              </label>
              <select
                id={sectionJustifyContentSelectId}
                value={styles.section.justifyContent || ''}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, justifyContent: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
              >
                <option value="">Default (Start)</option>
                <option value="justify-start">Left / Start</option>
                <option value="justify-center">Center Distribution</option>
                <option value="justify-between">Space Between Columns</option>
                <option value="justify-around">Space Around</option>
                <option value="justify-end">Right / End</option>
              </select>
            </div>
          </div>

          {/* Equal Height and Reverse Mobile Toggles */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={() =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, equalHeight: !styles.section.equalHeight },
                })
              }
              className={`p-2 rounded-lg border text-left transition-colors flex items-center justify-between ${
                styles.section.equalHeight
                  ? 'border-accent-gold bg-accent-gold/20 text-accent-gold font-bold'
                  : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div>
                <span className="block text-[11px]">Equal Height</span>
                <span className="text-[9px] text-slate-400">Stretch column heights</span>
              </div>
              <span className="text-[10px] font-mono">
                {styles.section.equalHeight ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, reverseMobile: !styles.section.reverseMobile },
                })
              }
              className={`p-2 rounded-lg border text-left transition-colors flex items-center justify-between ${
                styles.section.reverseMobile
                  ? 'border-amber-500/40 bg-amber-500/20 text-amber-300 font-bold'
                  : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div>
                <span className="block text-[11px]">Reverse Mobile</span>
                <span className="text-[9px] text-slate-400">Invert column order</span>
              </div>
              <span className="text-[10px] font-mono">
                {styles.section.reverseMobile ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </>
      )}

      {/* Section Radius & Shadow */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={sectionRadiusSelectId} className="text-[10px] text-slate-400 mb-1 block">
            Section Corner Radius
          </label>
          <select
            id={sectionRadiusSelectId}
            value={styles.section.radius}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, radius: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="rounded-none">Square (0)</option>
            <option value="rounded-xl">Subtle (12px)</option>
            <option value="rounded-2xl">Modern Card (16px)</option>
            <option value="rounded-3xl">Pill Smooth (24px)</option>
            <option value="rounded-[2.5rem]">Deep Dramatic (40px)</option>
          </select>
        </div>
        <div>
          <label htmlFor={sectionShadowSelectId} className="text-[10px] text-slate-400 mb-1 block">
            Section Shadow
          </label>
          <select
            id={sectionShadowSelectId}
            value={styles.section.shadow}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, shadow: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="shadow-none">Flat (None)</option>
            <option value="shadow-md">Medium</option>
            <option value="shadow-xl">High Elevation</option>
            <option value="shadow-2xl">Maximum Depth</option>
            <option value="shadow-2xl shadow-amber-500/10">Civic Gold Glow</option>
          </select>
        </div>
      </div>

      {/* Sticky Row Pinning & Print Visibility */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            setStyles({
              ...styles,
              section: { ...styles.section, sticky: !styles.section.sticky },
            })
          }
          className={`p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between ${
            styles.section.sticky
              ? 'border-accent-gold bg-accent-gold/20 text-accent-gold font-bold'
              : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div>
            <span className="block text-xs">Sticky Row</span>
            <span className="text-[10px] text-slate-400">Pin to top on scroll</span>
          </div>
          <span className="text-[10px] font-mono">{styles.section.sticky ? 'ON' : 'OFF'}</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setStyles({
              ...styles,
              responsive: { ...styles.responsive, hidePrint: !styles.responsive.hidePrint },
            })
          }
          className={`p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between ${
            styles.responsive.hidePrint
              ? 'border-rose-500/40 bg-rose-500/20 text-rose-300 font-bold'
              : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div>
            <span className="block text-xs">Hide on Print</span>
            <span className="text-[10px] text-slate-400">Exclude from print</span>
          </div>
          <span className="text-[10px] font-mono">
            {styles.responsive.hidePrint ? 'HIDDEN' : 'VISIBLE'}
          </span>
        </button>
      </div>

      {/* Section Backdrop Blur & Glassmorphism */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">Section Backdrop Glass Effect</span>
        <label htmlFor={sectionBackdropBlurSelectId} className="sr-only">
          Section Backdrop Blur
        </label>
        <select
          id={sectionBackdropBlurSelectId}
          value={styles.effects.backdropBlur}
          onChange={(e) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, backdropBlur: e.target.value },
            })
          }
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
        >
          <option value="">None (Standard Clear)</option>
          <option value="backdrop-blur-sm">Subtle Frosted (blur-sm)</option>
          <option value="backdrop-blur-md">Medium Frosted Glass (blur-md)</option>
          <option value="backdrop-blur-lg">Deep Glass Surface (blur-lg)</option>
          <option value="backdrop-blur-xl">Ultra Liquid Glass (blur-xl)</option>
        </select>
      </div>

      {/* Section Frame Border & Border Color */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={sectionBorderSelectId} className="text-[10px] text-slate-400 mb-1 block">
            Section Border Frame
          </label>
          <select
            id={sectionBorderSelectId}
            value={styles.section.border || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, border: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">None (No Border)</option>
            <option value="border">Thin Hairline (1px)</option>
            <option value="border-2">Medium Border (2px)</option>
            <option value="border-4">Heavy Frame (4px)</option>
            <option value="border-y-2">Top &amp; Bottom Frame</option>
            <option value="border-t-4">Top Accent Bar</option>
            <option value="border-b-4">Bottom Accent Bar</option>
          </select>
        </div>
        <div>
          <label
            htmlFor={sectionBorderColorSelectId}
            className="text-[10px] text-slate-400 mb-1 block"
          >
            Section Border Color
          </label>
          <select
            id={sectionBorderColorSelectId}
            value={styles.section.borderColor || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, borderColor: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="border-border">Default Frame Color</option>
            <option value="border-amber-500/50">Civic Gold Outline</option>
            <option value="border-blue-900/60">Patriotic Navy Outline</option>
            <option value="border-white/20">Frost Glass Outline</option>
            <option value="border-rose-500/50">Alert Crimson Outline</option>
            <option value="border-emerald-500/50">Grassroots Emerald Outline</option>
          </select>
        </div>
      </div>

      {/* Section Atmosphere & Overlay Tint */}
      <div>
        <label htmlFor={sectionOverlaySelectId} className="text-[10px] text-slate-400 mb-1 block">
          Section Atmosphere &amp; Overlay Tint
        </label>
        <select
          id={sectionOverlaySelectId}
          value={styles.section.overlay || ''}
          onChange={(e) =>
            setStyles({
              ...styles,
              section: { ...styles.section, overlay: e.target.value },
            })
          }
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
        >
          <option value="">None (Clear Atmosphere)</option>
          <option value="bg-black/40">Dark Dramatic Vignette (bg-black/40)</option>
          <option value="bg-blue-950/60">Midnight Navy Cast (bg-blue-950/60)</option>
          <option value="bg-amber-950/25">Warm Civic Gold Dust (bg-amber-950/25)</option>
          <option value="backdrop-blur-sm bg-slate-900/40">Frosted Mist Overlay</option>
          <option value="bg-rose-950/30">Alert Crimson Aura (bg-rose-950/30)</option>
        </select>
      </div>

      {/* Section Background Blend Mode & Inner Box Shadow */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor={sectionBgBlendModeSelectId}
            className="text-[10px] text-slate-400 mb-1 block"
          >
            Background Blend Mode
          </label>
          <select
            id={sectionBgBlendModeSelectId}
            value={styles.section.bgBlendMode || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, bgBlendMode: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">Normal (Default)</option>
            <option value="bg-blend-multiply">Multiply</option>
            <option value="bg-blend-screen">Screen</option>
            <option value="bg-blend-overlay">Overlay</option>
            <option value="bg-blend-darken">Darken</option>
            <option value="bg-blend-lighten">Lighten</option>
            <option value="bg-blend-color-dodge">Color Dodge</option>
            <option value="bg-blend-soft-light">Soft Light</option>
            <option value="bg-blend-difference">Difference</option>
            <option value="bg-blend-luminosity">Luminosity</option>
          </select>
        </div>
        <div>
          <label
            htmlFor={sectionInnerShadowSelectId}
            className="text-[10px] text-slate-400 mb-1 block"
          >
            Inner Recessed Shadow
          </label>
          <select
            id={sectionInnerShadowSelectId}
            value={styles.section.innerShadow || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, innerShadow: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">None (Flat Surface)</option>
            <option value="shadow-inner">Subtle Inset Well (shadow-inner)</option>
            <option value="shadow-[inset_0_4px_16px_rgba(0,0,0,0.6)]">Deep Recessed Well</option>
            <option value="shadow-[inset_0_2px_16px_rgba(245,158,11,0.25)]">
              Civic Gold Horizon
            </option>
            <option value="shadow-[inset_0_2px_16px_rgba(30,58,138,0.35)]">
              Navy Horizon Inset
            </option>
          </select>
        </div>
      </div>

      {/* Section Parallax & Background Fit */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor={sectionBgAttachmentSelectId}
            className="text-[10px] text-slate-400 mb-1 block"
          >
            Scroll Parallax Effect
          </label>
          <select
            id={sectionBgAttachmentSelectId}
            value={styles.section.bgAttachment || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, bgAttachment: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">Normal Scroll</option>
            <option value="bg-fixed">Fixed Scroll Parallax (bg-fixed)</option>
          </select>
        </div>
        <div>
          <label
            htmlFor={sectionBgPositionSelectId}
            className="text-[10px] text-slate-400 mb-1 block"
          >
            Background Image Fit
          </label>
          <select
            id={sectionBgPositionSelectId}
            value={styles.section.bgPosition || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, bgPosition: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">Default Fit</option>
            <option value="bg-cover bg-center">Cover Center</option>
            <option value="bg-contain bg-center">Contain Center</option>
            <option value="bg-cover bg-top">Cover Top</option>
          </select>
        </div>
      </div>

      {/* Section Background Sizing & Repeat Studio */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={sectionBgSizeSelectId} className="text-[10px] text-slate-400 mb-1 block">
            Background Scale / Size
          </label>
          <select
            id={sectionBgSizeSelectId}
            value={styles.section.bgSize || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, bgSize: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">Default Sizing</option>
            <option value="bg-cover">Cover Canvas (bg-cover)</option>
            <option value="bg-contain">Contain Proportional (bg-contain)</option>
            <option value="bg-auto">Original Scale (bg-auto)</option>
          </select>
        </div>
        <div>
          <label
            htmlFor={sectionBgRepeatSelectId}
            className="text-[10px] text-slate-400 mb-1 block"
          >
            Background Tiling / Repeat
          </label>
          <select
            id={sectionBgRepeatSelectId}
            value={styles.section.bgRepeat || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                section: { ...styles.section, bgRepeat: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">Default (No Repeat)</option>
            <option value="bg-no-repeat">Single Image (bg-no-repeat)</option>
            <option value="bg-repeat">Tile Both Axis (bg-repeat)</option>
            <option value="bg-repeat-x">Horizontal Strip (bg-repeat-x)</option>
            <option value="bg-repeat-y">Vertical Column (bg-repeat-y)</option>
          </select>
        </div>
      </div>

      {/* Section Anchor ID & Custom Classes */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={sectionAnchorIdInputId} className="block text-slate-300 font-bold mb-1">
            Section Anchor ID
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-xs font-mono text-slate-400">#</span>
            <input
              id={sectionAnchorIdInputId}
              type="text"
              value={styles.anchorId}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  anchorId: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''),
                })
              }
              placeholder="e.g. speakers, rsvp"
              className="w-full rounded-xl border border-white/10 bg-slate-900 py-1.5 pl-6 pr-2.5 text-xs text-white placeholder:text-white/40 focus:border-accent-gold focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor={sectionCustomClassesInputId}
            className="block text-slate-300 font-bold mb-1"
          >
            Section Custom Classes
          </label>
          <input
            id={sectionCustomClassesInputId}
            type="text"
            value={styles.customClasses}
            onChange={(e) => setStyles({ ...styles, customClasses: e.target.value })}
            placeholder="e.g. border-t border-white/10"
            className="w-full rounded-xl border border-white/10 bg-slate-900 py-1.5 px-2.5 text-xs text-white placeholder:text-white/40 focus:border-accent-gold focus:outline-none"
          />
        </div>
      </div>

      {/* Section Responsive Device Visibility */}
      <div>
        <span className="block text-slate-300 font-bold mb-1.5">
          Section Responsive Device Visibility
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
            <button
              key={item.key}
              type="button"
              onClick={() =>
                setStyles({
                  ...styles,
                  responsive: {
                    ...styles.responsive,
                    [item.key]: !styles.responsive[item.key],
                  },
                })
              }
              className={`flex items-center justify-between p-2 rounded-xl border text-[11px] font-bold transition-colors ${
                item.active
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              <span>{item.label}</span>
              {item.active ? <EyeOff size={12} /> : <Eye size={12} className="text-slate-400" />}
            </button>
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
    </div>
  );
}
