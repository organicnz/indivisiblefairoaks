'use client';

import { useState } from 'react';
import type { VisualComposerStyles, VisualComposerTypographyTab } from '@/types/unified';
import {
  TypographyEditorialStudio,
  TypographyEffectsStudio,
  TypographyPaletteStudio,
  TypographyScaleStudio,
} from './typography';

export {
  TypographyEditorialStudio,
  TypographyEffectsStudio,
  TypographyPaletteStudio,
  TypographyScaleStudio,
};

export type TypographyStudioTab = VisualComposerTypographyTab;

export const TYPOGRAPHY_STUDIO_TABS: readonly {
  id: VisualComposerTypographyTab;
  label: string;
}[] = [
  { id: 'all', label: 'All Type' },
  { id: 'scale', label: 'Scale & Font' },
  { id: 'palette', label: 'Color & Align' },
  { id: 'effects', label: 'Casing & Accents' },
  { id: 'editorial', label: 'Columns & Wrap' },
] as const;

export interface TypographyStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  activeTypographyTab?: VisualComposerTypographyTab;
  onTypographyTabChange?: (tab: VisualComposerTypographyTab) => void;
  fontFamilySelectId?: string;
  fontSizeSelectId?: string;
  fontWeightSelectId?: string;
  textGradientSelectId?: string;
  lineHeightSelectId?: string;
  letterSpacingSelectId?: string;
  textTransformSelectId?: string;
  textDecorationSelectId?: string;
  textShadowSelectId?: string;
  fontStyleSelectId?: string;
  textWrapSelectId?: string;
  wordBreakSelectId?: string;
  textColumnsSelectId?: string;
  fontSmoothingSelectId?: string;
}

export function TypographyStudio({
  styles,
  setStyles,
  activeTypographyTab,
  onTypographyTabChange,
  fontFamilySelectId,
  fontSizeSelectId,
  fontWeightSelectId,
  textGradientSelectId,
  lineHeightSelectId,
  letterSpacingSelectId,
  textTransformSelectId,
  textDecorationSelectId,
  textShadowSelectId,
  fontStyleSelectId,
  textWrapSelectId,
  wordBreakSelectId,
  textColumnsSelectId,
  fontSmoothingSelectId,
}: TypographyStudioProps) {
  const [internalTab, setInternalTab] = useState<VisualComposerTypographyTab>('all');
  const currentTab = activeTypographyTab ?? internalTab;

  const handleTabClick = (tab: VisualComposerTypographyTab) => {
    if (onTypographyTabChange) {
      onTypographyTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation Bar for Typography Studio */}
      <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex border-b border-white/10 bg-slate-950/90 px-3 py-1.5 backdrop-blur-md overflow-x-auto gap-1 text-[11px] no-scrollbar">
        {TYPOGRAPHY_STUDIO_TABS.map((tab) => {
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

      {/* 1. Font Family, Scale & Hierarchy */}
      {(currentTab === 'all' || currentTab === 'scale') && (
        <TypographyScaleStudio
          styles={styles}
          setStyles={setStyles}
          fontFamilySelectId={fontFamilySelectId}
          fontSizeSelectId={fontSizeSelectId}
          fontWeightSelectId={fontWeightSelectId}
          textGradientSelectId={textGradientSelectId}
          lineHeightSelectId={lineHeightSelectId}
        />
      )}

      {/* 2. Text Alignment & Color Swatches */}
      {(currentTab === 'all' || currentTab === 'palette') && (
        <TypographyPaletteStudio styles={styles} setStyles={setStyles} />
      )}

      {/* 3. Spacing, Casing & Accents */}
      {(currentTab === 'all' || currentTab === 'effects') && (
        <TypographyEffectsStudio
          styles={styles}
          setStyles={setStyles}
          letterSpacingSelectId={letterSpacingSelectId}
          textTransformSelectId={textTransformSelectId}
          textDecorationSelectId={textDecorationSelectId}
          textShadowSelectId={textShadowSelectId}
        />
      )}

      {/* 4. Advanced Editorial Typography */}
      {(currentTab === 'all' || currentTab === 'editorial') && (
        <TypographyEditorialStudio
          styles={styles}
          setStyles={setStyles}
          fontStyleSelectId={fontStyleSelectId}
          textWrapSelectId={textWrapSelectId}
          wordBreakSelectId={wordBreakSelectId}
          textColumnsSelectId={textColumnsSelectId}
          fontSmoothingSelectId={fontSmoothingSelectId}
        />
      )}
    </div>
  );
}
