'use client';

import type { VisualComposerStyles } from '@/types/unified';
import {
  DELAY_OPTIONS,
  DURATION_OPTIONS,
  ENTRANCE_OPTIONS,
  HOVER_BG_OPTIONS,
  HOVER_BORDER_OPTIONS,
  HOVER_GLOW_OPTIONS,
  HOVER_LIFT_OPTIONS,
  HOVER_OPTIONS,
  HOVER_ROTATE_OPTIONS,
  HOVER_SCALE_OPTIONS,
  HOVER_SHADOW_OPTIONS,
  HOVER_TEXT_COLOR_OPTIONS,
  MotionAdvancedStudio,
  MotionEntranceStudio,
  MotionHoverStudio,
  MotionTimingStudio,
  TIMING_OPTIONS,
} from './motion';
import { StudioSection } from './ui';

export {
  DELAY_OPTIONS,
  DURATION_OPTIONS,
  ENTRANCE_OPTIONS,
  HOVER_BG_OPTIONS,
  HOVER_BORDER_OPTIONS,
  HOVER_GLOW_OPTIONS,
  HOVER_LIFT_OPTIONS,
  HOVER_OPTIONS,
  HOVER_ROTATE_OPTIONS,
  HOVER_SCALE_OPTIONS,
  HOVER_SHADOW_OPTIONS,
  HOVER_TEXT_COLOR_OPTIONS,
  MotionAdvancedStudio,
  MotionEntranceStudio,
  MotionHoverStudio,
  MotionTimingStudio,
  TIMING_OPTIONS,
};

export interface AdvancedMotionStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
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
  return (
    <div className="space-y-4">
      {/* 1. Motion & Animation Transitions */}
      <StudioSection title="Motion & Animation Transitions" badge="Dynamics">
        <MotionEntranceStudio
          styles={styles}
          setStyles={setStyles}
          motionEntranceSelectId={motionEntranceSelectId}
          motionDelaySelectId={motionDelaySelectId}
        />

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

        <MotionTimingStudio
          styles={styles}
          setStyles={setStyles}
          motionDurationSelectId={motionDurationSelectId}
          motionTimingSelectId={motionTimingSelectId}
        />
      </StudioSection>

      {/* 2. Anchor ID, Responsive Device Matrix & Compiled Class Names */}
      <MotionAdvancedStudio
        styles={styles}
        setStyles={setStyles}
        anchorIdInputId={anchorIdInputId}
        compiledClassNames={compiledClassNames}
      />
    </div>
  );
}
