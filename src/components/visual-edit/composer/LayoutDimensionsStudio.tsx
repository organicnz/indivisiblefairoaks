'use client';

import { useState } from 'react';
import type { VisualComposerDimensionsTab, VisualComposerStyles } from '@/types/unified';
import {
  DimensionsBehaviorStudio,
  DimensionsFlexStudio,
  DimensionsPositioningStudio,
  DimensionsSizingStudio,
} from './dimensions';

export {
  DimensionsBehaviorStudio,
  DimensionsFlexStudio,
  DimensionsPositioningStudio,
  DimensionsSizingStudio,
};

export type DimensionsStudioTab = VisualComposerDimensionsTab;

export const DIMENSIONS_STUDIO_TABS: readonly {
  id: VisualComposerDimensionsTab;
  label: string;
}[] = [
  { id: 'all', label: 'All Dimensions' },
  { id: 'sizing', label: 'Sizing & Bounds' },
  { id: 'flex', label: 'Flexbox Flow' },
  { id: 'position', label: 'Position & Insets' },
  { id: 'behavior', label: 'Behavior & Cursor' },
] as const;

export interface LayoutDimensionsStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  activeDimensionsTab?: VisualComposerDimensionsTab;
  onDimensionsTabChange?: (tab: VisualComposerDimensionsTab) => void;
  layoutDisplaySelectId?: string;
  layoutMaxWidthSelectId?: string;
  layoutWidthSelectId?: string;
  layoutMinWidthSelectId?: string;
  layoutHeightSelectId?: string;
  layoutMinHeightSelectId?: string;
  layoutMaxHeightSelectId?: string;
  layoutFlexDirSelectId?: string;
  layoutJustifySelectId?: string;
  layoutAlignSelectId?: string;
  layoutFlexWrapSelectId?: string;
  layoutAlignSelfSelectId?: string;
  layoutOrderSelectId?: string;
  layoutFlexGrowSelectId?: string;
  layoutFlexShrinkSelectId?: string;
  layoutAspectRatioSelectId?: string;
  layoutObjectFitSelectId?: string;
  layoutPositionSelectId?: string;
  layoutZIndexSelectId?: string;
  layoutOverflowSelectId?: string;
  layoutInsetSelectId?: string;
  layoutTopSelectId?: string;
  layoutBottomSelectId?: string;
  layoutLeftSelectId?: string;
  layoutRightSelectId?: string;
  layoutCursorSelectId?: string;
  layoutVisibilitySelectId?: string;
  layoutPointerEventsSelectId?: string;
  layoutUserSelectSelectId?: string;
}

export function LayoutDimensionsStudio({
  styles,
  setStyles,
  activeDimensionsTab,
  onDimensionsTabChange,
  layoutDisplaySelectId,
  layoutMaxWidthSelectId,
  layoutWidthSelectId,
  layoutMinWidthSelectId,
  layoutHeightSelectId,
  layoutMinHeightSelectId,
  layoutMaxHeightSelectId,
  layoutFlexDirSelectId,
  layoutJustifySelectId,
  layoutAlignSelectId,
  layoutFlexWrapSelectId,
  layoutAlignSelfSelectId,
  layoutOrderSelectId,
  layoutFlexGrowSelectId,
  layoutFlexShrinkSelectId,
  layoutAspectRatioSelectId,
  layoutObjectFitSelectId,
  layoutPositionSelectId,
  layoutZIndexSelectId,
  layoutOverflowSelectId,
  layoutInsetSelectId,
  layoutTopSelectId,
  layoutBottomSelectId,
  layoutLeftSelectId,
  layoutRightSelectId,
  layoutCursorSelectId,
  layoutVisibilitySelectId,
  layoutPointerEventsSelectId,
  layoutUserSelectSelectId,
}: LayoutDimensionsStudioProps) {
  const [internalTab, setInternalTab] = useState<VisualComposerDimensionsTab>('all');
  const currentTab = activeDimensionsTab ?? internalTab;

  const handleTabClick = (tab: VisualComposerDimensionsTab) => {
    if (onDimensionsTabChange) {
      onDimensionsTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation Bar for Dimensions Studio */}
      <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex border-b border-white/10 bg-slate-950/90 px-3 py-1.5 backdrop-blur-md overflow-x-auto gap-1 text-[11px] no-scrollbar">
        {DIMENSIONS_STUDIO_TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={`shrink-0 px-2.5 py-1 rounded-lg font-medium transition-all ${
                isActive
                  ? 'bg-accent-gold text-ink-strong font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── 1. Sizing, Flow & Aspect Ratios ── */}
      {(currentTab === 'all' || currentTab === 'sizing') && (
        <DimensionsSizingStudio
          styles={styles}
          setStyles={setStyles}
          layoutDisplaySelectId={layoutDisplaySelectId}
          layoutMaxWidthSelectId={layoutMaxWidthSelectId}
          layoutWidthSelectId={layoutWidthSelectId}
          layoutMinWidthSelectId={layoutMinWidthSelectId}
          layoutHeightSelectId={layoutHeightSelectId}
          layoutMinHeightSelectId={layoutMinHeightSelectId}
          layoutMaxHeightSelectId={layoutMaxHeightSelectId}
          layoutAspectRatioSelectId={layoutAspectRatioSelectId}
          layoutObjectFitSelectId={layoutObjectFitSelectId}
        />
      )}

      {/* ── 2. Flexbox Flow & Alignment ── */}
      {(currentTab === 'all' || currentTab === 'flex') && (
        <DimensionsFlexStudio
          styles={styles}
          setStyles={setStyles}
          layoutFlexDirSelectId={layoutFlexDirSelectId}
          layoutJustifySelectId={layoutJustifySelectId}
          layoutAlignSelectId={layoutAlignSelectId}
          layoutFlexWrapSelectId={layoutFlexWrapSelectId}
          layoutAlignSelfSelectId={layoutAlignSelfSelectId}
          layoutOrderSelectId={layoutOrderSelectId}
          layoutFlexGrowSelectId={layoutFlexGrowSelectId}
          layoutFlexShrinkSelectId={layoutFlexShrinkSelectId}
        />
      )}

      {/* ── 3. Positioning, Offsets & Layering ── */}
      {(currentTab === 'all' || currentTab === 'position') && (
        <DimensionsPositioningStudio
          styles={styles}
          setStyles={setStyles}
          layoutPositionSelectId={layoutPositionSelectId}
          layoutZIndexSelectId={layoutZIndexSelectId}
          layoutOverflowSelectId={layoutOverflowSelectId}
          layoutInsetSelectId={layoutInsetSelectId}
          layoutTopSelectId={layoutTopSelectId}
          layoutBottomSelectId={layoutBottomSelectId}
          layoutLeftSelectId={layoutLeftSelectId}
          layoutRightSelectId={layoutRightSelectId}
        />
      )}

      {/* ── 4. Interaction Behavior, Pointer & Cursors ── */}
      {(currentTab === 'all' || currentTab === 'behavior') && (
        <DimensionsBehaviorStudio
          styles={styles}
          setStyles={setStyles}
          layoutCursorSelectId={layoutCursorSelectId}
          layoutVisibilitySelectId={layoutVisibilitySelectId}
          layoutPointerEventsSelectId={layoutPointerEventsSelectId}
          layoutUserSelectSelectId={layoutUserSelectSelectId}
        />
      )}
    </div>
  );
}
