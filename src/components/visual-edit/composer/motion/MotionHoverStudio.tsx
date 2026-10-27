'use client';

import { RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { VisualComposerHoverPreset, VisualComposerStyles } from '@/types/unified';
import { StudioSelect } from '../ui';

export const HOVER_OPTIONS = [
  { value: '', label: 'None' },
  {
    value: 'hover:-translate-y-1 hover:shadow-xl transition-all duration-200',
    label: 'Float Card Up',
  },
  { value: 'hover:scale-[1.02] transition-transform duration-200', label: 'Scale Pop' },
  {
    value: 'hover:ring-2 hover:ring-amber-500/60 transition-all duration-200',
    label: 'Gold Border Glow',
  },
  { value: 'hover:opacity-85 transition-opacity duration-200', label: 'Subtle Dim' },
] as const;

export const HOVER_SCALE_OPTIONS = [
  { value: '', label: 'None (1.0x)' },
  { value: 'hover:scale-[1.01]', label: 'Subtle (+1%)' },
  { value: 'hover:scale-[1.02]', label: 'Card Pop (+2%)' },
  { value: 'hover:scale-105', label: 'Prominent (+5%)' },
  { value: 'hover:scale-110', label: 'Zoom In (+10%)' },
  { value: 'hover:scale-95', label: 'Press Down (-5%)' },
] as const;

export const HOVER_LIFT_OPTIONS = [
  { value: '', label: 'None (0)' },
  { value: 'hover:-translate-y-0.5', label: 'Subtle (-2px)' },
  { value: 'hover:-translate-y-1', label: 'Card Lift (-4px)' },
  { value: 'hover:-translate-y-2', label: 'Float (-8px)' },
  { value: 'hover:-translate-y-3', label: 'Dramatic (-12px)' },
] as const;

export const HOVER_ROTATE_OPTIONS = [
  { value: '', label: 'None (0deg)' },
  { value: 'hover:rotate-1', label: 'Slight CW (+1deg)' },
  { value: 'hover:-rotate-1', label: 'Slight CCW (-1deg)' },
  { value: 'hover:rotate-2', label: 'Playful Tilt (+2deg)' },
] as const;

export const HOVER_GLOW_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'hover:ring-2 hover:ring-accent-gold/60', label: 'Gold Civic Ring (2px)' },
  { value: 'hover:ring-4 hover:ring-accent-gold/40', label: 'Gold Civic Halo (4px)' },
  { value: 'hover:ring-2 hover:ring-blue-500/60', label: 'Navy Blue Focus (2px)' },
  { value: 'hover:ring-2 hover:ring-emerald-500/60', label: 'Emerald Civic Glow (2px)' },
  { value: 'hover:ring-2 hover:ring-white/40', label: 'Subtle White Halo (2px)' },
  { value: 'hover:shadow-[0_0_24px_rgba(245,158,11,0.35)]', label: 'Radial Amber Glow' },
  { value: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.35)]', label: 'Radial Blue Glow' },
] as const;

export const HOVER_BORDER_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'hover:border-amber-500', label: 'Gold Accent (amber-500)' },
  { value: 'hover:border-blue-500', label: 'Navy Accent (blue-500)' },
  { value: 'hover:border-white/40', label: 'Frost Glass (white/40)' },
  { value: 'hover:border-rose-500', label: 'Alert Crimson (rose-500)' },
  { value: 'hover:border-emerald-500', label: 'Grassroots Emerald (emerald-500)' },
] as const;

export const HOVER_SHADOW_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'hover:shadow-md', label: 'Medium Elevation (md)' },
  { value: 'hover:shadow-lg', label: 'High Elevation (lg)' },
  { value: 'hover:shadow-xl', label: 'Dramatic Depth (xl)' },
  { value: 'hover:shadow-2xl', label: 'Ultra Deep (2xl)' },
  { value: 'hover:shadow-xl hover:shadow-amber-500/20', label: 'Gold Aura Lift' },
  { value: 'hover:shadow-xl hover:shadow-blue-500/20', label: 'Navy Aura Lift' },
] as const;

export const HOVER_BG_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'hover:bg-amber-500/10', label: 'Civic Gold Light (10%)' },
  { value: 'hover:bg-amber-500/20', label: 'Civic Gold Rich (20%)' },
  { value: 'hover:bg-blue-600/20', label: 'Navy Highlight (20%)' },
  { value: 'hover:bg-white/10', label: 'Glass Frost Lift (10%)' },
  { value: 'hover:bg-white/15', label: 'Frost Glass Rich (15%)' },
  { value: 'hover:bg-emerald-500/10', label: 'Grassroots Emerald Tint' },
  { value: 'hover:bg-rose-500/10', label: 'Alert Crimson Tint' },
] as const;

export const HOVER_TEXT_COLOR_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'hover:text-amber-400', label: 'Civic Gold Focus (amber-400)' },
  { value: 'hover:text-blue-400', label: 'Navy Sky Focus (blue-400)' },
  { value: 'hover:text-emerald-400', label: 'Emerald Focus (emerald-400)' },
  { value: 'hover:text-rose-400', label: 'Crimson Focus (rose-400)' },
  { value: 'hover:text-white', label: 'Crisp Bright White' },
] as const;

export const HOVER_PRESETS: readonly VisualComposerHoverPreset[] = [
  {
    id: 'float-elevation',
    name: 'Float Card Up',
    description: 'Smooth vertical lift (-4px) combined with high elevation shadow depth',
    badge: 'Float',
    apply: () => ({
      hoverLift: 'hover:-translate-y-1',
      hoverShadow: 'hover:shadow-xl',
    }),
  },
  {
    id: 'scale-civic-ring',
    name: 'Scale Pop & Civic Ring',
    description: 'Energetic scale zoom (+2%) with bright gold civic focus ring',
    badge: 'Pop',
    apply: () => ({
      hoverScale: 'hover:scale-[1.02]',
      hoverGlow: 'hover:ring-2 hover:ring-accent-gold/60',
    }),
  },
  {
    id: 'civic-gold-accent',
    name: 'Civic Gold Aura',
    description: 'Warm gold background tint, amber border outline, and vibrant text focus',
    badge: 'Civic',
    apply: () => ({
      hoverBg: 'hover:bg-amber-500/10',
      hoverBorder: 'hover:border-amber-500',
      hoverTextColor: 'hover:text-amber-400',
    }),
  },
  {
    id: 'subtle-tilt-lift',
    name: 'Subtle 3D Tilt',
    description: 'Playful clockwise tilt (+1deg) with gentle vertical elevation',
    badge: 'Tilt',
    apply: () => ({
      hoverRotate: 'hover:rotate-1',
      hoverLift: 'hover:-translate-y-0.5',
    }),
  },
  {
    id: 'reset-hover',
    name: 'Reset Hover Effects',
    description: 'Clear all hover micro-interactions, scale, glow, and elevations',
    badge: 'Reset',
    apply: () => ({
      hover: '',
      hoverScale: '',
      hoverLift: '',
      hoverRotate: '',
      hoverGlow: '',
      hoverBorder: '',
      hoverShadow: '',
      hoverBg: '',
      hoverTextColor: '',
    }),
  },
] as const;

export interface MotionHoverStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  motionHoverSelectId?: string;
  motionHoverScaleSelectId?: string;
  motionHoverLiftSelectId?: string;
  motionHoverRotateSelectId?: string;
  motionHoverGlowSelectId?: string;
  motionHoverBorderSelectId?: string;
  motionHoverShadowSelectId?: string;
  motionHoverBgSelectId?: string;
  motionHoverTextColorSelectId?: string;
}

export function MotionHoverStudio({
  styles,
  setStyles,
  motionHoverSelectId,
  motionHoverScaleSelectId,
  motionHoverLiftSelectId,
  motionHoverRotateSelectId,
  motionHoverGlowSelectId,
  motionHoverBorderSelectId = 'motion-hover-border-select',
  motionHoverShadowSelectId = 'motion-hover-shadow-select',
  motionHoverBgSelectId = 'motion-hover-bg-select',
  motionHoverTextColorSelectId = 'motion-hover-text-color-select',
}: MotionHoverStudioProps) {
  return (
    <div className="space-y-3">
      {/* 1. Live Interactive Hover Dynamics Playground */}
      <div className="p-3 rounded-xl border border-white/10 bg-slate-900/60 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
            <Sparkles size={12} className="text-accent-gold" />
            <span>Live Hover Dynamics Playground</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setStyles((prev) => ({
                ...prev,
                motion: {
                  ...prev.motion,
                  hover: '',
                  hoverScale: '',
                  hoverLift: '',
                  hoverRotate: '',
                  hoverGlow: '',
                  hoverBorder: '',
                  hoverShadow: '',
                  hoverBg: '',
                  hoverTextColor: '',
                },
              }));
              toast.success('Reset hover micro-interactions');
            }}
            className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5 cursor-pointer"
          >
            <RotateCcw size={10} />
            <span>Reset Hover</span>
          </button>
        </div>

        {/* Live Staged Hover Box */}
        <div className="relative w-full h-24 rounded-lg bg-black/40 border border-white/5 p-2 flex items-center justify-center overflow-hidden">
          <div
            data-testid="motion-hover-preview-card"
            className={`px-5 py-2.5 rounded-xl border border-white/15 bg-slate-800/80 text-center cursor-pointer transition-all duration-200 ${styles.motion.hover || ''} ${styles.motion.hoverScale || ''} ${styles.motion.hoverLift || ''} ${styles.motion.hoverRotate || ''} ${styles.motion.hoverGlow || ''} ${styles.motion.hoverBorder || ''} ${styles.motion.hoverShadow || ''} ${styles.motion.hoverBg || ''} ${styles.motion.hoverTextColor || ''}`}
          >
            <span className="text-xs font-bold text-white block">Hover Over This Card</span>
            <span className="text-[10px] text-slate-400 block">
              Experience active lift, scale, glow, and shadow response
            </span>
          </div>
        </div>

        {/* Live Indicator Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
            Scale:{' '}
            <strong className="text-white">
              {styles.motion.hoverScale
                ? styles.motion.hoverScale.replace('hover:scale-', '')
                : '1.0x'}
            </strong>
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
            Lift:{' '}
            <strong className="text-white">
              {styles.motion.hoverLift
                ? styles.motion.hoverLift.replace('hover:-translate-y-', '-')
                : 'None'}
            </strong>
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
            Glow:{' '}
            <strong className="text-accent-gold">
              {styles.motion.hoverGlow ? 'Active' : 'None'}
            </strong>
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
            Border:{' '}
            <strong className="text-accent-gold">
              {styles.motion.hoverBorder ? 'Accent' : 'None'}
            </strong>
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
            Shadow:{' '}
            <strong className="text-white">
              {styles.motion.hoverShadow
                ? styles.motion.hoverShadow.replace('hover:shadow-', '')
                : 'None'}
            </strong>
          </span>
        </div>

        {/* 1-Click Hover Presets */}
        <div className="pt-1 border-t border-white/5">
          <span className="text-[10px] font-bold text-slate-300 mb-1.5 block">
            1-Click Hover Presets
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {HOVER_PRESETS.map((preset) => (
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

      {/* 2. Preset Select */}
      <StudioSelect
        id={motionHoverSelectId}
        label="Hover Interaction Preset"
        value={styles.motion.hover}
        onChange={(val) =>
          setStyles({
            ...styles,
            motion: { ...styles.motion, hover: val },
          })
        }
        options={HOVER_OPTIONS}
        size="xs"
      />

      {/* 3. Fine-Grained Hover Micro-Interactions Matrix */}
      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
        <span className="text-[10px] text-accent-gold font-bold uppercase tracking-wider block">
          Hover Micro-Interactions &amp; Timing
        </span>
        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={motionHoverScaleSelectId}
            label="Scale on Hover"
            value={styles.motion.hoverScale || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                motion: { ...styles.motion, hoverScale: val },
              })
            }
            options={HOVER_SCALE_OPTIONS}
            size="xs"
          />
          <StudioSelect
            id={motionHoverLiftSelectId}
            label="Vertical Lift"
            value={styles.motion.hoverLift || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                motion: { ...styles.motion, hoverLift: val },
              })
            }
            options={HOVER_LIFT_OPTIONS}
            size="xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StudioSelect
            id={motionHoverRotateSelectId}
            label="Hover Rotation"
            value={styles.motion.hoverRotate || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                motion: { ...styles.motion, hoverRotate: val },
              })
            }
            options={HOVER_ROTATE_OPTIONS}
            size="xs"
          />
          <StudioSelect
            id={motionHoverGlowSelectId}
            label="Hover Glow Ring"
            value={styles.motion.hoverGlow || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                motion: { ...styles.motion, hoverGlow: val },
              })
            }
            options={HOVER_GLOW_OPTIONS}
            size="xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <StudioSelect
            id={motionHoverBorderSelectId}
            label="Hover Border Accent"
            value={styles.motion.hoverBorder || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                motion: { ...styles.motion, hoverBorder: val },
              })
            }
            options={HOVER_BORDER_OPTIONS}
            size="xs"
          />
          <StudioSelect
            id={motionHoverShadowSelectId}
            label="Hover Elevation Shadow"
            value={styles.motion.hoverShadow || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                motion: { ...styles.motion, hoverShadow: val },
              })
            }
            options={HOVER_SHADOW_OPTIONS}
            size="xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <StudioSelect
            id={motionHoverBgSelectId}
            label="Hover Background Tint (Pro)"
            value={styles.motion.hoverBg || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                motion: { ...styles.motion, hoverBg: val },
              })
            }
            options={HOVER_BG_OPTIONS}
            size="xs"
          />
          <StudioSelect
            id={motionHoverTextColorSelectId}
            label="Hover Text Accent (Pro)"
            value={styles.motion.hoverTextColor || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                motion: { ...styles.motion, hoverTextColor: val },
              })
            }
            options={HOVER_TEXT_COLOR_OPTIONS}
            size="xs"
          />
        </div>
      </div>
    </div>
  );
}
