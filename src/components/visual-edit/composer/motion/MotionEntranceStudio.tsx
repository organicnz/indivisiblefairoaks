'use client';

import { Play, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { VisualComposerMotionPreset, VisualComposerStyles } from '@/types/unified';
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

export const MOTION_PRESETS: readonly VisualComposerMotionPreset[] = [
  {
    id: 'smooth-fade',
    name: 'Smooth Fade In',
    description: 'Clean fade-in opacity reveal with slight 100ms stagger',
    badge: 'Fade',
    apply: () => ({
      entrance: 'animate-in fade-in duration-300',
      delay: 'delay-100',
    }),
  },
  {
    id: 'dynamic-slide-up',
    name: 'Dynamic Slide Up',
    description: 'Smooth bottom slide-in reveal with 150ms civic cadence',
    badge: 'Slide',
    apply: () => ({
      entrance: 'animate-in fade-in slide-in-from-bottom-4 duration-300',
      delay: 'delay-150',
    }),
  },
  {
    id: 'pop-elevate',
    name: 'Pop & Zoom Pop',
    description: 'Impactful scale zoom from 95% for headlines and badges',
    badge: 'Pop',
    apply: () => ({
      entrance: 'animate-in fade-in zoom-in-95 duration-200',
      delay: '',
    }),
  },
  {
    id: 'civic-alert-pulse',
    name: 'Gentle Attention Pulse',
    description: 'Continuous subtle breath rhythm for critical notices and action alerts',
    badge: 'Pulse',
    apply: () => ({
      entrance: 'animate-pulse duration-700',
      delay: '',
    }),
  },
  {
    id: 'static-reset',
    name: 'Static (No Entrance)',
    description: 'Disable entrance animations and delays for instant rendering',
    badge: 'Static',
    apply: () => ({
      entrance: '',
      delay: '',
    }),
  },
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
  const [replayKey, setReplayKey] = useState(0);

  return (
    <div className="space-y-3">
      {/* 1. Live Motion Stage & Replay Card */}
      <div className="p-3 rounded-xl border border-white/10 bg-slate-900/60 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
            <Sparkles size={12} className="text-accent-gold" />
            <span>Live Entrance Stage</span>
          </span>
          <button
            type="button"
            data-testid="replay-motion-button"
            onClick={() => setReplayKey((k) => k + 1)}
            className="text-[10px] text-accent-gold hover:text-white flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded bg-accent-gold/10 hover:bg-accent-gold/20 border border-accent-gold/30 cursor-pointer"
          >
            <Play size={10} className="fill-current" />
            <span>Replay Motion</span>
          </button>
        </div>

        {/* Live Animation Demo Canvas */}
        <div className="relative w-full h-20 rounded-lg bg-black/40 border border-white/5 p-2 flex items-center justify-center overflow-hidden">
          <div
            key={replayKey}
            data-testid="motion-stage-preview-card"
            className={`px-4 py-2 rounded-lg bg-slate-800/80 border border-accent-gold/40 text-center shadow-lg transition-all ${styles.motion.entrance || ''} ${styles.motion.delay || ''}`}
          >
            <span className="text-xs font-bold text-white block">Animated Element Preview</span>
            <span className="text-[9px] text-accent-gold font-mono">
              {styles.motion.entrance ? 'Animation Active' : 'Static (No Entrance)'}
            </span>
          </div>
        </div>

        {/* Live Indicator Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
            Entrance:{' '}
            <strong className="text-white">
              {styles.motion.entrance
                ? styles.motion.entrance.replace('animate-in ', '')
                : 'None (Static)'}
            </strong>
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
            Delay: <strong className="text-white">{styles.motion.delay || 'None (0ms)'}</strong>
          </span>
        </div>

        {/* 1-Click Motion Presets */}
        <div className="pt-1 border-t border-white/5">
          <span className="text-[10px] font-bold text-slate-300 mb-1.5 block">
            1-Click Entrance Presets
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {MOTION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  const applied = preset.apply();
                  setStyles((prev) => ({
                    ...prev,
                    motion: {
                      ...prev.motion,
                      ...applied,
                    },
                  }));
                  setReplayKey((k) => k + 1);
                  toast.success(`Applied ${preset.name}`);
                }}
                className="flex items-center justify-between text-left px-2 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-accent-gold/40 transition-all cursor-pointer group"
              >
                <span className="text-[10px] font-medium text-white group-hover:text-accent-gold truncate">
                  {preset.name}
                </span>
                <span className="text-[8px] px-1 py-0.2 rounded font-mono font-bold bg-accent-gold/20 text-accent-gold border border-accent-gold/30 shrink-0 ml-1">
                  {preset.badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Granular Controls */}
      <div>
        <span className="block text-slate-300 font-bold mb-2 flex items-center gap-1.5 text-xs">
          <Sparkles size={13} className="text-accent-gold" />
          <span>Entrance Dynamics</span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={motionEntranceSelectId}
            label="Entrance Animation"
            value={styles.motion.entrance}
            onChange={(val) => {
              setStyles({
                ...styles,
                motion: { ...styles.motion, entrance: val },
              });
              setReplayKey((k) => k + 1);
            }}
            options={ENTRANCE_OPTIONS}
            size="xs"
          />
          <StudioSelect
            id={motionDelaySelectId}
            label="Entrance Stagger Delay"
            value={styles.motion.delay || ''}
            onChange={(val) => {
              setStyles({
                ...styles,
                motion: { ...styles.motion, delay: val },
              });
              setReplayKey((k) => k + 1);
            }}
            options={DELAY_OPTIONS}
            size="xs"
          />
        </div>
      </div>
    </div>
  );
}
