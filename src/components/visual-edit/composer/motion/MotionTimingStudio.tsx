'use client';

import type { VisualComposerStyles } from '@/types/unified';
import { StudioSelect } from '../ui';

export const DURATION_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'transition-all duration-150', label: 'Snappy (150ms)' },
  { value: 'transition-all duration-200', label: 'Standard (200ms)' },
  { value: 'transition-all duration-300', label: 'Smooth (300ms)' },
  { value: 'transition-all duration-500', label: 'Cinematic (500ms)' },
  { value: 'transition-all duration-700', label: 'Ambient (700ms)' },
] as const;

export const TIMING_OPTIONS = [
  { value: '', label: 'Default Curve (ease)' },
  { value: 'ease-out', label: 'Ease Out (Decelerate)' },
  { value: 'ease-in', label: 'Ease In (Accelerate)' },
  { value: 'ease-in-out', label: 'Ease In Out (Smooth S-Curve)' },
  { value: 'ease-linear', label: 'Linear (Constant Speed)' },
] as const;

export interface MotionTimingStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  motionDurationSelectId?: string;
  motionTimingSelectId?: string;
}

export function MotionTimingStudio({
  styles,
  setStyles,
  motionDurationSelectId,
  motionTimingSelectId,
}: MotionTimingStudioProps) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      <StudioSelect
        id={motionDurationSelectId}
        label="Transition Speed"
        value={styles.motion.duration || ''}
        onChange={(val) =>
          setStyles({
            ...styles,
            motion: { ...styles.motion, duration: val },
          })
        }
        options={DURATION_OPTIONS}
        size="xs"
      />
      <StudioSelect
        id={motionTimingSelectId}
        label="Animation Easing Curve"
        value={styles.motion.timing || ''}
        onChange={(val) =>
          setStyles({
            ...styles,
            motion: { ...styles.motion, timing: val },
          })
        }
        options={TIMING_OPTIONS}
        size="xs"
      />
    </div>
  );
}
