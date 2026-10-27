'use client';

import { Clock, Play, RotateCcw, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import type { VisualComposerStyles, VisualComposerTimingPreset } from '@/types/unified';
import { StudioSelect } from '../ui';

export const DURATION_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'transition-all duration-150', label: 'Snappy (150ms)' },
  { value: 'transition-all duration-200', label: 'Standard (200ms)' },
  { value: 'transition-all duration-300', label: 'Smooth (300ms)' },
  { value: 'transition-all duration-500', label: 'Cinematic (500ms)' },
  { value: 'transition-all duration-700', label: 'Ambient (700ms)' },
] as const;

import { DELAY_OPTIONS } from './MotionEntranceStudio';

export const TIMING_OPTIONS = [
  { value: '', label: 'Default Curve (ease)' },
  { value: 'ease-out', label: 'Ease Out (Decelerate)' },
  { value: 'ease-in', label: 'Ease In (Accelerate)' },
  { value: 'ease-in-out', label: 'Ease In Out (Smooth S-Curve)' },
  { value: 'ease-linear', label: 'Linear (Constant Speed)' },
] as const;

export const TIMING_PRESETS: readonly VisualComposerTimingPreset[] = [
  {
    id: 'snappy-decel',
    name: 'Snappy Decel',
    description: 'Fast 150ms deceleration curve for reactive buttons & interactive elements',
    badge: '150ms',
    apply: () => ({
      duration: 'transition-all duration-150',
      timing: 'ease-out',
    }),
  },
  {
    id: 'smooth-s-curve',
    name: 'Smooth Civic S-Curve',
    description: 'Balanced 300ms ease-in-out curve for panels and card transitions',
    badge: '300ms',
    apply: () => ({
      duration: 'transition-all duration-300',
      timing: 'ease-in-out',
    }),
  },
  {
    id: 'cinematic-ambient',
    name: 'Cinematic Ambient',
    description: 'Luxurious 500ms ease-out curve for dramatic hero entries and media',
    badge: '500ms',
    apply: () => ({
      duration: 'transition-all duration-500',
      timing: 'ease-out',
    }),
  },
  {
    id: 'linear-flow',
    name: 'Linear Flow',
    description: 'Constant-velocity 200ms linear curve for continuous tickers and gauges',
    badge: '200ms',
    apply: () => ({
      duration: 'transition-all duration-200',
      timing: 'ease-linear',
    }),
  },
  {
    id: 'reset-timing',
    name: 'Reset Timing',
    description: 'Restore default browser transition duration and timing curve',
    badge: 'Default',
    apply: () => ({
      duration: '',
      timing: '',
      delay: '',
    }),
  },
] as const;

export interface MotionTimingStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  motionDurationSelectId?: string;
  motionTimingSelectId?: string;
  motionDelaySelectId?: string;
}

export function MotionTimingStudio({
  styles,
  setStyles,
  motionDurationSelectId,
  motionTimingSelectId,
  motionDelaySelectId,
}: MotionTimingStudioProps) {
  const [testGliderPos, setTestGliderPos] = useState<'start' | 'end'>('start');

  const activeDurationLabel =
    DURATION_OPTIONS.find((o) => o.value === styles.motion.duration)?.label || 'Default';
  const activeTimingLabel =
    TIMING_OPTIONS.find((o) => o.value === styles.motion.timing)?.label || 'Default';
  const activeDelayLabel =
    DELAY_OPTIONS.find((o) => o.value === styles.motion.delay)?.label || '0ms';

  return (
    <div className="space-y-4 mt-2">
      {/* Live Physics Glider Playground */}
      <div
        data-testid="motion-timing-preview-stage"
        className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm p-3 shadow-inner"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              Transition Physics Stage
            </span>
          </div>
          <button
            type="button"
            data-testid="motion-timing-test-btn"
            onClick={() => setTestGliderPos((p) => (p === 'start' ? 'end' : 'start'))}
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-accent-gold border border-amber-500/30 transition-colors"
          >
            {testGliderPos === 'start' ? (
              <>
                <Play className="w-3 h-3" />
                <span>Test Easing</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3 h-3" />
                <span>Rewind</span>
              </>
            )}
          </button>
        </div>

        {/* Easing Track */}
        <div className="relative w-full h-10 bg-black/30 dark:bg-black/50 rounded-md border border-white/10 p-1 flex items-center overflow-hidden">
          {/* Subtle grid ticks */}
          <div className="absolute inset-0 flex justify-between px-3 pointer-events-none opacity-20">
            <span className="h-full w-px bg-white/40" />
            <span className="h-full w-px bg-white/40" />
            <span className="h-full w-px bg-white/40" />
            <span className="h-full w-px bg-white/40" />
          </div>

          {/* Glider puck */}
          <div
            data-testid="motion-timing-glider"
            style={{
              transform:
                testGliderPos === 'end' ? 'translateX(calc(100% - 2.25rem))' : 'translateX(0)',
            }}
            className={`w-9 h-8 rounded bg-gradient-to-r from-amber-500 to-amber-600 shadow-lg flex items-center justify-center text-blue-950 font-black text-xs select-none ${
              styles.motion.duration || 'transition-all duration-200'
            } ${styles.motion.timing || 'ease-out'} ${styles.motion.delay || ''}`}
          >
            <Zap className="w-4 h-4 fill-blue-950" />
          </div>
        </div>

        {/* Active badges */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
            <Clock className="w-2.5 h-2.5 text-amber-500" />
            {activeDurationLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
            <Sparkles className="w-2.5 h-2.5 text-blue-400" />
            {activeTimingLabel}
          </span>
          {styles.motion.delay && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
              <Clock className="w-2.5 h-2.5 text-emerald-400" />
              Delay: {activeDelayLabel}
            </span>
          )}
        </div>
      </div>

      {/* 1-Click Timing Presets */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            1-Click Timing Curves
          </span>
          <span className="text-[10px] text-slate-400">Physics Profiles</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {TIMING_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              data-testid={`timing-preset-${preset.id}`}
              onClick={() =>
                setStyles((prev) => ({
                  ...prev,
                  motion: {
                    ...prev.motion,
                    ...preset.apply(),
                  },
                }))
              }
              className="group p-2 rounded-md border border-border/40 bg-card/40 hover:bg-card hover:border-amber-500/40 text-left transition-all"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-foreground group-hover:text-accent-gold transition-colors">
                  {preset.name}
                </span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-white/5 text-slate-400 border border-white/10">
                  {preset.badge}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Granular Timing Selects */}
      <div className="space-y-2">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
          Granular Timing Controls
        </span>
        <div className="grid grid-cols-2 gap-2">
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
        <StudioSelect
          id={motionDelaySelectId}
          label="Transition Delay"
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
