'use client';

import { useState } from 'react';
import type { Block } from '@/lib/blocks';
import type { VisualComposerBoxModelTab, VisualComposerStyles } from '@/types/unified';
import { BlockBackgroundStudio } from './BlockBackgroundStudio';
import { BordersStudio } from './BordersStudio';
import {
  BoxModelSpacingStudio,
  MultiColumnLayoutStudio,
  ResponsiveVisibilityStudio,
} from './box-model';
import { CSSFiltersStudio } from './CSSFiltersStudio';
import { LayoutDimensionsStudio } from './LayoutDimensionsStudio';
import { TransformsStudio } from './TransformsStudio';

export type BoxModelStudioTab = VisualComposerBoxModelTab;

export const BOX_MODEL_STUDIO_TABS: readonly {
  id: VisualComposerBoxModelTab;
  label: string;
}[] = [
  { id: 'all', label: 'All Controls' },
  { id: 'spacing', label: 'Spacing & Box' },
  { id: 'layout', label: 'Grid & Cols' },
  { id: 'borders', label: 'Borders' },
  { id: 'background', label: 'Atmosphere' },
  { id: 'sizing', label: 'Dimensions' },
  { id: 'filters', label: 'Filters' },
  { id: 'transforms', label: '3D Tilt' },
  { id: 'responsive', label: 'Visibility' },
] as const;

export interface BoxModelStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  currentBlock: Block;
  isSidesLinked: boolean;
  setIsSidesLinked: React.Dispatch<React.SetStateAction<boolean>>;
  cycleMarginValue: (current: string, axis?: 'vertical' | 'horizontal') => string;
  cyclePaddingValue: (current: string, axis?: 'vertical' | 'horizontal') => string;
  activeSubTab?: VisualComposerBoxModelTab;
  onSubTabChange?: (tab: VisualComposerBoxModelTab) => void;
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
  activeSubTab,
  onSubTabChange,
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
  blockThemeModeSelectId,
}: BoxModelStudioProps) {
  const [internalTab, setInternalTab] = useState<VisualComposerBoxModelTab>('all');
  const currentTab = activeSubTab ?? internalTab;

  const handleTabClick = (tab: VisualComposerBoxModelTab) => {
    if (onSubTabChange) {
      onSubTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation Bar for Box Model Studio */}
      <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex border-b border-white/10 bg-slate-950/90 px-3 py-1.5 backdrop-blur-md overflow-x-auto gap-1 text-[11px] no-scrollbar">
        {BOX_MODEL_STUDIO_TABS.map((tab) => {
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

      {/* ── 1. Spacing & Interactive 2D Box Model Diagram ── */}
      {(currentTab === 'all' || currentTab === 'spacing') && (
        <BoxModelSpacingStudio
          styles={styles}
          setStyles={setStyles}
          currentBlock={currentBlock}
          isSidesLinked={isSidesLinked}
          setIsSidesLinked={setIsSidesLinked}
          cycleMarginValue={cycleMarginValue}
          cyclePaddingValue={cyclePaddingValue}
          marginSelectId={marginSelectId}
          paddingSelectId={paddingSelectId}
        />
      )}

      {/* ── 2. Layout Grid & Columns ── */}
      {(currentTab === 'all' || currentTab === 'layout') && (
        <MultiColumnLayoutStudio
          styles={styles}
          setStyles={setStyles}
          layoutColumnsSelectId={layoutColumnsSelectId}
          layoutMaxWidthSelectId={layoutMaxWidthSelectId}
        />
      )}

      {/* ── 3. Border & Corner Radius Studio ── */}
      {(currentTab === 'all' || currentTab === 'borders') && (
        <BordersStudio
          styles={styles}
          setStyles={setStyles}
          radiusSelectId={radiusSelectId}
          borderWidthSelectId={borderWidthSelectId}
          borderStyleSelectId={borderStyleSelectId}
          borderSideSelectId={borderSideSelectId}
        />
      )}

      {/* ── 4. Background & Elevation Studio ── */}
      {(currentTab === 'all' || currentTab === 'background') && (
        <BlockBackgroundStudio
          styles={styles}
          setStyles={setStyles}
          bgThemeSelectId={bgThemeSelectId}
          shadowSelectId={shadowSelectId}
          blockThemeModeSelectId={blockThemeModeSelectId}
        />
      )}

      {/* ── 5. Layout, Display & Sizing Studio ── */}
      {(currentTab === 'all' || currentTab === 'sizing') && (
        <LayoutDimensionsStudio styles={styles} setStyles={setStyles} />
      )}

      {/* ── 6. Glassmorphism & Visual Effects ── */}
      {(currentTab === 'all' || currentTab === 'filters') && (
        <CSSFiltersStudio styles={styles} setStyles={setStyles} />
      )}

      {/* ── 7. Transforms & 3D Tilt Studio ── */}
      {(currentTab === 'all' || currentTab === 'transforms') && (
        <TransformsStudio styles={styles} setStyles={setStyles} />
      )}

      {/* ── 8. Responsive Device Visibility (Pro) ── */}
      {(currentTab === 'all' || currentTab === 'responsive') && (
        <ResponsiveVisibilityStudio styles={styles} setStyles={setStyles} />
      )}
    </div>
  );
}
