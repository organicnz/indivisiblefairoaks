'use client';

import type { VisualComposerStyles } from '@/types/unified';
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
    <div className="space-y-2">
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

      {/* Fine-Grained Hover Micro-Interactions Matrix */}
      <div className="mt-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
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
