'use client';

import { Columns3, Eye, Sparkles } from 'lucide-react';
import type { Block } from '@/lib/blocks';
import type { VisualComposerStyles } from '@/types/unified';
import { BordersStudio } from './BordersStudio';
import { CSSFiltersStudio } from './CSSFiltersStudio';
import { LayoutDimensionsStudio } from './LayoutDimensionsStudio';
import { TransformsStudio } from './TransformsStudio';
import {
  BoxModelDiagram,
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
        <BoxModelDiagram
          styles={styles}
          setStyles={setStyles}
          isSidesLinked={isSidesLinked}
          setIsSidesLinked={setIsSidesLinked}
          cycleMarginValue={cycleMarginValue}
          cyclePaddingValue={cyclePaddingValue}
          currentBlock={currentBlock}
        />
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

      {/* ── 3. Border & Corner Radius Studio ── */}
      <BordersStudio
        styles={styles}
        setStyles={setStyles}
        radiusSelectId={radiusSelectId}
        borderWidthSelectId={borderWidthSelectId}
        borderStyleSelectId={borderStyleSelectId}
        borderSideSelectId={borderSideSelectId}
        radiusTopLeftSelectId={radiusTopLeftSelectId}
        radiusTopRightSelectId={radiusTopRightSelectId}
        radiusBottomRightSelectId={radiusBottomRightSelectId}
        radiusBottomLeftSelectId={radiusBottomLeftSelectId}
      />

      {/* ── 4. Background & Elevation ── */}
      <StudioSection
        title="Background & Elevation"
        badge="Surface"
        description="Choose element surface tone, shadow depth, dark/light theme lock, and custom shape masks."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
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
      <LayoutDimensionsStudio
        styles={styles}
        setStyles={setStyles}
        layoutDisplaySelectId={layoutDisplaySelectId}
        layoutMaxWidthSelectId={layoutMaxWidthSelectId}
        layoutWidthSelectId={layoutWidthSelectId}
        layoutMinWidthSelectId={layoutMinWidthSelectId}
        layoutHeightSelectId={layoutHeightSelectId}
        layoutMinHeightSelectId={layoutMinHeightSelectId}
        layoutMaxHeightSelectId={layoutMaxHeightSelectId}
        layoutFlexDirSelectId={layoutFlexDirSelectId}
        layoutJustifySelectId={layoutJustifySelectId}
        layoutAlignSelectId={layoutAlignSelectId}
        layoutFlexWrapSelectId={layoutFlexWrapSelectId}
        layoutAlignSelfSelectId={layoutAlignSelfSelectId}
        layoutOrderSelectId={layoutOrderSelectId}
        layoutFlexGrowSelectId={layoutFlexGrowSelectId}
        layoutFlexShrinkSelectId={layoutFlexShrinkSelectId}
        layoutAspectRatioSelectId={layoutAspectRatioSelectId}
        layoutObjectFitSelectId={layoutObjectFitSelectId}
        layoutPositionSelectId={layoutPositionSelectId}
        layoutZIndexSelectId={layoutZIndexSelectId}
        layoutOverflowSelectId={layoutOverflowSelectId}
        layoutInsetSelectId={layoutInsetSelectId}
        layoutTopSelectId={layoutTopSelectId}
        layoutBottomSelectId={layoutBottomSelectId}
        layoutLeftSelectId={layoutLeftSelectId}
        layoutRightSelectId={layoutRightSelectId}
        layoutCursorSelectId={layoutCursorSelectId}
        layoutVisibilitySelectId={layoutVisibilitySelectId}
        layoutPointerEventsSelectId={layoutPointerEventsSelectId}
        layoutUserSelectSelectId={layoutUserSelectSelectId}
      />

      {/* ── 7. Glassmorphism & Visual Effects ── */}
      <CSSFiltersStudio
        styles={styles}
        setStyles={setStyles}
        effectBackdropBlurSelectId={effectBackdropBlurSelectId}
        effectOpacitySelectId={effectOpacitySelectId}
        effectGrayscaleSelectId={effectGrayscaleSelectId}
        effectBrightnessSelectId={effectBrightnessSelectId}
        effectContrastSelectId={effectContrastSelectId}
        effectSaturateSelectId={effectSaturateSelectId}
        effectHueRotateSelectId={effectHueRotateSelectId}
        effectSepiaSelectId={effectSepiaSelectId}
        effectBlurSelectId={effectBlurSelectId}
        effectBlendModeSelectId={effectBlendModeSelectId}
        effectHoverBrightnessSelectId={effectHoverBrightnessSelectId}
        effectHoverOpacitySelectId={effectHoverOpacitySelectId}
        effectInvertSelectId={effectInvertSelectId}
        effectDropShadowSelectId={effectDropShadowSelectId}
      />

      {/* ── 8. Transforms & 3D Tilt Studio ── */}
      <TransformsStudio
        styles={styles}
        setStyles={setStyles}
        transformRotateSelectId={transformRotateSelectId}
        transformScaleSelectId={transformScaleSelectId}
        transformSkewSelectId={transformSkewSelectId}
        transformTranslateXSelectId={transformTranslateXSelectId}
        transformTranslateYSelectId={transformTranslateYSelectId}
        transformOriginSelectId={transformOriginSelectId}
      />

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
