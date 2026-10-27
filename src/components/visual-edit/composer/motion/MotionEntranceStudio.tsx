'use client';

import { Sparkles } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';
import { StudioSelect } from '../ui';

export const ENTRANCE_OPTIONS = [
  { value: '', label: 'None (Static)' },
  { value: 'animate-in fade-in duration-300', label: 'Smooth Fade In' },
  { value: 'animate-in fade-in slide-in-from-bottom-4 duration-300', label: 'Slide Up' },
  { value: 'animate-in fade-in slide-in-from-top-4 duration-300', label: 'Slide Down' },
  { value: 'animate-in fade-in zoom-in-95 duration-200', label: 'Zoom In Pop' },
  { value: 'animate-pulse duration-700', label: 'Gentle Pulse' },
] as const;

export const DELAY_OPTIONS = [
  { value: '', label: 'None (0ms)' },
  { value: 'delay-100', label: '+100ms Stagger' },
  { value: 'delay-150', label: '+150ms' },
  { value: 'delay-200', label: '+200ms' },
  { value: 'delay-300', label: '+300ms' },
  { value: 'delay-500', label: '+500ms' },
  { value: 'delay-700', label: '+700ms' },
  { value: 'delay-1000', label: '+1000ms' },
] as const;

export interface MotionEntranceStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  motionEntranceSelectId?: string;
  motionDelaySelectId?: string;
}

export function MotionEntranceStudio({
  styles,
  setStyles,
  motionEntranceSelectId,
  motionDelaySelectId,
}: MotionEntranceStudioProps) {
  return (
    <div>
      <span className="block text-slate-300 font-bold mb-2 flex items-center gap-1.5">
        <Sparkles size={13} className="text-accent-gold" />
        <span>Entrance Dynamics</span>
      </span>
      <div className="grid grid-cols-2 gap-2">
        <StudioSelect
          id={motionEntranceSelectId}
          label="Entrance Animation"
          value={styles.motion.entrance}
          onChange={(val) =>
            setStyles({
              ...styles,
              motion: { ...styles.motion, entrance: val },
            })
          }
          options={ENTRANCE_OPTIONS}
          size="xs"
        />
        <StudioSelect
          id={motionDelaySelectId}
          label="Entrance Stagger Delay"
          value={styles.motion.delay || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              motion: { ...styles.motion, delay: val },
            })
          }
          options={DELAY_OPTIONS}
          size="xs"
        />
      </div>
    </div>
  );
}
