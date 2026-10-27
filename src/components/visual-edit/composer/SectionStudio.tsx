'use client';

import { useState } from 'react';
import type { VisualComposerSectionTab, VisualComposerStyles } from '@/types/unified';
import {
  SectionAdvancedStudio,
  SectionAtmosphereStudio,
  SectionDividersStudio,
  SectionLayoutStudio,
  SectionPresetsStudio,
} from './section';

export type SectionStudioTab = VisualComposerSectionTab;

export const SECTION_STUDIO_TABS: readonly {
  id: VisualComposerSectionTab;
  label: string;
}[] = [
  { id: 'all', label: 'All Controls' },
  { id: 'presets', label: 'Templates' },
  { id: 'layout', label: 'Layout & Grid' },
  { id: 'spacing', label: 'Spacing' },
  { id: 'style', label: 'Atmosphere & Glow' },
  { id: 'advanced', label: 'Advanced & Selectors' },
] as const;

export interface SectionStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  activeSectionTab?: VisualComposerSectionTab;
  onSectionTabChange?: (tab: VisualComposerSectionTab) => void;
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
  sectionBgImageInputId?: string;
  sectionVideoUrlInputId?: string;
  compiledClassNames?: string;
}

export function SectionStudio({
  styles,
  setStyles,
  activeSectionTab,
  onSectionTabChange,
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
  sectionBgImageInputId = 'section-bg-image-input',
  sectionVideoUrlInputId = 'section-video-url-input',
  compiledClassNames,
}: SectionStudioProps) {
  const [internalTab, setInternalTab] = useState<VisualComposerSectionTab>('all');
  const activeTab = activeSectionTab ?? internalTab;
  const handleTabChange = onSectionTabChange ?? setInternalTab;

  return (
    <div className="space-y-5">
      {/* ── Sub-Tab Filter Bar ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-white/10">
        {SECTION_STUDIO_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/40'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── 0. 1-Click Section Design Presets ── */}
      {(activeTab === 'all' || activeTab === 'presets') && (
        <SectionPresetsStudio styles={styles} setStyles={setStyles} />
      )}

      {/* ── 1. Canvas Structure, Spacing & Multi-Column Grid ── */}
      {(activeTab === 'all' || activeTab === 'layout' || activeTab === 'spacing') && (
        <SectionLayoutStudio
          styles={styles}
          setStyles={setStyles}
          showStructure={activeTab === 'all' || activeTab === 'layout'}
          showSpacing={activeTab === 'all' || activeTab === 'spacing'}
          showColumns={activeTab === 'all' || activeTab === 'layout'}
          sectionWidthSelectId={sectionWidthSelectId}
          sectionPaddingYSelectId={sectionPaddingYSelectId}
          sectionPaddingXSelectId={sectionPaddingXSelectId}
          sectionMarginYSelectId={sectionMarginYSelectId}
          sectionMarginXSelectId={sectionMarginXSelectId}
          sectionMinHeightSelectId={sectionMinHeightSelectId}
          sectionRowLayoutSelectId={sectionRowLayoutSelectId}
          sectionColumnsSelectId={sectionColumnsSelectId}
          sectionGapSelectId={sectionGapSelectId}
          sectionAlignSelectId={sectionAlignSelectId}
          sectionJustifyContentSelectId={sectionJustifyContentSelectId}
        />
      )}

      {/* ── 2. Theme, Atmosphere & Background ── */}
      {(activeTab === 'all' || activeTab === 'style') && (
        <SectionAtmosphereStudio
          styles={styles}
          setStyles={setStyles}
          sectionBgSelectId={sectionBgSelectId}
          bgGradientSelectId={bgGradientSelectId}
          sectionPatternSelectId={sectionPatternSelectId}
          sectionOverlaySelectId={sectionOverlaySelectId}
          sectionBgBlendModeSelectId={sectionBgBlendModeSelectId}
          sectionInnerShadowSelectId={sectionInnerShadowSelectId}
          sectionThemeModeSelectId={sectionThemeModeSelectId}
          sectionBgImageInputId={sectionBgImageInputId}
          sectionVideoUrlInputId={sectionVideoUrlInputId}
          sectionBgAttachmentSelectId={sectionBgAttachmentSelectId}
          sectionBgPositionSelectId={sectionBgPositionSelectId}
          sectionBgSizeSelectId={sectionBgSizeSelectId}
          sectionBgRepeatSelectId={sectionBgRepeatSelectId}
        />
      )}

      {/* ── 3. Borders, Dividers & Clipping ── */}
      {(activeTab === 'all' || activeTab === 'style' || activeTab === 'advanced') && (
        <SectionDividersStudio
          styles={styles}
          setStyles={setStyles}
          showBorders={activeTab === 'all' || activeTab === 'style'}
          showDividers={activeTab === 'all' || activeTab === 'style'}
          showClipping={activeTab === 'all' || activeTab === 'advanced'}
          sectionRadiusSelectId={sectionRadiusSelectId}
          sectionShadowSelectId={sectionShadowSelectId}
          sectionBorderSelectId={sectionBorderSelectId}
          sectionBorderColorSelectId={sectionBorderColorSelectId}
          sectionBackdropBlurSelectId={sectionBackdropBlurSelectId}
          sectionDividerSelectId={sectionDividerSelectId}
          sectionTopDividerSelectId={sectionTopDividerSelectId}
          sectionBottomDividerSelectId={sectionBottomDividerSelectId}
          sectionDividerColorSelectId={sectionDividerColorSelectId}
          sectionOverflowSelectId={sectionOverflowSelectId}
          sectionZIndexSelectId={sectionZIndexSelectId}
        />
      )}

      {/* ── 4. Developer Controls & Responsive Visibility ── */}
      {(activeTab === 'all' || activeTab === 'advanced') && (
        <SectionAdvancedStudio
          styles={styles}
          setStyles={setStyles}
          sectionAnchorIdInputId={sectionAnchorIdInputId}
          sectionCustomClassesInputId={sectionCustomClassesInputId}
          sectionCustomStyleInputId={sectionCustomStyleInputId}
          compiledClassNames={compiledClassNames}
        />
      )}
    </div>
  );
}
