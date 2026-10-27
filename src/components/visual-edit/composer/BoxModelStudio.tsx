'use client';

import { Columns3, Eye, Link2, Sparkles, Unlink2 } from 'lucide-react';
import type { Block } from '@/lib/blocks';
import type { VisualComposerStyles } from '@/types/unified';
import {
  ColorSwatchPicker,
  StudioInput,
  StudioSection,
  StudioSelect,
  StudioToggle,
  ThemeModeSelector,
} from './ui';

export interface BoxModelStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  currentBlock: Block;
  isSidesLinked: boolean;
  setIsSidesLinked: React.Dispatch<React.SetStateAction<boolean>>;
  cycleMarginValue: (current: string, axis?: 'vertical' | 'horizontal') => string;
  cyclePaddingValue: (current: string, axis?: 'vertical' | 'horizontal') => string;
  marginSelectId?: string;
  paddingSelectId?: string;
  layoutColumnsSelectId?: string;
  layoutMaxWidthSelectId?: string;
  radiusSelectId?: string;
  borderWidthSelectId?: string;
  borderStyleSelectId?: string;
  borderSideSelectId?: string;
  bgThemeSelectId?: string;
  shadowSelectId?: string;
  layoutDisplaySelectId?: string;
  layoutFlexDirSelectId?: string;
  layoutJustifySelectId?: string;
  layoutAlignSelectId?: string;
  layoutAlignSelfSelectId?: string;
  layoutOrderSelectId?: string;
  layoutFlexGrowSelectId?: string;
  layoutAspectRatioSelectId?: string;
  layoutObjectFitSelectId?: string;
  layoutPositionSelectId?: string;
  layoutZIndexSelectId?: string;
  layoutOverflowSelectId?: string;
  layoutCursorSelectId?: string;
  layoutVisibilitySelectId?: string;
  effectBackdropBlurSelectId?: string;
  effectOpacitySelectId?: string;
  effectGrayscaleSelectId?: string;
  effectBrightnessSelectId?: string;
  effectContrastSelectId?: string;
  effectSaturateSelectId?: string;
  effectSepiaSelectId?: string;
  effectHueRotateSelectId?: string;
  effectBlurSelectId?: string;
  effectBlendModeSelectId?: string;
  effectHoverBrightnessSelectId?: string;
  effectHoverOpacitySelectId?: string;
  transformRotateSelectId?: string;
  transformScaleSelectId?: string;
  transformSkewSelectId?: string;
  layoutWidthSelectId?: string;
  layoutMinWidthSelectId?: string;
  layoutHeightSelectId?: string;
  layoutMinHeightSelectId?: string;
  layoutMaxHeightSelectId?: string;
  layoutFlexWrapSelectId?: string;
  layoutFlexShrinkSelectId?: string;
  layoutPointerEventsSelectId?: string;
  layoutUserSelectSelectId?: string;
  effectInvertSelectId?: string;
  effectDropShadowSelectId?: string;
  transformTranslateXSelectId?: string;
  transformTranslateYSelectId?: string;
  transformOriginSelectId?: string;
  shadowColorSelectId?: string;
  clipPathSelectId?: string;
  layoutInsetSelectId?: string;
  layoutTopSelectId?: string;
  layoutBottomSelectId?: string;
  layoutLeftSelectId?: string;
  layoutRightSelectId?: string;
  radiusTopLeftSelectId?: string;
  radiusTopRightSelectId?: string;
  radiusBottomRightSelectId?: string;
  radiusBottomLeftSelectId?: string;
  blockThemeModeSelectId?: string;
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
  layoutWidthSelectId = 'layout-width-select',
  layoutMinWidthSelectId = 'layout-min-width-select',
  layoutHeightSelectId = 'layout-height-select',
  layoutMinHeightSelectId = 'layout-min-height-select',
  layoutMaxHeightSelectId = 'layout-max-height-select',
  layoutFlexWrapSelectId = 'layout-flex-wrap-select',
  layoutFlexShrinkSelectId = 'layout-flex-shrink-select',
  layoutPointerEventsSelectId = 'layout-pointer-events-select',
  layoutUserSelectSelectId = 'layout-user-select-select',
  effectInvertSelectId = 'effect-invert-select',
  effectDropShadowSelectId = 'effect-drop-shadow-select',
  transformTranslateXSelectId = 'transform-translate-x-select',
  transformTranslateYSelectId = 'transform-translate-y-select',
  transformOriginSelectId = 'transform-origin-select',
  shadowColorSelectId = 'shadow-color-select',
  clipPathSelectId = 'clip-path-select',
  layoutInsetSelectId = 'layout-inset-select',
  layoutTopSelectId = 'layout-top-select',
  layoutBottomSelectId = 'layout-bottom-select',
  layoutLeftSelectId = 'layout-left-select',
  layoutRightSelectId = 'layout-right-select',
  radiusTopLeftSelectId = 'radius-top-left-select',
  radiusTopRightSelectId = 'radius-top-right-select',
  radiusBottomRightSelectId = 'radius-bottom-right-select',
  radiusBottomLeftSelectId = 'radius-bottom-left-select',
  blockThemeModeSelectId = 'block-theme-mode-select',
}: BoxModelStudioProps) {
  return (
    <div className="space-y-5">
      {/* ── 1. Spacing & Visual 2D Box Model Diagram ── */}
      <StudioSection
        title="Spacing & Padding"
        badge="Box Model"
        description="Configure outer margins, inner padding, and interactive 4-sided dimensions."
      >
        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={marginSelectId}
            label="Margin (Y-Axis)"
            value={styles.margin.top}
            onChange={(val) =>
              setStyles({
                ...styles,
                margin: {
                  ...styles.margin,
                  top: val,
                  bottom: isSidesLinked ? val : styles.margin.bottom,
                },
              })
            }
            options={[
              { value: '', label: 'None (0)' },
              { value: 'my-2', label: 'Compact (my-2)' },
              { value: 'my-4', label: 'Medium (my-4)' },
              { value: 'my-6', label: 'Large (my-6)' },
              { value: 'my-8', label: 'Extra (my-8)' },
              { value: 'my-12', label: 'Huge (my-12)' },
            ]}
          />
          <StudioSelect
            id={paddingSelectId}
            label="Padding"
            value={styles.padding.top}
            onChange={(val) =>
              setStyles({
                ...styles,
                padding: {
                  ...styles.padding,
                  top: val,
                  bottom: isSidesLinked ? val : styles.padding.bottom,
                  left: isSidesLinked ? val : styles.padding.left,
                  right: isSidesLinked ? val : styles.padding.right,
                },
              })
            }
            options={[
              { value: '', label: 'None' },
              { value: 'p-2', label: 'Small (p-2)' },
              { value: 'p-4', label: 'Medium (p-4)' },
              { value: 'p-6', label: 'Spacious (p-6)' },
              { value: 'p-8', label: 'Hero (p-8)' },
              { value: 'p-12', label: 'Showcase (p-12)' },
            ]}
          />
        </div>

        {/* Interactive 2D Visual CSS Box Model Diagram */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-accent-gold uppercase tracking-wider">
              Interactive CSS Box Model (4-Sided)
            </span>
            <button
              type="button"
              onClick={() => setIsSidesLinked((prev) => !prev)}
              title={isSidesLinked ? 'Sides Linked (Sync)' : 'Sides Unlinked (Independent)'}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer ${
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
                className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-slate-300 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
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
                className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors cursor-pointer"
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
                className="px-1.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors shrink-0 cursor-pointer"
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
                      className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors cursor-pointer"
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
                      className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors shrink-0 cursor-pointer"
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
                      className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors shrink-0 cursor-pointer"
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
                      className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors cursor-pointer"
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
                className="px-1.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors shrink-0 cursor-pointer"
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
                className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors cursor-pointer"
              >
                B: {styles.margin.bottom || styles.margin.top || '0'}
              </button>
            </div>
          </div>
        </div>
      </StudioSection>

      {/* ── 2. Layout Grid & Columns ── */}
      <StudioSection
        title="Layout & Multi-Columns"
        badge="Multi-Col"
        action={<Columns3 size={13} className="text-accent-gold" />}
      >
        <div className="grid grid-cols-2 gap-2">
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
      </StudioSection>

      {/* ── 3. Border & Corner Radius ── */}
      <StudioSection
        title="Border & Corner Radius"
        badge="Geometry"
        action={
          <button
            type="button"
            data-testid="corner-radius-link-toggle"
            onClick={() =>
              setStyles({
                ...styles,
                border: {
                  ...styles.border,
                  radiusLinked: styles.border.radiusLinked === false,
                },
              })
            }
            title={
              styles.border.radiusLinked === false
                ? 'Link corners together'
                : 'Unlink individual 4 corners'
            }
            className="text-[9px] text-accent-gold flex items-center gap-1 hover:underline cursor-pointer"
          >
            {styles.border.radiusLinked === false ? <Unlink2 size={10} /> : <Link2 size={10} />}
            <span>{styles.border.radiusLinked === false ? 'Unlinked' : 'Linked'}</span>
          </button>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StudioSelect
            id={radiusSelectId}
            label="Corner Radius"
            value={styles.border.radius}
            onChange={(val) =>
              setStyles({
                ...styles,
                border: { ...styles.border, radius: val },
              })
            }
            options={[
              { value: 'rounded-none', label: 'Square (0)' },
              { value: 'rounded-md', label: 'Subtle (6px)' },
              { value: 'rounded-xl', label: 'Standard (12px)' },
              { value: 'rounded-2xl', label: 'Modern Card (16px)' },
              { value: 'rounded-3xl', label: 'Pill Smooth (24px)' },
              { value: 'rounded-full', label: 'Full Capsule' },
              { value: 'rounded-t-2xl', label: 'Top Rounded' },
              { value: 'rounded-b-2xl', label: 'Bottom Rounded' },
            ]}
          />
          <StudioSelect
            id={borderWidthSelectId}
            label="Border Width"
            value={styles.border.width}
            onChange={(val) =>
              setStyles({
                ...styles,
                border: { ...styles.border, width: val },
              })
            }
            options={[
              { value: 'border-0', label: 'No Border' },
              { value: 'border', label: 'Thin (1px)' },
              { value: 'border-2', label: 'Medium (2px)' },
              { value: 'border-4', label: 'Heavy (4px)' },
              { value: 'border-8', label: 'Thick Accent (8px)' },
            ]}
          />
          <StudioSelect
            id={borderStyleSelectId}
            label="Border Style"
            value={styles.border.style}
            onChange={(val) =>
              setStyles({
                ...styles,
                border: {
                  ...styles.border,
                  style: val as typeof styles.border.style,
                },
              })
            }
            options={[
              { value: 'solid', label: 'Solid Line' },
              { value: 'dashed', label: 'Dashed Line' },
              { value: 'dotted', label: 'Dotted Line' },
              { value: 'double', label: 'Double Line' },
              { value: 'none', label: 'None' },
            ]}
          />
          <StudioSelect
            id={borderSideSelectId}
            label="Border Sides"
            value={styles.border.side}
            onChange={(val) =>
              setStyles({
                ...styles,
                border: {
                  ...styles.border,
                  side: val as typeof styles.border.side,
                },
              })
            }
            options={[
              { value: 'all', label: 'All 4 Sides' },
              { value: 'left', label: 'Left Accent Bar' },
              { value: 'top', label: 'Top Accent Bar' },
              { value: 'bottom', label: 'Bottom Accent Bar' },
              { value: 'right', label: 'Right Accent Bar' },
              { value: 'y', label: 'Top & Bottom' },
            ]}
          />
        </div>

        {/* 4-Corner Independent Unlinked Radius */}
        {styles.border.radiusLinked === false && (
          <div className="mt-2 p-2.5 rounded-xl border border-white/10 bg-white/5 space-y-1.5">
            <span className="text-[10px] text-slate-300 font-bold block">
              4-Corner Radius Controls (Pro)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <StudioSelect
                id={radiusTopLeftSelectId}
                label="Top-Left"
                value={styles.border.radiusTopLeft || ''}
                onChange={(val) =>
                  setStyles({
                    ...styles,
                    border: { ...styles.border, radiusTopLeft: val },
                  })
                }
                options={[
                  { value: '', label: 'Default (0)' },
                  { value: 'rounded-tl-none', label: 'Square (0)' },
                  { value: 'rounded-tl-md', label: 'Subtle (6px)' },
                  { value: 'rounded-tl-xl', label: 'Medium (12px)' },
                  { value: 'rounded-tl-2xl', label: 'Modern (16px)' },
                  { value: 'rounded-tl-3xl', label: 'Pill (24px)' },
                  { value: 'rounded-tl-full', label: 'Full' },
                ]}
                size="xs"
              />
              <StudioSelect
                id={radiusTopRightSelectId}
                label="Top-Right"
                value={styles.border.radiusTopRight || ''}
                onChange={(val) =>
                  setStyles({
                    ...styles,
                    border: { ...styles.border, radiusTopRight: val },
                  })
                }
                options={[
                  { value: '', label: 'Default (0)' },
                  { value: 'rounded-tr-none', label: 'Square (0)' },
                  { value: 'rounded-tr-md', label: 'Subtle (6px)' },
                  { value: 'rounded-tr-xl', label: 'Medium (12px)' },
                  { value: 'rounded-tr-2xl', label: 'Modern (16px)' },
                  { value: 'rounded-tr-3xl', label: 'Pill (24px)' },
                  { value: 'rounded-tr-full', label: 'Full' },
                ]}
                size="xs"
              />
              <StudioSelect
                id={radiusBottomRightSelectId}
                label="Bottom-Right"
                value={styles.border.radiusBottomRight || ''}
                onChange={(val) =>
                  setStyles({
                    ...styles,
                    border: { ...styles.border, radiusBottomRight: val },
                  })
                }
                options={[
                  { value: '', label: 'Default (0)' },
                  { value: 'rounded-br-none', label: 'Square (0)' },
                  { value: 'rounded-br-md', label: 'Subtle (6px)' },
                  { value: 'rounded-br-xl', label: 'Medium (12px)' },
                  { value: 'rounded-br-2xl', label: 'Modern (16px)' },
                  { value: 'rounded-br-3xl', label: 'Pill (24px)' },
                  { value: 'rounded-br-full', label: 'Full' },
                ]}
                size="xs"
              />
              <StudioSelect
                id={radiusBottomLeftSelectId}
                label="Bottom-Left"
                value={styles.border.radiusBottomLeft || ''}
                onChange={(val) =>
                  setStyles({
                    ...styles,
                    border: { ...styles.border, radiusBottomLeft: val },
                  })
                }
                options={[
                  { value: '', label: 'Default (0)' },
                  { value: 'rounded-bl-none', label: 'Square (0)' },
                  { value: 'rounded-bl-md', label: 'Subtle (6px)' },
                  { value: 'rounded-bl-xl', label: 'Medium (12px)' },
                  { value: 'rounded-bl-2xl', label: 'Modern (16px)' },
                  { value: 'rounded-bl-3xl', label: 'Pill (24px)' },
                  { value: 'rounded-bl-full', label: 'Full' },
                ]}
                size="xs"
              />
            </div>
          </div>
        )}

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
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] transition-colors cursor-pointer ${
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
      </StudioSection>

      {/* ── 4. Background & Elevation ── */}
      <StudioSection
        title="Background & Elevation"
        badge="Surface"
        description="Choose element surface tone, shadow depth, dark/light theme lock, and custom shape masks."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <StudioSelect
            id={bgThemeSelectId}
            label="Background Theme"
            value={styles.background.preset}
            onChange={(val) =>
              setStyles({
                ...styles,
                background: { ...styles.background, preset: val },
              })
            }
            options={[
              { value: 'bg-transparent', label: 'Transparent' },
              { value: 'bg-slate-900/60', label: 'Slate Card (60%)' },
              { value: 'bg-slate-950/90', label: 'Deep Midnight' },
              { value: 'bg-amber-500/10', label: 'Civic Gold Light' },
              { value: 'bg-emerald-500/10', label: 'Community Green' },
              { value: 'bg-rose-500/10', label: 'Alert Crimson' },
              { value: 'bg-white/10', label: 'Glass Surface' },
            ]}
          />
          <ColorSwatchPicker
            label="Quick Surface Tint"
            value={styles.background.preset}
            onChange={(val) =>
              setStyles({
                ...styles,
                background: { ...styles.background, preset: val, gradient: '' },
              })
            }
          />
          <StudioSelect
            id={shadowSelectId}
            label="Elevation Shadow"
            value={styles.shadow}
            onChange={(val) => setStyles({ ...styles, shadow: val })}
            options={[
              { value: 'shadow-none', label: 'Flat (None)' },
              { value: 'shadow-sm', label: 'Subtle Soft' },
              { value: 'shadow-md', label: 'Medium Card' },
              { value: 'shadow-lg', label: 'Elevated Surface' },
              { value: 'shadow-xl', label: 'High Elevation' },
              { value: 'shadow-2xl', label: 'Maximum Depth' },
              { value: 'shadow-inner', label: 'Inset Recessed' },
              { value: 'shadow-lg shadow-amber-500/25', label: 'Civic Gold Glow' },
              { value: 'shadow-lg shadow-sky-500/25', label: 'Cyan Tech Glow' },
              { value: 'shadow-2xl shadow-blue-950/60', label: 'Patriotic Navy Shadow' },
            ]}
          />
          <ThemeModeSelector
            id={blockThemeModeSelectId}
            label="Element Theme Mode"
            value={styles.themeMode || 'inherit'}
            onChange={(val) =>
              setStyles({
                ...styles,
                themeMode: val,
              })
            }
            description="Forces block into dark, light, or system reactive palette."
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <StudioSelect
            id={shadowColorSelectId}
            label="Shadow Aura Glow (Pro)"
            value={styles.effects.shadowColor || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, shadowColor: val },
              })
            }
            options={[
              { value: '', label: 'Default Shadow Tint' },
              { value: 'shadow-amber-500/20', label: 'Civic Gold Aura (20%)' },
              { value: 'shadow-blue-500/30', label: 'Navy / Sky Aura (30%)' },
              { value: 'shadow-emerald-500/20', label: 'Forest Emerald Glow' },
              { value: 'shadow-rose-500/25', label: 'Crimson Alert Glow' },
              { value: 'shadow-white/10', label: 'Frost White Radiance' },
              { value: 'shadow-black/50', label: 'High-Contrast Deep Black' },
            ]}
          />
          <StudioSelect
            id={clipPathSelectId}
            label="Shape Mask / Clip Path (Pro)"
            value={styles.effects.clipPath || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, clipPath: val },
              })
            }
            options={[
              { value: '', label: 'None (Standard Box)' },
              {
                value: '[clip-path:polygon(0_0,100%_0,100%_85%,0_100%)]',
                label: 'Angled Slant (Bottom Cut)',
              },
              {
                value: '[clip-path:polygon(0_15%,100%_0,100%_100%,0_100%)]',
                label: 'Angled Slant (Top Cut)',
              },
              {
                value: '[clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]',
                label: 'Diamond Badge Mask',
              },
              {
                value: '[clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]',
                label: 'Hexagon Badge Mask',
              },
              { value: '[clip-path:ellipse(50%_50%_at_50%_50%)]', label: 'Smooth Ellipse' },
            ]}
          />
        </div>
      </StudioSection>

      {/* ── 5. Decorative Corner Ribbon / Badge ── */}
      <StudioSection
        title="Decorative Badge / Ribbon Accent (Pro)"
        badge="Pro"
        action={<Sparkles size={13} className="text-accent-gold" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <StudioInput
            id="block-badge-text-input"
            label="Badge Label Text"
            value={styles.badgeText || ''}
            onChange={(val) => setStyles({ ...styles, badgeText: val })}
            placeholder="e.g. NEW, FEATURED"
          />
          <StudioSelect
            id="block-badge-tone-select"
            label="Badge Tone"
            value={styles.badgeTone || 'gold'}
            onChange={(val) =>
              setStyles({
                ...styles,
                badgeTone: val as VisualComposerStyles['badgeTone'],
              })
            }
            options={[
              { value: 'gold', label: 'Civic Gold' },
              { value: 'navy', label: 'Patriotic Navy' },
              { value: 'emerald', label: 'Grassroots Emerald' },
              { value: 'crimson', label: 'Action Alert Crimson' },
              { value: 'slate', label: 'Subtle Charcoal' },
            ]}
          />
          <StudioSelect
            id="block-badge-pos-select"
            label="Badge Position"
            value={styles.badgePosition || 'top-right'}
            onChange={(val) =>
              setStyles({
                ...styles,
                badgePosition: val as VisualComposerStyles['badgePosition'],
              })
            }
            options={[
              { value: 'top-right', label: 'Top Right Corner' },
              { value: 'top-left', label: 'Top Left Corner' },
            ]}
          />
        </div>
      </StudioSection>

      {/* ── 6. Layout, Display & Sizing Studio ── */}
      <StudioSection
        title="Layout, Display & Sizing"
        badge="Dimensions"
        description="Fine-tune display flow, widths, heights, flex alignment, and positioning offsets."
      >
        <div className="grid grid-cols-2 gap-2 mb-2">
          <StudioSelect
            id={layoutDisplaySelectId}
            label="Display Mode"
            value={styles.layout.display}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, display: val },
              })
            }
            options={[
              { value: '', label: 'Default (Normal Flow)' },
              { value: 'block', label: 'Block' },
              { value: 'inline-block', label: 'Inline Block' },
              { value: 'flex', label: 'Flex Container' },
              { value: 'inline-flex', label: 'Inline Flex' },
              { value: 'grid', label: 'Grid Container' },
            ]}
          />
          <StudioSelect
            id={layoutMaxWidthSelectId}
            label="Max Width Container"
            value={styles.layout.maxWidth}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, maxWidth: val },
              })
            }
            options={[
              { value: '', label: 'Full Width (Auto)' },
              { value: 'max-w-prose', label: 'Prose Reading (65ch)' },
              { value: 'max-w-sm', label: 'Small (384px)' },
              { value: 'max-w-md', label: 'Medium (448px)' },
              { value: 'max-w-lg', label: 'Large (512px)' },
              { value: 'max-w-xl', label: 'Extra Large (576px)' },
              { value: 'max-w-2xl', label: '2X Large (672px)' },
              { value: 'max-w-4xl', label: '4X Large (896px)' },
            ]}
          />
        </div>

        {/* Width & Min-Width Grid */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <StudioSelect
            id={layoutWidthSelectId}
            label="Element Width"
            value={styles.layout.width || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, width: val },
              })
            }
            options={[
              { value: '', label: 'Auto (Default)' },
              { value: 'w-full', label: 'Full Width (100%)' },
              { value: 'w-1/2', label: 'Half Width (50%)' },
              { value: 'w-1/3', label: 'One Third (33%)' },
              { value: 'w-2/3', label: 'Two Thirds (66%)' },
              { value: 'w-3/4', label: 'Three Fourths (75%)' },
              { value: 'w-1/4', label: 'One Fourth (25%)' },
              { value: 'w-fit', label: 'Fit Content (w-fit)' },
              { value: 'w-max', label: 'Max Content (w-max)' },
            ]}
          />
          <StudioSelect
            id={layoutMinWidthSelectId}
            label="Min Width"
            value={styles.layout.minWidth || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, minWidth: val },
              })
            }
            options={[
              { value: '', label: 'None (0)' },
              { value: 'min-w-0', label: 'Allow Shrink (min-w-0)' },
              { value: 'min-w-full', label: 'Full Canvas (100%)' },
              { value: 'min-w-[200px]', label: '200px Minimum' },
              { value: 'min-w-[300px]', label: '300px Minimum' },
              { value: 'min-w-min', label: 'Min Content' },
              { value: 'min-w-max', label: 'Max Content' },
            ]}
          />
        </div>

        {/* Height, Min-Height & Max-Height Grid */}
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <StudioSelect
            id={layoutHeightSelectId}
            label="Height"
            value={styles.layout.height || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, height: val },
              })
            }
            options={[
              { value: '', label: 'Auto (Content)' },
              { value: 'h-full', label: 'Full Height (100%)' },
              { value: 'h-24', label: '96px (h-24)' },
              { value: 'h-32', label: '128px (h-32)' },
              { value: 'h-48', label: '192px (h-48)' },
              { value: 'h-64', label: '256px (h-64)' },
              { value: 'h-96', label: '384px (h-96)' },
              { value: 'h-screen', label: 'Screen (100vh)' },
            ]}
          />
          <StudioSelect
            id={layoutMinHeightSelectId}
            label="Min Height"
            value={styles.layout.minHeight || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, minHeight: val },
              })
            }
            options={[
              { value: '', label: 'None (0)' },
              { value: 'min-h-[100px]', label: '100px' },
              { value: 'min-h-[200px]', label: '200px' },
              { value: 'min-h-[300px]', label: '300px' },
              { value: 'min-h-full', label: 'Full (100%)' },
              { value: 'min-h-screen', label: 'Screen (100vh)' },
            ]}
          />
          <StudioSelect
            id={layoutMaxHeightSelectId}
            label="Max Height"
            value={styles.layout.maxHeight || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, maxHeight: val },
              })
            }
            options={[
              { value: '', label: 'None (Unlimited)' },
              { value: 'max-h-full', label: 'Full (100%)' },
              { value: 'max-h-96', label: '384px (max-h-96)' },
              { value: 'max-h-[500px]', label: '500px' },
              { value: 'max-h-screen', label: 'Screen (100vh)' },
            ]}
          />
        </div>

        {/* Flex Options if display is flex */}
        {(styles.layout.display === 'flex' || styles.layout.display === 'inline-flex') && (
          <div className="grid grid-cols-4 gap-1.5 p-2 rounded-xl bg-white/5 border border-white/10 mb-2">
            <StudioSelect
              id={layoutFlexDirSelectId}
              label="Direction"
              value={styles.layout.flexDirection}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, flexDirection: val },
                })
              }
              options={[
                { value: 'flex-row', label: 'Row' },
                { value: 'flex-col', label: 'Column' },
                { value: 'flex-row-reverse', label: 'Row Rev' },
                { value: 'flex-col-reverse', label: 'Col Rev' },
              ]}
              size="xs"
            />
            <StudioSelect
              id={layoutJustifySelectId}
              label="Justify"
              value={styles.layout.justifyContent}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, justifyContent: val },
                })
              }
              options={[
                { value: 'justify-start', label: 'Start' },
                { value: 'justify-center', label: 'Center' },
                { value: 'justify-end', label: 'End' },
                { value: 'justify-between', label: 'Between' },
                { value: 'justify-around', label: 'Around' },
              ]}
              size="xs"
            />
            <StudioSelect
              id={layoutAlignSelectId}
              label="Align Items"
              value={styles.layout.alignItems}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, alignItems: val },
                })
              }
              options={[
                { value: 'items-start', label: 'Start' },
                { value: 'items-center', label: 'Center' },
                { value: 'items-end', label: 'End' },
                { value: 'items-stretch', label: 'Stretch' },
              ]}
              size="xs"
            />
            <StudioSelect
              id={layoutFlexWrapSelectId}
              label="Wrap"
              value={styles.layout.flexWrap || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, flexWrap: val },
                })
              }
              options={[
                { value: '', label: 'No Wrap' },
                { value: 'flex-wrap', label: 'Wrap' },
                { value: 'flex-wrap-reverse', label: 'Reverse' },
              ]}
              size="xs"
            />
          </div>
        )}

        {/* Flex Child & Self-Alignment */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
          <StudioSelect
            id={layoutAlignSelfSelectId}
            label="Self Alignment"
            value={styles.layout.alignSelf || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, alignSelf: val },
              })
            }
            options={[
              { value: '', label: 'Default (Auto)' },
              { value: 'self-auto', label: 'Auto (self-auto)' },
              { value: 'self-start', label: 'Start / Top (self-start)' },
              { value: 'self-center', label: 'Centered (self-center)' },
              { value: 'self-end', label: 'End / Bottom (self-end)' },
              { value: 'self-stretch', label: 'Stretch (self-stretch)' },
              { value: 'self-baseline', label: 'Baseline (self-baseline)' },
            ]}
          />
          <StudioSelect
            id={layoutOrderSelectId}
            label="Display Order"
            value={styles.layout.order || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, order: val },
              })
            }
            options={[
              { value: '', label: 'Natural Order' },
              { value: 'order-first', label: 'Order First' },
              { value: 'order-last', label: 'Order Last' },
              { value: 'order-1', label: 'Position 1' },
              { value: 'order-2', label: 'Position 2' },
              { value: 'order-3', label: 'Position 3' },
            ]}
          />
          <StudioSelect
            id={layoutFlexGrowSelectId}
            label="Flex Sizing"
            value={styles.layout.flexGrow || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, flexGrow: val },
              })
            }
            options={[
              { value: '', label: 'Default Sizing' },
              { value: 'grow', label: 'Grow to Fill (grow)' },
              { value: 'grow-0', label: 'Fixed Scale (grow-0)' },
              { value: 'shrink', label: 'Allow Shrink (shrink)' },
              { value: 'shrink-0', label: 'Prevent Shrink (shrink-0)' },
            ]}
          />
          <StudioSelect
            id={layoutFlexShrinkSelectId}
            label="Flex Shrink"
            value={styles.layout.flexShrink || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, flexShrink: val },
              })
            }
            options={[
              { value: '', label: 'Default Shrink' },
              { value: 'shrink', label: 'Allow Shrink (shrink)' },
              { value: 'shrink-0', label: 'Prevent Shrink (shrink-0)' },
            ]}
          />
        </div>

        {/* Media Aspect Ratio & Object Fit */}
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <StudioSelect
            id={layoutAspectRatioSelectId}
            label="Aspect Ratio"
            value={styles.layout.aspectRatio || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, aspectRatio: val },
              })
            }
            options={[
              { value: '', label: 'Natural Ratio (Auto)' },
              { value: 'aspect-square', label: 'Square 1:1 (aspect-square)' },
              { value: 'aspect-video', label: 'Widescreen 16:9 (aspect-video)' },
              { value: 'aspect-[4/3]', label: 'Standard Photo 4:3' },
              { value: 'aspect-[3/2]', label: 'Classic 3:2' },
              { value: 'aspect-[21/9]', label: 'Cinematic Ultra-Wide 21:9' },
            ]}
          />
          <StudioSelect
            id={layoutObjectFitSelectId}
            label="Media Object Fit"
            value={styles.layout.objectFit || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, objectFit: val },
              })
            }
            options={[
              { value: '', label: 'Default Fit' },
              { value: 'object-cover', label: 'Cover (Fill Boundary)' },
              { value: 'object-contain', label: 'Contain (Keep Proportions)' },
              { value: 'object-fill', label: 'Fill (Stretch)' },
              { value: 'object-scale-down', label: 'Scale Down' },
            ]}
          />
        </div>

        {/* Positioning & Layering */}
        <div className="grid grid-cols-3 gap-1.5">
          <StudioSelect
            id={layoutPositionSelectId}
            label="Position"
            value={styles.layout.position}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, position: val },
              })
            }
            options={[
              { value: '', label: 'Static' },
              { value: 'relative', label: 'Relative' },
              { value: 'sticky top-0', label: 'Sticky Top-0' },
              { value: 'sticky top-4', label: 'Sticky Top-4' },
              { value: 'absolute', label: 'Absolute' },
            ]}
          />
          <StudioSelect
            id={layoutZIndexSelectId}
            label="Z-Index"
            value={styles.layout.zIndex}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, zIndex: val },
              })
            }
            options={[
              { value: '', label: 'Auto' },
              { value: 'z-0', label: 'z-0' },
              { value: 'z-10', label: 'z-10' },
              { value: 'z-20', label: 'z-20' },
              { value: 'z-30', label: 'z-30' },
              { value: 'z-40', label: 'z-40' },
              { value: 'z-50', label: 'z-50' },
            ]}
          />
          <StudioSelect
            id={layoutOverflowSelectId}
            label="Overflow"
            value={styles.layout.overflow}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, overflow: val },
              })
            }
            options={[
              { value: '', label: 'Visible' },
              { value: 'overflow-hidden', label: 'Hidden' },
              { value: 'overflow-auto', label: 'Auto Scroll' },
              { value: 'overflow-x-auto', label: 'Scroll X' },
            ]}
          />
        </div>

        {/* Directional Positioning Offsets (Pro) */}
        <div className="mt-2 p-2 rounded-lg border border-white/10 bg-white/5 space-y-1.5">
          <span className="text-[10px] text-slate-300 font-bold block">
            Directional Positioning Offsets (Pro)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            <StudioSelect
              id={layoutInsetSelectId}
              label="Inset All"
              value={styles.layout.inset || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, inset: val },
                })
              }
              options={[
                { value: '', label: 'Auto' },
                { value: 'inset-0', label: 'Cover (0)' },
                { value: 'inset-2', label: 'Inset 8px' },
                { value: 'inset-4', label: 'Inset 16px' },
                { value: 'inset-x-0', label: 'Span X (0)' },
                { value: 'inset-y-0', label: 'Span Y (0)' },
              ]}
              size="xs"
            />
            <StudioSelect
              id={layoutTopSelectId}
              label="Top"
              value={styles.layout.top || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, top: val },
                })
              }
              options={[
                { value: '', label: 'Auto' },
                { value: 'top-0', label: 'Top 0' },
                { value: 'top-2', label: 'Top 8px' },
                { value: 'top-4', label: 'Top 16px' },
                { value: 'top-8', label: 'Top 32px' },
                { value: 'top-1/2', label: 'Top 50%' },
                { value: '-top-4', label: '-16px Pull' },
              ]}
              size="xs"
            />
            <StudioSelect
              id={layoutBottomSelectId}
              label="Bottom"
              value={styles.layout.bottom || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, bottom: val },
                })
              }
              options={[
                { value: '', label: 'Auto' },
                { value: 'bottom-0', label: 'Bottom 0' },
                { value: 'bottom-2', label: 'Bottom 8px' },
                { value: 'bottom-4', label: 'Bottom 16px' },
                { value: 'bottom-8', label: 'Bottom 32px' },
                { value: '-bottom-4', label: '-16px Pull' },
              ]}
              size="xs"
            />
            <StudioSelect
              id={layoutLeftSelectId}
              label="Left"
              value={styles.layout.left || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, left: val },
                })
              }
              options={[
                { value: '', label: 'Auto' },
                { value: 'left-0', label: 'Left 0' },
                { value: 'left-2', label: 'Left 8px' },
                { value: 'left-4', label: 'Left 16px' },
                { value: 'left-1/2', label: 'Left 50%' },
                { value: '-left-4', label: '-16px Pull' },
              ]}
              size="xs"
            />
            <StudioSelect
              id={layoutRightSelectId}
              label="Right"
              value={styles.layout.right || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  layout: { ...styles.layout, right: val },
                })
              }
              options={[
                { value: '', label: 'Auto' },
                { value: 'right-0', label: 'Right 0' },
                { value: 'right-2', label: 'Right 8px' },
                { value: 'right-4', label: 'Right 16px' },
                { value: 'right-8', label: 'Right 32px' },
                { value: '-right-4', label: '-16px Pull' },
              ]}
              size="xs"
            />
          </div>
        </div>

        {/* Interactive Cursor & Visibility */}
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <StudioSelect
            id={layoutCursorSelectId}
            label="Cursor Behavior"
            value={styles.layout.cursor || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, cursor: val },
              })
            }
            options={[
              { value: '', label: 'Default (Browser)' },
              { value: 'cursor-pointer', label: 'Clickable Pointer (cursor-pointer)' },
              { value: 'cursor-grab', label: 'Draggable Grab (cursor-grab)' },
              { value: 'cursor-text', label: 'Text Selection (cursor-text)' },
              { value: 'cursor-not-allowed', label: 'Disabled / Not Allowed (cursor-not-allowed)' },
              { value: 'cursor-default', label: 'Arrow Default (cursor-default)' },
            ]}
          />
          <StudioSelect
            id={layoutVisibilitySelectId}
            label="CSS Visibility"
            value={styles.layout.visibility || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, visibility: val },
              })
            }
            options={[
              { value: '', label: 'Default (visible)' },
              { value: 'visible', label: 'Force Visible (visible)' },
              { value: 'invisible', label: 'Hidden in DOM Space (invisible)' },
            ]}
          />
        </div>

        {/* Pointer Events & User Selection */}
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <StudioSelect
            id={layoutPointerEventsSelectId}
            label="Pointer Events"
            value={styles.layout.pointerEvents || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, pointerEvents: val },
              })
            }
            options={[
              { value: '', label: 'Default (Auto)' },
              { value: 'pointer-events-auto', label: 'Interactive (pointer-events-auto)' },
              { value: 'pointer-events-none', label: 'Pass Through (pointer-events-none)' },
            ]}
          />
          <StudioSelect
            id={layoutUserSelectSelectId}
            label="User Selection"
            value={styles.layout.userSelect || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, userSelect: val },
              })
            }
            options={[
              { value: '', label: 'Default (Selectable)' },
              { value: 'select-none', label: 'Prevent Selection (select-none)' },
              { value: 'select-text', label: 'Select Text (select-text)' },
              { value: 'select-all', label: 'Select All on Click (select-all)' },
            ]}
          />
        </div>
      </StudioSection>

      {/* ── 7. Glassmorphism & Visual Effects ── */}
      <StudioSection
        title="Glassmorphism & Visual Effects"
        badge="FX Studio"
        description="Stack optical filters, backdrop blur, brightness shifts, and blend modes."
      >
        <div className="grid grid-cols-3 gap-1.5">
          <StudioSelect
            id={effectBackdropBlurSelectId}
            label="Backdrop Blur"
            value={styles.effects.backdropBlur}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, backdropBlur: val },
              })
            }
            options={[
              { value: '', label: 'None' },
              { value: 'backdrop-blur-sm', label: 'Subtle (sm)' },
              { value: 'backdrop-blur-md', label: 'Medium (md)' },
              { value: 'backdrop-blur-lg', label: 'Deep (lg)' },
              { value: 'backdrop-blur-xl', label: 'Ultra Glass (xl)' },
            ]}
          />
          <StudioSelect
            id={effectOpacitySelectId}
            label="Opacity"
            value={styles.effects.opacity}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, opacity: val },
              })
            }
            options={[
              { value: '', label: '100% Solid' },
              { value: 'opacity-90', label: '90%' },
              { value: 'opacity-80', label: '80%' },
              { value: 'opacity-70', label: '70%' },
              { value: 'opacity-50', label: '50% Dimmed' },
            ]}
          />
          <StudioSelect
            id={effectGrayscaleSelectId}
            label="Grayscale Filter"
            value={styles.effects.grayscale}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, grayscale: val },
              })
            }
            options={[
              { value: '', label: 'Full Color' },
              { value: 'grayscale', label: 'Full Grayscale' },
              {
                value: 'grayscale hover:grayscale-0 transition-all duration-300',
                label: 'Hover Reveal Color',
              },
            ]}
          />
        </div>

        {/* CSS Filters & Color Grading */}
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <StudioSelect
            id={effectBrightnessSelectId}
            label="Brightness"
            value={styles.effects.brightness || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, brightness: val },
              })
            }
            options={[
              { value: '', label: 'Normal (100%)' },
              { value: 'brightness-50', label: 'Dim (50%)' },
              { value: 'brightness-75', label: 'Subtle Dim (75%)' },
              { value: 'brightness-90', label: 'Moody (90%)' },
              { value: 'brightness-110', label: 'Highlight (+10%)' },
              { value: 'brightness-125', label: 'Luminous (+25%)' },
              { value: 'brightness-150', label: 'Radiant Pop (+50%)' },
            ]}
          />
          <StudioSelect
            id={effectContrastSelectId}
            label="Contrast"
            value={styles.effects.contrast || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, contrast: val },
              })
            }
            options={[
              { value: '', label: 'Normal (100%)' },
              { value: 'contrast-50', label: 'Muted (50%)' },
              { value: 'contrast-75', label: 'Soft Low (75%)' },
              { value: 'contrast-125', label: 'Punchy (+25%)' },
              { value: 'contrast-150', label: 'High Dynamic (+50%)' },
              { value: 'contrast-200', label: 'Dramatic Black & White (+100%)' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <StudioSelect
            id={effectSaturateSelectId}
            label="Saturation"
            value={styles.effects.saturate || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, saturate: val },
              })
            }
            options={[
              { value: '', label: '100% Normal' },
              { value: 'saturate-50', label: '50% Desaturated' },
              { value: 'saturate-150', label: '150% Vibrant Rich' },
              { value: 'saturate-200', label: '200% Super Saturated' },
            ]}
          />
          <StudioSelect
            id={effectHueRotateSelectId}
            label="Hue Shift (Color Shift)"
            value={styles.effects.hueRotate || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, hueRotate: val },
              })
            }
            options={[
              { value: '', label: '0° Normal' },
              { value: 'hue-rotate-15', label: '15° Warm Shift' },
              { value: 'hue-rotate-30', label: '30° Golden Amber' },
              { value: 'hue-rotate-60', label: '60° Emerald Green' },
              { value: 'hue-rotate-90', label: '90° Cyan Accent' },
              { value: 'hue-rotate-180', label: '180° Inverted Spectrum' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <StudioSelect
            id={effectSepiaSelectId}
            label="Sepia Vintage"
            value={styles.effects.sepia || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, sepia: val },
              })
            }
            options={[
              { value: '', label: 'None (Modern Color)' },
              { value: 'sepia', label: 'Warm Sepia Tone' },
              {
                value: 'sepia hover:sepia-0 transition-all duration-300',
                label: 'Hover Reveal Modern',
              },
            ]}
          />
          <StudioSelect
            id={effectBlurSelectId}
            label="Element Blur Filter"
            value={styles.effects.blur || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, blur: val },
              })
            }
            options={[
              { value: '', label: 'Sharp (No Blur)' },
              { value: 'blur-xs', label: 'Soft Focus (xs)' },
              { value: 'blur-sm', label: 'Light Blur (sm)' },
              { value: 'blur-md', label: 'Medium Bokeh (md)' },
            ]}
          />
        </div>

        <div className="mt-1.5">
          <StudioSelect
            id={effectBlendModeSelectId}
            label="Mix Blend Mode (Layer Blending)"
            value={styles.effects.blendMode || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, blendMode: val },
              })
            }
            options={[
              { value: '', label: 'Normal (Default)' },
              { value: 'mix-blend-multiply', label: 'Multiply (Darken / Shadow)' },
              { value: 'mix-blend-screen', label: 'Screen (Lighten / Glow)' },
              { value: 'mix-blend-overlay', label: 'Overlay (High Contrast)' },
              { value: 'mix-blend-darken', label: 'Darken' },
              { value: 'mix-blend-lighten', label: 'Lighten' },
              { value: 'mix-blend-color-dodge', label: 'Color Dodge (Intense Glow)' },
              { value: 'mix-blend-color-burn', label: 'Color Burn (Deep Shadow)' },
              { value: 'mix-blend-hard-light', label: 'Hard Light' },
              { value: 'mix-blend-soft-light', label: 'Soft Light' },
              { value: 'mix-blend-difference', label: 'Difference (Inversion Effect)' },
              { value: 'mix-blend-exclusion', label: 'Exclusion' },
              { value: 'mix-blend-luminosity', label: 'Luminosity (Luma Blend)' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <StudioSelect
            id={effectHoverBrightnessSelectId}
            label="Hover Brightness Shift"
            value={styles.effects.hoverBrightness || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, hoverBrightness: val },
              })
            }
            options={[
              { value: '', label: 'No Brightness Shift' },
              { value: 'hover:brightness-105 transition-all', label: 'Subtle Light (+5%)' },
              { value: 'hover:brightness-110 transition-all', label: 'Luminous (+10%)' },
              { value: 'hover:brightness-125 transition-all', label: 'High Radiance (+25%)' },
              { value: 'hover:brightness-90 transition-all', label: 'Darken Depth (-10%)' },
              { value: 'hover:brightness-75 transition-all', label: 'Moody Shadow (-25%)' },
            ]}
          />
          <StudioSelect
            id={effectHoverOpacitySelectId}
            label="Hover Opacity Shift"
            value={styles.effects.hoverOpacity || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, hoverOpacity: val },
              })
            }
            options={[
              { value: '', label: 'No Opacity Shift' },
              { value: 'hover:opacity-100 transition-opacity', label: 'Force Opaque (100%)' },
              { value: 'hover:opacity-90 transition-opacity', label: 'Gentle Fade (90%)' },
              { value: 'hover:opacity-80 transition-opacity', label: 'Medium Translucent (80%)' },
              { value: 'hover:opacity-60 transition-opacity', label: 'Ghost Subtle (60%)' },
            ]}
          />
        </div>

        {/* CSS Invert & Drop Shadow */}
        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <StudioSelect
            id={effectInvertSelectId}
            label="CSS Invert Filter"
            value={styles.effects.invert || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, invert: val },
              })
            }
            options={[
              { value: '', label: 'Normal (0% Invert)' },
              { value: 'invert', label: 'Full Invert (100%)' },
            ]}
          />
          <StudioSelect
            id={effectDropShadowSelectId}
            label="CSS Drop Shadow (Alpha)"
            value={styles.effects.dropShadow || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, dropShadow: val },
              })
            }
            options={[
              { value: '', label: 'None (No Drop Shadow)' },
              { value: 'drop-shadow-sm', label: 'Subtle Soft (sm)' },
              { value: 'drop-shadow-md', label: 'Medium Silhouette (md)' },
              { value: 'drop-shadow-lg', label: 'Elevated Alpha (lg)' },
              { value: 'drop-shadow-xl', label: 'High Silhouette (xl)' },
              { value: 'drop-shadow-2xl', label: 'Maximum Depth (2xl)' },
            ]}
          />
        </div>
      </StudioSection>

      {/* ── 8. Transforms & 3D Tilt Studio ── */}
      <StudioSection
        title="Transforms & 3D Tilt"
        badge="3D Motion"
        description="Apply physical angles, scale spotlighting, slant, and 2D translation offsets."
      >
        <div className="grid grid-cols-3 gap-1.5">
          <StudioSelect
            id={transformRotateSelectId}
            label="Rotation Angle"
            value={styles.transform?.rotate || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                transform: { ...styles.transform, rotate: val },
              })
            }
            options={[
              { value: '', label: '0° (Flat)' },
              { value: 'rotate-1', label: '1° Subtle Right' },
              { value: '-rotate-1', label: '-1° Subtle Left' },
              { value: 'rotate-2', label: '2° Dynamic Angle' },
              { value: '-rotate-2', label: '-2° Dynamic Angle' },
              { value: 'rotate-3', label: '3° Playful Tilt' },
              { value: '-rotate-3', label: '-3° Playful Tilt' },
              { value: 'rotate-6', label: '6° Accent Stamp' },
              { value: '-rotate-6', label: '-6° Accent Stamp' },
            ]}
          />
          <StudioSelect
            id={transformScaleSelectId}
            label="Scale Size"
            value={styles.transform?.scale || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                transform: { ...styles.transform, scale: val },
              })
            }
            options={[
              { value: '', label: '100% Normal' },
              { value: 'scale-95', label: '95% Compact' },
              { value: 'scale-105', label: '105% Spotlight Pop' },
              { value: 'scale-110', label: '110% Heroic Zoom' },
            ]}
          />
          <StudioSelect
            id={transformSkewSelectId}
            label="Skew Slant"
            value={styles.transform?.skew || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                transform: { ...styles.transform, skew: val },
              })
            }
            options={[
              { value: '', label: 'None (0°)' },
              { value: 'skew-x-1', label: '1° Civic Slant' },
              { value: '-skew-x-1', label: '-1° Reverse Slant' },
              { value: 'skew-y-1', label: '1° Vertical Slant' },
            ]}
          />
        </div>

        {/* 2D Translation & Origin */}
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          <StudioSelect
            id={transformTranslateXSelectId}
            label="Translate X"
            value={styles.transform?.translateX || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                transform: { ...styles.transform, translateX: val },
              })
            }
            options={[
              { value: '', label: '0 (None)' },
              { value: 'translate-x-1', label: '+4px (translate-x-1)' },
              { value: '-translate-x-1', label: '-4px (-translate-x-1)' },
              { value: 'translate-x-2', label: '+8px (translate-x-2)' },
              { value: '-translate-x-2', label: '-8px (-translate-x-2)' },
              { value: 'translate-x-4', label: '+16px (translate-x-4)' },
              { value: '-translate-x-4', label: '-16px (-translate-x-4)' },
              { value: 'translate-x-full', label: '+100% (+full)' },
              { value: '-translate-x-full', label: '-100% (-full)' },
            ]}
          />
          <StudioSelect
            id={transformTranslateYSelectId}
            label="Translate Y"
            value={styles.transform?.translateY || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                transform: { ...styles.transform, translateY: val },
              })
            }
            options={[
              { value: '', label: '0 (None)' },
              { value: 'translate-y-1', label: '+4px (translate-y-1)' },
              { value: '-translate-y-1', label: '-4px (-translate-y-1)' },
              { value: 'translate-y-2', label: '+8px (translate-y-2)' },
              { value: '-translate-y-2', label: '-8px (-translate-y-2)' },
              { value: 'translate-y-4', label: '+16px (translate-y-4)' },
              { value: '-translate-y-4', label: '-16px (-translate-y-4)' },
              { value: '-translate-y-1/2', label: '-50% (Center Offset)' },
              { value: 'translate-y-full', label: '+100% (+full)' },
            ]}
          />
          <StudioSelect
            id={transformOriginSelectId}
            label="Transform Origin"
            value={styles.transform?.transformOrigin || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                transform: { ...styles.transform, transformOrigin: val },
              })
            }
            options={[
              { value: '', label: 'Default (Center)' },
              { value: 'origin-center', label: 'Center' },
              { value: 'origin-top', label: 'Top' },
              { value: 'origin-top-right', label: 'Top Right' },
              { value: 'origin-right', label: 'Right' },
              { value: 'origin-bottom-right', label: 'Bottom Right' },
              { value: 'origin-bottom', label: 'Bottom' },
              { value: 'origin-bottom-left', label: 'Bottom Left' },
              { value: 'origin-left', label: 'Left' },
              { value: 'origin-top-left', label: 'Top Left' },
            ]}
          />
        </div>
      </StudioSection>

      {/* ── 9. Responsive Device Visibility (Pro) ── */}
      <StudioSection
        title="Responsive Device Visibility"
        badge="Breakpoints"
        description="Selectively show or hide this block element on mobile phones, tablets, desktop screens, or print viewports."
        action={<Eye size={13} className="text-accent-gold" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StudioToggle
            active={Boolean(styles.responsive.hideMobile)}
            onToggle={() =>
              setStyles({
                ...styles,
                responsive: {
                  ...styles.responsive,
                  hideMobile: !styles.responsive.hideMobile,
                },
              })
            }
            label="Hide Mobile"
            statusLabel={styles.responsive.hideMobile ? 'HIDDEN' : 'VISIBLE'}
            description="Hidden under 640px"
          />
          <StudioToggle
            active={Boolean(styles.responsive.hideTablet)}
            onToggle={() =>
              setStyles({
                ...styles,
                responsive: {
                  ...styles.responsive,
                  hideTablet: !styles.responsive.hideTablet,
                },
              })
            }
            label="Hide Tablet"
            statusLabel={styles.responsive.hideTablet ? 'HIDDEN' : 'VISIBLE'}
            description="Hidden 640px - 768px"
          />
          <StudioToggle
            active={Boolean(styles.responsive.hideDesktop)}
            onToggle={() =>
              setStyles({
                ...styles,
                responsive: {
                  ...styles.responsive,
                  hideDesktop: !styles.responsive.hideDesktop,
                },
              })
            }
            label="Hide Desktop"
            statusLabel={styles.responsive.hideDesktop ? 'HIDDEN' : 'VISIBLE'}
            description="Hidden above 768px"
          />
          <StudioToggle
            active={Boolean(styles.responsive.hidePrint)}
            onToggle={() =>
              setStyles({
                ...styles,
                responsive: {
                  ...styles.responsive,
                  hidePrint: !styles.responsive.hidePrint,
                },
              })
            }
            label="Hide on Print"
            statusLabel={styles.responsive.hidePrint ? 'HIDDEN' : 'VISIBLE'}
            description="Suppressed in printouts"
          />
        </div>
      </StudioSection>
    </div>
  );
}
