'use client';

import { Columns3, Link2, Unlink2 } from 'lucide-react';
import type { Block } from '@/lib/blocks';
import type { VisualComposerStyles } from '@/types/unified';

export interface BoxModelStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  currentBlock: Block;
  isSidesLinked: boolean;
  setIsSidesLinked: React.Dispatch<React.SetStateAction<boolean>>;
  cycleMarginValue: (current: string, axis?: 'vertical' | 'horizontal') => string;
  cyclePaddingValue: (current: string, axis?: 'vertical' | 'horizontal') => string;
  marginSelectId: string;
  paddingSelectId: string;
  layoutColumnsSelectId: string;
  layoutMaxWidthSelectId: string;
  radiusSelectId: string;
  borderWidthSelectId: string;
  borderStyleSelectId: string;
  borderSideSelectId: string;
  bgThemeSelectId: string;
  shadowSelectId: string;
  layoutDisplaySelectId: string;
  layoutFlexDirSelectId: string;
  layoutJustifySelectId: string;
  layoutAlignSelectId: string;
  layoutAlignSelfSelectId: string;
  layoutOrderSelectId: string;
  layoutFlexGrowSelectId: string;
  layoutAspectRatioSelectId: string;
  layoutObjectFitSelectId: string;
  layoutPositionSelectId: string;
  layoutZIndexSelectId: string;
  layoutOverflowSelectId: string;
  layoutCursorSelectId: string;
  layoutVisibilitySelectId: string;
  effectBackdropBlurSelectId: string;
  effectOpacitySelectId: string;
  effectGrayscaleSelectId: string;
  effectBrightnessSelectId: string;
  effectContrastSelectId: string;
  effectSaturateSelectId: string;
  effectSepiaSelectId: string;
  effectHueRotateSelectId: string;
  effectBlurSelectId: string;
  effectBlendModeSelectId: string;
  effectHoverBrightnessSelectId: string;
  effectHoverOpacitySelectId: string;
  transformRotateSelectId: string;
  transformScaleSelectId: string;
  transformSkewSelectId: string;
}

export function BoxModelStudio({
  styles,
  setStyles,
  currentBlock,
  isSidesLinked,
  setIsSidesLinked,
  cycleMarginValue,
  cyclePaddingValue,
  marginSelectId,
  paddingSelectId,
  layoutColumnsSelectId,
  layoutMaxWidthSelectId,
  radiusSelectId,
  borderWidthSelectId,
  borderStyleSelectId,
  borderSideSelectId,
  bgThemeSelectId,
  shadowSelectId,
  layoutDisplaySelectId,
  layoutFlexDirSelectId,
  layoutJustifySelectId,
  layoutAlignSelectId,
  layoutAlignSelfSelectId,
  layoutOrderSelectId,
  layoutFlexGrowSelectId,
  layoutAspectRatioSelectId,
  layoutObjectFitSelectId,
  layoutPositionSelectId,
  layoutZIndexSelectId,
  layoutOverflowSelectId,
  layoutCursorSelectId,
  layoutVisibilitySelectId,
  effectBackdropBlurSelectId,
  effectOpacitySelectId,
  effectGrayscaleSelectId,
  effectBrightnessSelectId,
  effectContrastSelectId,
  effectSaturateSelectId,
  effectSepiaSelectId,
  effectHueRotateSelectId,
  effectBlurSelectId,
  effectBlendModeSelectId,
  effectHoverBrightnessSelectId,
  effectHoverOpacitySelectId,
  transformRotateSelectId,
  transformScaleSelectId,
  transformSkewSelectId,
}: BoxModelStudioProps) {
  return (
    <div className="space-y-4">
      {/* Visual Margin & Padding Dropdown Matrix */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">Spacing &amp; Padding</span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={marginSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Margin (Y-Axis)
            </label>
            <select
              id={marginSelectId}
              value={styles.margin.top}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  margin: {
                    ...styles.margin,
                    top: e.target.value,
                    bottom: isSidesLinked ? e.target.value : styles.margin.bottom,
                  },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
            >
              <option value="">None (0)</option>
              <option value="my-2">Compact (my-2)</option>
              <option value="my-4">Medium (my-4)</option>
              <option value="my-6">Large (my-6)</option>
              <option value="my-8">Extra (my-8)</option>
              <option value="my-12">Huge (my-12)</option>
            </select>
          </div>
          <div>
            <label htmlFor={paddingSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Padding
            </label>
            <select
              id={paddingSelectId}
              value={styles.padding.top}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  padding: {
                    ...styles.padding,
                    top: e.target.value,
                    bottom: isSidesLinked ? e.target.value : styles.padding.bottom,
                    left: isSidesLinked ? e.target.value : styles.padding.left,
                    right: isSidesLinked ? e.target.value : styles.padding.right,
                  },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
            >
              <option value="">None</option>
              <option value="p-2">Small (p-2)</option>
              <option value="p-4">Medium (p-4)</option>
              <option value="p-6">Spacious (p-6)</option>
              <option value="p-8">Hero (p-8)</option>
              <option value="p-12">Showcase (p-12)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Interactive 2D Visual CSS Box Model Diagram (Visual Composer Style) ── */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-accent-gold uppercase tracking-wider">
            Interactive CSS Box Model (4-Sided)
          </span>
          <button
            type="button"
            onClick={() => setIsSidesLinked((prev) => !prev)}
            title={isSidesLinked ? 'Sides Linked (Sync)' : 'Sides Unlinked (Independent)'}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors ${
              isSidesLinked ? 'bg-accent-gold/20 text-accent-gold' : 'bg-white/10 text-slate-300'
            }`}
          >
            {isSidesLinked ? <Link2 size={10} /> : <Unlink2 size={10} />}
            <span>{isSidesLinked ? 'Linked' : 'Separate'}</span>
          </button>
        </div>

        {/* Quick Spacing Presets */}
        <div className="flex flex-wrap gap-1 mb-2.5">
          {[
            { label: 'Default', margin: 'my-2', padding: 'p-4' },
            { label: 'Card', margin: 'my-4', padding: 'p-6' },
            { label: 'Spacious', margin: 'my-8', padding: 'p-8' },
            { label: 'Compact', margin: 'my-1', padding: 'p-2' },
            { label: 'Flush', margin: '', padding: '' },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() =>
                setStyles({
                  ...styles,
                  margin: { top: preset.margin, bottom: '', left: '', right: '' },
                  padding: { top: preset.padding, bottom: '', left: '', right: '' },
                })
              }
              className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Nested Box Model Canvas with Clickable 4 Sides */}
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-2 text-center relative transition-colors">
          <span className="absolute top-1 left-2 text-[8px] font-mono font-bold text-amber-400/90 tracking-widest uppercase">
            Margin (Outer)
          </span>

          {/* Top Margin Clickable Pill */}
          <div className="flex justify-center my-0.5">
            <button
              type="button"
              onClick={() => {
                const next = cycleMarginValue(styles.margin.top, 'vertical');
                setStyles({
                  ...styles,
                  margin: {
                    ...styles.margin,
                    top: next,
                    bottom: isSidesLinked ? next : styles.margin.bottom,
                  },
                });
              }}
              title="Click to cycle top margin"
              className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors"
            >
              T: {styles.margin.top || '0'}
            </button>
          </div>

          {/* Middle Row: Left Margin, Border & Padding, Right Margin */}
          <div className="flex items-center gap-1 my-0.5">
            <button
              type="button"
              onClick={() => {
                const next = cycleMarginValue(styles.margin.left, 'horizontal');
                setStyles({
                  ...styles,
                  margin: {
                    ...styles.margin,
                    left: next,
                    right: isSidesLinked ? next : styles.margin.right,
                  },
                });
              }}
              title="Click to cycle left margin"
              className="px-1.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors shrink-0"
            >
              L: {styles.margin.left || '0'}
            </button>

            <div className="flex-1 rounded-lg border border-sky-500/40 bg-sky-500/5 p-1.5 relative transition-colors">
              <span className="absolute top-1 left-2 text-[8px] font-mono font-bold text-sky-400/90 tracking-widest uppercase">
                Border ({styles.border.width}{' '}
                {styles.border.style !== 'none' ? styles.border.style : ''})
              </span>

              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-1.5 relative transition-colors mt-2">
                <span className="absolute top-1 left-2 text-[8px] font-mono font-bold text-emerald-400/90 tracking-widest uppercase">
                  Padding (Inner)
                </span>

                {/* Top Padding Clickable Pill */}
                <div className="flex justify-center my-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = cyclePaddingValue(styles.padding.top, 'vertical');
                      setStyles({
                        ...styles,
                        padding: {
                          ...styles.padding,
                          top: next,
                          bottom: isSidesLinked ? next : styles.padding.bottom,
                          left: isSidesLinked ? next : styles.padding.left,
                          right: isSidesLinked ? next : styles.padding.right,
                        },
                      });
                    }}
                    title="Click to cycle top padding"
                    className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors"
                  >
                    T: {styles.padding.top || '0'}
                  </button>
                </div>

                {/* Middle Row: Left Padding, Content, Right Padding */}
                <div className="flex items-center gap-1 my-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = cyclePaddingValue(styles.padding.left, 'horizontal');
                      setStyles({
                        ...styles,
                        padding: {
                          ...styles.padding,
                          left: next,
                          right: isSidesLinked ? next : styles.padding.right,
                          top: isSidesLinked ? next : styles.padding.top,
                          bottom: isSidesLinked ? next : styles.padding.bottom,
                        },
                      });
                    }}
                    title="Click to cycle left padding"
                    className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors shrink-0"
                  >
                    L: {styles.padding.left || '0'}
                  </button>

                  {/* Content Center */}
                  <div className="flex-1 rounded bg-slate-950 border border-white/20 py-1.5 px-2 text-center shadow-inner">
                    <span className="text-[10px] font-mono font-black text-accent-gold tracking-wide uppercase">
                      [ {currentBlock.type} ]
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = cyclePaddingValue(styles.padding.right, 'horizontal');
                      setStyles({
                        ...styles,
                        padding: {
                          ...styles.padding,
                          right: next,
                          left: isSidesLinked ? next : styles.padding.left,
                          top: isSidesLinked ? next : styles.padding.top,
                          bottom: isSidesLinked ? next : styles.padding.bottom,
                        },
                      });
                    }}
                    title="Click to cycle right padding"
                    className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors shrink-0"
                  >
                    R: {styles.padding.right || '0'}
                  </button>
                </div>

                {/* Bottom Padding Clickable Pill */}
                <div className="flex justify-center my-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = cyclePaddingValue(
                        styles.padding.bottom || styles.padding.top,
                        'vertical'
                      );
                      setStyles({
                        ...styles,
                        padding: {
                          ...styles.padding,
                          bottom: next,
                          top: isSidesLinked ? next : styles.padding.top,
                        },
                      });
                    }}
                    title="Click to cycle bottom padding"
                    className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors"
                  >
                    B: {styles.padding.bottom || styles.padding.top || '0'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Margin Clickable Pill */}
            <button
              type="button"
              onClick={() => {
                const next = cycleMarginValue(styles.margin.right, 'horizontal');
                setStyles({
                  ...styles,
                  margin: {
                    ...styles.margin,
                    right: next,
                    left: isSidesLinked ? next : styles.margin.left,
                  },
                });
              }}
              title="Click to cycle right margin"
              className="px-1.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors shrink-0"
            >
              R: {styles.margin.right || '0'}
            </button>
          </div>

          {/* Bottom Margin Clickable Pill */}
          <div className="flex justify-center my-0.5">
            <button
              type="button"
              onClick={() => {
                const next = cycleMarginValue(
                  styles.margin.bottom || styles.margin.top,
                  'vertical'
                );
                setStyles({
                  ...styles,
                  margin: {
                    ...styles.margin,
                    bottom: next,
                    top: isSidesLinked ? next : styles.margin.top,
                  },
                });
              }}
              title="Click to cycle bottom margin"
              className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors"
            >
              B: {styles.margin.bottom || styles.margin.top || '0'}
            </button>
          </div>
        </div>
      </div>

      {/* Layout Grid & Columns */}
      <div>
        <span className="block text-slate-300 font-bold mb-2 flex items-center gap-1.5">
          <Columns3 size={13} className="text-accent-gold" />
          <span>Layout &amp; Multi-Columns</span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor={layoutColumnsSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Columns Grid
            </label>
            <select
              id={layoutColumnsSelectId}
              value={styles.layout.columns}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, columns: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Full Width (1 Col)</option>
              <option value="grid grid-cols-1 md:grid-cols-2 gap-6">2 Columns (50/50)</option>
              <option value="grid grid-cols-1 md:grid-cols-3 gap-6">3 Columns (33/33/33)</option>
              <option value="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                4 Columns (25% each)
              </option>
              <option value="grid grid-cols-1 md:grid-cols-3 gap-6 [&>*:first-child]:md:col-span-2">
                Asymmetric (66% / 33%)
              </option>
              <option value="grid grid-cols-1 md:grid-cols-3 gap-6 [&>*:last-child]:md:col-span-2">
                Asymmetric (33% / 66%)
              </option>
            </select>
          </div>
          <div>
            <label
              htmlFor={layoutMaxWidthSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Container Width
            </label>
            <select
              id={layoutMaxWidthSelectId}
              value={styles.layout.maxWidth}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, maxWidth: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Default (Inherit)</option>
              <option value="max-w-2xl mx-auto">Compact (2XL)</option>
              <option value="max-w-4xl mx-auto">Standard (4XL)</option>
              <option value="max-w-6xl mx-auto">Wide Canvas (6XL)</option>
              <option value="w-full">Full Bleed (100%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Borders & Radius */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">Border &amp; Corner Radius</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label htmlFor={radiusSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Corner Radius
            </label>
            <select
              id={radiusSelectId}
              value={styles.border.radius}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  border: { ...styles.border, radius: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="rounded-none">Square (0)</option>
              <option value="rounded-md">Subtle (6px)</option>
              <option value="rounded-xl">Standard (12px)</option>
              <option value="rounded-2xl">Modern Card (16px)</option>
              <option value="rounded-3xl">Pill Smooth (24px)</option>
              <option value="rounded-full">Full Capsule</option>
              <option value="rounded-t-2xl">Top Rounded</option>
              <option value="rounded-b-2xl">Bottom Rounded</option>
            </select>
          </div>
          <div>
            <label htmlFor={borderWidthSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Border Width
            </label>
            <select
              id={borderWidthSelectId}
              value={styles.border.width}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  border: { ...styles.border, width: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="border-0">No Border</option>
              <option value="border">Thin (1px)</option>
              <option value="border-2">Medium (2px)</option>
              <option value="border-4">Heavy (4px)</option>
              <option value="border-8">Thick Accent (8px)</option>
            </select>
          </div>
          <div>
            <label htmlFor={borderStyleSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Border Style
            </label>
            <select
              id={borderStyleSelectId}
              value={styles.border.style}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  border: {
                    ...styles.border,
                    style: e.target.value as typeof styles.border.style,
                  },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="solid">Solid Line</option>
              <option value="dashed">Dashed Line</option>
              <option value="dotted">Dotted Line</option>
              <option value="double">Double Line</option>
              <option value="none">None</option>
            </select>
          </div>
          <div>
            <label htmlFor={borderSideSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Border Sides
            </label>
            <select
              id={borderSideSelectId}
              value={styles.border.side}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  border: {
                    ...styles.border,
                    side: e.target.value as typeof styles.border.side,
                  },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="all">All 4 Sides</option>
              <option value="left">Left Accent Bar</option>
              <option value="top">Top Accent Bar</option>
              <option value="bottom">Bottom Accent Bar</option>
              <option value="right">Right Accent Bar</option>
              <option value="y">Top &amp; Bottom</option>
            </select>
          </div>
        </div>

        {/* Border Color Swatches */}
        <div className="mt-2.5">
          <span className="text-[10px] text-slate-400 mb-1.5 block">Border Color Preset</span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { color: 'border-border', label: 'Default', bg: 'bg-white/20' },
              { color: 'border-amber-500/50', label: 'Civic Gold', bg: 'bg-amber-500' },
              { color: 'border-blue-900/50', label: 'Patriotic Navy', bg: 'bg-blue-900' },
              { color: 'border-white/30', label: 'Frost Glass', bg: 'bg-white/40' },
              { color: 'border-rose-500/50', label: 'Crimson', bg: 'bg-rose-500' },
              { color: 'border-emerald-500/50', label: 'Forest Green', bg: 'bg-emerald-500' },
            ].map((preset) => {
              const isSelected = styles.border.color === preset.color;
              return (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() =>
                    setStyles({
                      ...styles,
                      border: { ...styles.border, color: preset.color },
                    })
                  }
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] transition-colors ${
                    isSelected
                      ? 'border-accent-gold bg-accent-gold/15 text-accent-gold font-bold'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${preset.bg}`} />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Background & Shadow */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">Background &amp; Elevation</span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={bgThemeSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Background Theme
            </label>
            <select
              id={bgThemeSelectId}
              value={styles.background.preset}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  background: { ...styles.background, preset: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="bg-transparent">Transparent</option>
              <option value="bg-slate-900/60">Slate Card (60%)</option>
              <option value="bg-slate-950/90">Deep Midnight</option>
              <option value="bg-amber-500/10">Civic Gold Light</option>
              <option value="bg-emerald-500/10">Community Green</option>
              <option value="bg-rose-500/10">Alert Crimson</option>
              <option value="bg-white/10">Glass Surface</option>
            </select>
          </div>
          <div>
            <label htmlFor={shadowSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Elevation Shadow
            </label>
            <select
              id={shadowSelectId}
              value={styles.shadow}
              onChange={(e) => setStyles({ ...styles, shadow: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="shadow-none">Flat (None)</option>
              <option value="shadow-sm">Subtle Soft</option>
              <option value="shadow-md">Medium Card</option>
              <option value="shadow-lg">Elevated Surface</option>
              <option value="shadow-xl">High Elevation</option>
              <option value="shadow-2xl">Maximum Depth</option>
              <option value="shadow-inner">Inset Recessed</option>
              <option value="shadow-lg shadow-amber-500/25">Civic Gold Glow</option>
              <option value="shadow-lg shadow-sky-500/25">Cyan Tech Glow</option>
              <option value="shadow-2xl shadow-blue-950/60">Patriotic Navy Shadow</option>
            </select>
          </div>
        </div>
      </div>

      {/* Layout, Display & Max-Width Studio */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">Layout, Display &amp; Sizing</span>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label
              htmlFor={layoutDisplaySelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Display Mode
            </label>
            <select
              id={layoutDisplaySelectId}
              value={styles.layout.display}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, display: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Default (Normal Flow)</option>
              <option value="block">Block</option>
              <option value="inline-block">Inline Block</option>
              <option value="flex">Flex Container</option>
              <option value="inline-flex">Inline Flex</option>
              <option value="grid">Grid Container</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={layoutMaxWidthSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Max Width Container
            </label>
            <select
              id={layoutMaxWidthSelectId}
              value={styles.layout.maxWidth}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, maxWidth: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Full Width (Auto)</option>
              <option value="max-w-prose">Prose Reading (65ch)</option>
              <option value="max-w-sm">Small (384px)</option>
              <option value="max-w-md">Medium (448px)</option>
              <option value="max-w-lg">Large (512px)</option>
              <option value="max-w-xl">Extra Large (576px)</option>
              <option value="max-w-2xl">2X Large (672px)</option>
              <option value="max-w-4xl">4X Large (896px)</option>
            </select>
          </div>
        </div>

        {/* Flex Options if display is flex */}
        {(styles.layout.display === 'flex' || styles.layout.display === 'inline-flex') && (
          <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-white/5 border border-white/10 mb-2">
            <div>
              <label
                htmlFor={layoutFlexDirSelectId}
                className="text-[9px] text-slate-400 mb-0.5 block"
              >
                Direction
              </label>
              <select
                id={layoutFlexDirSelectId}
                value={styles.layout.flexDirection}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    layout: { ...styles.layout, flexDirection: e.target.value },
                  })
                }
                className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
              >
                <option value="flex-row">Row</option>
                <option value="flex-col">Column</option>
                <option value="flex-row-reverse">Row Rev</option>
                <option value="flex-col-reverse">Col Rev</option>
              </select>
            </div>
            <div>
              <label
                htmlFor={layoutJustifySelectId}
                className="text-[9px] text-slate-400 mb-0.5 block"
              >
                Justify
              </label>
              <select
                id={layoutJustifySelectId}
                value={styles.layout.justifyContent}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    layout: { ...styles.layout, justifyContent: e.target.value },
                  })
                }
                className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
              >
                <option value="justify-start">Start</option>
                <option value="justify-center">Center</option>
                <option value="justify-end">End</option>
                <option value="justify-between">Between</option>
                <option value="justify-around">Around</option>
              </select>
            </div>
            <div>
              <label
                htmlFor={layoutAlignSelectId}
                className="text-[9px] text-slate-400 mb-0.5 block"
              >
                Align Items
              </label>
              <select
                id={layoutAlignSelectId}
                value={styles.layout.alignItems}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    layout: { ...styles.layout, alignItems: e.target.value },
                  })
                }
                className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
              >
                <option value="items-start">Start</option>
                <option value="items-center">Center</option>
                <option value="items-end">End</option>
                <option value="items-stretch">Stretch</option>
              </select>
            </div>
          </div>
        )}

        {/* Flex Child & Self-Alignment */}
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <div>
            <label
              htmlFor={layoutAlignSelfSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Self Alignment
            </label>
            <select
              id={layoutAlignSelfSelectId}
              value={styles.layout.alignSelf || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, alignSelf: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Default (Auto)</option>
              <option value="self-auto">Auto (self-auto)</option>
              <option value="self-start">Start / Top (self-start)</option>
              <option value="self-center">Centered (self-center)</option>
              <option value="self-end">End / Bottom (self-end)</option>
              <option value="self-stretch">Stretch (self-stretch)</option>
              <option value="self-baseline">Baseline (self-baseline)</option>
            </select>
          </div>
          <div>
            <label htmlFor={layoutOrderSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Display Order
            </label>
            <select
              id={layoutOrderSelectId}
              value={styles.layout.order || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, order: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Natural Order</option>
              <option value="order-first">Order First</option>
              <option value="order-last">Order Last</option>
              <option value="order-1">Position 1</option>
              <option value="order-2">Position 2</option>
              <option value="order-3">Position 3</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={layoutFlexGrowSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Flex Sizing
            </label>
            <select
              id={layoutFlexGrowSelectId}
              value={styles.layout.flexGrow || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, flexGrow: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Default Sizing</option>
              <option value="grow">Grow to Fill (grow)</option>
              <option value="grow-0">Fixed Scale (grow-0)</option>
              <option value="shrink">Allow Shrink (shrink)</option>
              <option value="shrink-0">Prevent Shrink (shrink-0)</option>
            </select>
          </div>
        </div>

        {/* Media Aspect Ratio & Object Fit */}
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <div>
            <label
              htmlFor={layoutAspectRatioSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Aspect Ratio
            </label>
            <select
              id={layoutAspectRatioSelectId}
              value={styles.layout.aspectRatio || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, aspectRatio: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Natural Ratio (Auto)</option>
              <option value="aspect-square">Square 1:1 (aspect-square)</option>
              <option value="aspect-video">Widescreen 16:9 (aspect-video)</option>
              <option value="aspect-[4/3]">Standard Photo 4:3</option>
              <option value="aspect-[3/2]">Classic 3:2</option>
              <option value="aspect-[21/9]">Cinematic Ultra-Wide 21:9</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={layoutObjectFitSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Media Object Fit
            </label>
            <select
              id={layoutObjectFitSelectId}
              value={styles.layout.objectFit || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, objectFit: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Default Fit</option>
              <option value="object-cover">Cover (Fill Boundary)</option>
              <option value="object-contain">Contain (Keep Proportions)</option>
              <option value="object-fill">Fill (Stretch)</option>
              <option value="object-scale-down">Scale Down</option>
            </select>
          </div>
        </div>

        {/* Positioning & Layering */}
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <label
              htmlFor={layoutPositionSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Position
            </label>
            <select
              id={layoutPositionSelectId}
              value={styles.layout.position}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, position: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Static</option>
              <option value="relative">Relative</option>
              <option value="sticky top-0">Sticky Top-0</option>
              <option value="sticky top-4">Sticky Top-4</option>
              <option value="absolute">Absolute</option>
            </select>
          </div>
          <div>
            <label htmlFor={layoutZIndexSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Z-Index
            </label>
            <select
              id={layoutZIndexSelectId}
              value={styles.layout.zIndex}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, zIndex: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Auto</option>
              <option value="z-0">z-0</option>
              <option value="z-10">z-10</option>
              <option value="z-20">z-20</option>
              <option value="z-30">z-30</option>
              <option value="z-40">z-40</option>
              <option value="z-50">z-50</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={layoutOverflowSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Overflow
            </label>
            <select
              id={layoutOverflowSelectId}
              value={styles.layout.overflow}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, overflow: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Visible</option>
              <option value="overflow-hidden">Hidden</option>
              <option value="overflow-auto">Auto Scroll</option>
              <option value="overflow-x-auto">Scroll X</option>
            </select>
          </div>
        </div>

        {/* Interactive Cursor & Visibility */}
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <div>
            <label htmlFor={layoutCursorSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Cursor Behavior
            </label>
            <select
              id={layoutCursorSelectId}
              value={styles.layout.cursor || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, cursor: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Default (Browser)</option>
              <option value="cursor-pointer">Clickable Pointer (cursor-pointer)</option>
              <option value="cursor-grab">Draggable Grab (cursor-grab)</option>
              <option value="cursor-text">Text Selection (cursor-text)</option>
              <option value="cursor-not-allowed">
                Disabled / Not Allowed (cursor-not-allowed)
              </option>
              <option value="cursor-default">Arrow Default (cursor-default)</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={layoutVisibilitySelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              CSS Visibility
            </label>
            <select
              id={layoutVisibilitySelectId}
              value={styles.layout.visibility || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, visibility: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Default (visible)</option>
              <option value="visible">Force Visible (visible)</option>
              <option value="invisible">Hidden in DOM Space (invisible)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Glassmorphism & Visual Effects */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">
          Glassmorphism &amp; Visual Effects
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <label
              htmlFor={effectBackdropBlurSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Backdrop Blur
            </label>
            <select
              id={effectBackdropBlurSelectId}
              value={styles.effects.backdropBlur}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  effects: { ...styles.effects, backdropBlur: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">None</option>
              <option value="backdrop-blur-sm">Subtle (sm)</option>
              <option value="backdrop-blur-md">Medium (md)</option>
              <option value="backdrop-blur-lg">Deep (lg)</option>
              <option value="backdrop-blur-xl">Ultra Glass (xl)</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={effectOpacitySelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Opacity
            </label>
            <select
              id={effectOpacitySelectId}
              value={styles.effects.opacity}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  effects: { ...styles.effects, opacity: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">100% Solid</option>
              <option value="opacity-90">90%</option>
              <option value="opacity-80">80%</option>
              <option value="opacity-70">70%</option>
              <option value="opacity-50">50% Dimmed</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={effectGrayscaleSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Grayscale Filter
            </label>
            <select
              id={effectGrayscaleSelectId}
              value={styles.effects.grayscale}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  effects: { ...styles.effects, grayscale: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Full Color</option>
              <option value="grayscale">Full Grayscale</option>
              <option value="grayscale hover:grayscale-0 transition-all duration-300">
                Hover Reveal Color
              </option>
            </select>
          </div>
        </div>

        {/* CSS Filters & Color Grading */}
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <div>
            <label
              htmlFor={effectBrightnessSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Brightness
            </label>
            <select
              id={effectBrightnessSelectId}
              value={styles.effects.brightness || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  effects: { ...styles.effects, brightness: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Normal (100%)</option>
              <option value="brightness-50">Dim (50%)</option>
              <option value="brightness-75">Subtle Dim (75%)</option>
              <option value="brightness-90">Moody (90%)</option>
              <option value="brightness-110">Highlight (+10%)</option>
              <option value="brightness-125">Luminous (+25%)</option>
              <option value="brightness-150">Radiant Pop (+50%)</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={effectContrastSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Contrast
            </label>
            <select
              id={effectContrastSelectId}
              value={styles.effects.contrast || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  effects: { ...styles.effects, contrast: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Normal (100%)</option>
              <option value="contrast-50">Muted (50%)</option>
              <option value="contrast-75">Soft Low (75%)</option>
              <option value="contrast-125">Punchy (+25%)</option>
              <option value="contrast-150">High Dynamic (+50%)</option>
              <option value="contrast-200">Dramatic Black &amp; White (+100%)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <div>
            <label
              htmlFor={effectSaturateSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Saturation
            </label>
            <select
              id={effectSaturateSelectId}
              value={styles.effects.saturate || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  effects: { ...styles.effects, saturate: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">100% Normal</option>
              <option value="saturate-50">50% Desaturated</option>
              <option value="saturate-150">150% Vibrant Rich</option>
              <option value="saturate-200">200% Super Saturated</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={effectHueRotateSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Hue Shift (Color Shift)
            </label>
            <select
              id={effectHueRotateSelectId}
              value={styles.effects.hueRotate || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  effects: { ...styles.effects, hueRotate: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">0° Normal</option>
              <option value="hue-rotate-15">15° Warm Shift</option>
              <option value="hue-rotate-30">30° Golden Amber</option>
              <option value="hue-rotate-60">60° Emerald Green</option>
              <option value="hue-rotate-90">90° Cyan Accent</option>
              <option value="hue-rotate-180">180° Inverted Spectrum</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <div>
            <label htmlFor={effectSepiaSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Sepia Vintage
            </label>
            <select
              id={effectSepiaSelectId}
              value={styles.effects.sepia || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  effects: { ...styles.effects, sepia: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">None (Modern Color)</option>
              <option value="sepia">Warm Sepia Tone</option>
              <option value="sepia hover:sepia-0 transition-all duration-300">
                Hover Reveal Modern
              </option>
            </select>
          </div>
          <div>
            <label htmlFor={effectBlurSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Element Blur Filter
            </label>
            <select
              id={effectBlurSelectId}
              value={styles.effects.blur || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  effects: { ...styles.effects, blur: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">Sharp (No Blur)</option>
              <option value="blur-xs">Soft Focus (xs)</option>
              <option value="blur-sm">Light Blur (sm)</option>
              <option value="blur-md">Medium Bokeh (md)</option>
            </select>
          </div>
        </div>

        <div className="mt-1.5">
          <label
            htmlFor={effectBlendModeSelectId}
            className="text-[10px] text-slate-400 mb-1 block"
          >
            Mix Blend Mode (Layer Blending)
          </label>
          <select
            id={effectBlendModeSelectId}
            value={styles.effects.blendMode || ''}
            onChange={(e) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, blendMode: e.target.value },
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
          >
            <option value="">Normal (Default)</option>
            <option value="mix-blend-multiply">Multiply (Darken / Shadow)</option>
            <option value="mix-blend-screen">Screen (Lighten / Glow)</option>
            <option value="mix-blend-overlay">Overlay (High Contrast)</option>
            <option value="mix-blend-darken">Darken</option>
            <option value="mix-blend-lighten">Lighten</option>
            <option value="mix-blend-color-dodge">Color Dodge (Intense Glow)</option>
            <option value="mix-blend-color-burn">Color Burn (Deep Shadow)</option>
            <option value="mix-blend-hard-light">Hard Light</option>
            <option value="mix-blend-soft-light">Soft Light</option>
            <option value="mix-blend-difference">Difference (Inversion Effect)</option>
            <option value="mix-blend-exclusion">Exclusion</option>
            <option value="mix-blend-luminosity">Luminosity (Luma Blend)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <div>
            <label
              htmlFor={effectHoverBrightnessSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Hover Brightness Shift
            </label>
            <select
              id={effectHoverBrightnessSelectId}
              value={styles.effects.hoverBrightness || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  effects: { ...styles.effects, hoverBrightness: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">No Brightness Shift</option>
              <option value="hover:brightness-105 transition-all">Subtle Light (+5%)</option>
              <option value="hover:brightness-110 transition-all">Luminous (+10%)</option>
              <option value="hover:brightness-125 transition-all">High Radiance (+25%)</option>
              <option value="hover:brightness-90 transition-all">Darken Depth (-10%)</option>
              <option value="hover:brightness-75 transition-all">Moody Shadow (-25%)</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={effectHoverOpacitySelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Hover Opacity Shift
            </label>
            <select
              id={effectHoverOpacitySelectId}
              value={styles.effects.hoverOpacity || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  effects: { ...styles.effects, hoverOpacity: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">No Opacity Shift</option>
              <option value="hover:opacity-100 transition-opacity">Force Opaque (100%)</option>
              <option value="hover:opacity-90 transition-opacity">Gentle Fade (90%)</option>
              <option value="hover:opacity-80 transition-opacity">Medium Translucent (80%)</option>
              <option value="hover:opacity-60 transition-opacity">Ghost Subtle (60%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transforms & 3D Tilt Studio */}
      <div>
        <span className="block text-slate-300 font-bold mb-2">Transforms &amp; 3D Tilt</span>
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <label
              htmlFor={transformRotateSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Rotation Angle
            </label>
            <select
              id={transformRotateSelectId}
              value={styles.transform?.rotate || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  transform: { ...styles.transform, rotate: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">0° (Flat)</option>
              <option value="rotate-1">1° Subtle Right</option>
              <option value="-rotate-1">-1° Subtle Left</option>
              <option value="rotate-2">2° Dynamic Angle</option>
              <option value="-rotate-2">-2° Dynamic Angle</option>
              <option value="rotate-3">3° Playful Tilt</option>
              <option value="-rotate-3">-3° Playful Tilt</option>
              <option value="rotate-6">6° Accent Stamp</option>
              <option value="-rotate-6">-6° Accent Stamp</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={transformScaleSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Scale Size
            </label>
            <select
              id={transformScaleSelectId}
              value={styles.transform?.scale || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  transform: { ...styles.transform, scale: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">100% Normal</option>
              <option value="scale-95">95% Compact</option>
              <option value="scale-105">105% Spotlight Pop</option>
              <option value="scale-110">110% Heroic Zoom</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={transformSkewSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Skew Slant
            </label>
            <select
              id={transformSkewSelectId}
              value={styles.transform?.skew || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  transform: { ...styles.transform, skew: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">None (0°)</option>
              <option value="skew-x-1">1° Civic Slant</option>
              <option value="-skew-x-1">-1° Reverse Slant</option>
              <option value="skew-y-1">1° Vertical Slant</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
