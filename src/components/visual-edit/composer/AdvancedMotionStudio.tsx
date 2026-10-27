'use client';

import { useState } from 'react';
import type { VisualComposerMotionTab, VisualComposerStyles } from '@/types/unified';
import {
  MotionAdvancedStudio,
  MotionEntranceStudio,
  MotionHoverStudio,
  MotionTimingStudio,
} from './motion';
import { StudioSection } from './ui';

export { MotionAdvancedStudio, MotionEntranceStudio, MotionHoverStudio, MotionTimingStudio };

export type AdvancedMotionStudioTab = VisualComposerMotionTab;

export const MOTION_STUDIO_TABS: readonly {
  id: VisualComposerMotionTab;
  label: string;
}[] = [
  { id: 'all', label: 'All Motion' },
  { id: 'entrance', label: 'Entrance' },
  { id: 'hover', label: 'Hover Effects' },
  { id: 'timing', label: 'Timing & Curves' },
  { id: 'advanced', label: 'Anchor & CSS' },
] as const;

export interface AdvancedMotionStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  activeMotionTab?: VisualComposerMotionTab;
  onMotionTabChange?: (tab: VisualComposerMotionTab) => void;
  motionEntranceSelectId?: string;
  motionHoverSelectId?: string;
  motionHoverScaleSelectId?: string;
  motionHoverLiftSelectId?: string;
  motionHoverRotateSelectId?: string;
  motionDurationSelectId?: string;
  motionDelaySelectId?: string;
  motionHoverGlowSelectId?: string;
  motionTimingSelectId?: string;
  motionHoverBorderSelectId?: string;
  motionHoverShadowSelectId?: string;
  motionHoverBgSelectId?: string;
  motionHoverTextColorSelectId?: string;
  anchorIdInputId?: string;
  compiledClassNames?: string;
}

export function AdvancedMotionStudio({
  styles,
  setStyles,
  activeMotionTab,
  onMotionTabChange,
  motionEntranceSelectId,
  motionHoverSelectId,
  motionHoverScaleSelectId,
  motionHoverLiftSelectId,
  motionHoverRotateSelectId,
  motionDurationSelectId,
  motionDelaySelectId,
  motionHoverGlowSelectId,
  motionTimingSelectId,
  motionHoverBorderSelectId,
  motionHoverShadowSelectId,
  motionHoverBgSelectId,
  motionHoverTextColorSelectId,
  anchorIdInputId,
  compiledClassNames,
}: AdvancedMotionStudioProps) {
  const [internalTab, setInternalTab] = useState<VisualComposerMotionTab>('all');
  const currentTab = activeMotionTab ?? internalTab;

  const handleTabClick = (tab: VisualComposerMotionTab) => {
    if (onMotionTabChange) {
      onMotionTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation Bar for Motion Studio */}
      <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex border-b border-white/10 bg-slate-950/90 px-3 py-1.5 backdrop-blur-md overflow-x-auto gap-1 text-[11px] no-scrollbar">
        {MOTION_STUDIO_TABS.map((tab) => {
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

      {/* 1. Motion & Animation Transitions */}
      {(currentTab === 'all' ||
        currentTab === 'entrance' ||
        currentTab === 'hover' ||
        currentTab === 'timing') && (
        <StudioSection title="Motion & Animation Transitions" badge="Dynamics">
          {(currentTab === 'all' || currentTab === 'entrance') && (
            <MotionEntranceStudio
              styles={styles}
              setStyles={setStyles}
              motionEntranceSelectId={motionEntranceSelectId}
              motionDelaySelectId={motionDelaySelectId}
            />
          )}

          {(currentTab === 'all' || currentTab === 'hover') && (
            <MotionHoverStudio
              styles={styles}
              setStyles={setStyles}
              motionHoverSelectId={motionHoverSelectId}
              motionHoverScaleSelectId={motionHoverScaleSelectId}
              motionHoverLiftSelectId={motionHoverLiftSelectId}
              motionHoverRotateSelectId={motionHoverRotateSelectId}
              motionHoverGlowSelectId={motionHoverGlowSelectId}
              motionHoverBorderSelectId={motionHoverBorderSelectId}
              motionHoverShadowSelectId={motionHoverShadowSelectId}
              motionHoverBgSelectId={motionHoverBgSelectId}
              motionHoverTextColorSelectId={motionHoverTextColorSelectId}
            />
          )}

          {(currentTab === 'all' || currentTab === 'timing') && (
            <MotionTimingStudio
              styles={styles}
              setStyles={setStyles}
              motionDurationSelectId={motionDurationSelectId}
              motionTimingSelectId={motionTimingSelectId}
            />
          )}
        </StudioSection>
      )}

      {/* 2. Anchor ID, Responsive Device Matrix & Compiled Class Names */}
      {(currentTab === 'all' || currentTab === 'advanced') && (
        <MotionAdvancedStudio
          styles={styles}
          setStyles={setStyles}
          anchorIdInputId={anchorIdInputId}
          compiledClassNames={compiledClassNames}
        />
      )}
    </div>
  );
}
