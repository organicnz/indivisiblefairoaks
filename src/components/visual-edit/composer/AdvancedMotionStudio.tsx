'use client';

import { Eye, EyeOff, Sparkles } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';
import { StudioInput, StudioSection, StudioSelect, StudioToggle } from './ui';

export interface AdvancedMotionStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  motionEntranceSelectId: string;
  motionHoverSelectId: string;
  motionHoverScaleSelectId: string;
  motionHoverLiftSelectId: string;
  motionHoverRotateSelectId: string;
  motionDurationSelectId: string;
  motionDelaySelectId: string;
  motionHoverGlowSelectId: string;
  motionTimingSelectId: string;
  motionHoverBorderSelectId?: string;
  motionHoverShadowSelectId?: string;
  motionHoverBgSelectId?: string;
  motionHoverTextColorSelectId?: string;
  anchorIdInputId?: string;
  compiledClassNames?: string;
}

const ENTRANCE_OPTIONS = [
  { value: '', label: 'None (Static)' },
  { value: 'animate-in fade-in duration-300', label: 'Smooth Fade In' },
  { value: 'animate-in fade-in slide-in-from-bottom-4 duration-300', label: 'Slide Up' },
  { value: 'animate-in fade-in slide-in-from-top-4 duration-300', label: 'Slide Down' },
  { value: 'animate-in fade-in zoom-in-95 duration-200', label: 'Zoom In Pop' },
  { value: 'animate-pulse duration-700', label: 'Gentle Pulse' },
] as const;

const HOVER_OPTIONS = [
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

const HOVER_SCALE_OPTIONS = [
  { value: '', label: 'None (1.0x)' },
  { value: 'hover:scale-[1.01]', label: 'Subtle (+1%)' },
  { value: 'hover:scale-[1.02]', label: 'Card Pop (+2%)' },
  { value: 'hover:scale-105', label: 'Prominent (+5%)' },
  { value: 'hover:scale-110', label: 'Zoom In (+10%)' },
  { value: 'hover:scale-95', label: 'Press Down (-5%)' },
] as const;

const HOVER_LIFT_OPTIONS = [
  { value: '', label: 'None (0)' },
  { value: 'hover:-translate-y-0.5', label: 'Subtle (-2px)' },
  { value: 'hover:-translate-y-1', label: 'Card Lift (-4px)' },
  { value: 'hover:-translate-y-2', label: 'Float (-8px)' },
  { value: 'hover:-translate-y-3', label: 'Dramatic (-12px)' },
] as const;

const HOVER_ROTATE_OPTIONS = [
  { value: '', label: 'None (0deg)' },
  { value: 'hover:rotate-1', label: 'Slight CW (+1deg)' },
  { value: 'hover:-rotate-1', label: 'Slight CCW (-1deg)' },
  { value: 'hover:rotate-2', label: 'Playful Tilt (+2deg)' },
] as const;

const DURATION_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'transition-all duration-150', label: 'Snappy (150ms)' },
  { value: 'transition-all duration-200', label: 'Standard (200ms)' },
  { value: 'transition-all duration-300', label: 'Smooth (300ms)' },
  { value: 'transition-all duration-500', label: 'Cinematic (500ms)' },
  { value: 'transition-all duration-700', label: 'Ambient (700ms)' },
] as const;

const DELAY_OPTIONS = [
  { value: '', label: 'None (0ms)' },
  { value: 'delay-100', label: '+100ms Stagger' },
  { value: 'delay-150', label: '+150ms' },
  { value: 'delay-200', label: '+200ms' },
  { value: 'delay-300', label: '+300ms' },
  { value: 'delay-500', label: '+500ms' },
  { value: 'delay-700', label: '+700ms' },
  { value: 'delay-1000', label: '+1000ms' },
] as const;

const HOVER_GLOW_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'hover:ring-2 hover:ring-accent-gold/60', label: 'Gold Civic Ring (2px)' },
  { value: 'hover:ring-4 hover:ring-accent-gold/40', label: 'Gold Civic Halo (4px)' },
  { value: 'hover:ring-2 hover:ring-blue-500/60', label: 'Navy Blue Focus (2px)' },
  { value: 'hover:ring-2 hover:ring-emerald-500/60', label: 'Emerald Civic Glow (2px)' },
  { value: 'hover:ring-2 hover:ring-white/40', label: 'Subtle White Halo (2px)' },
  { value: 'hover:shadow-[0_0_24px_rgba(245,158,11,0.35)]', label: 'Radial Amber Glow' },
  { value: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.35)]', label: 'Radial Blue Glow' },
] as const;

const HOVER_BORDER_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'hover:border-amber-500', label: 'Gold Accent (amber-500)' },
  { value: 'hover:border-blue-500', label: 'Navy Accent (blue-500)' },
  { value: 'hover:border-white/40', label: 'Frost Glass (white/40)' },
  { value: 'hover:border-rose-500', label: 'Alert Crimson (rose-500)' },
  { value: 'hover:border-emerald-500', label: 'Grassroots Emerald (emerald-500)' },
] as const;

const HOVER_SHADOW_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'hover:shadow-md', label: 'Medium Elevation (md)' },
  { value: 'hover:shadow-lg', label: 'High Elevation (lg)' },
  { value: 'hover:shadow-xl', label: 'Dramatic Depth (xl)' },
  { value: 'hover:shadow-2xl', label: 'Ultra Deep (2xl)' },
  { value: 'hover:shadow-xl hover:shadow-amber-500/20', label: 'Gold Aura Lift' },
  { value: 'hover:shadow-xl hover:shadow-blue-500/20', label: 'Navy Aura Lift' },
] as const;

const HOVER_BG_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'hover:bg-amber-500/10', label: 'Civic Gold Light (10%)' },
  { value: 'hover:bg-amber-500/20', label: 'Civic Gold Rich (20%)' },
  { value: 'hover:bg-blue-600/20', label: 'Navy Highlight (20%)' },
  { value: 'hover:bg-white/10', label: 'Glass Frost Lift (10%)' },
  { value: 'hover:bg-white/15', label: 'Frost Glass Rich (15%)' },
  { value: 'hover:bg-emerald-500/10', label: 'Grassroots Emerald Tint' },
  { value: 'hover:bg-rose-500/10', label: 'Alert Crimson Tint' },
] as const;

const HOVER_TEXT_COLOR_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'hover:text-amber-400', label: 'Civic Gold Focus (amber-400)' },
  { value: 'hover:text-blue-400', label: 'Navy Sky Focus (blue-400)' },
  { value: 'hover:text-emerald-400', label: 'Emerald Focus (emerald-400)' },
  { value: 'hover:text-rose-400', label: 'Crimson Focus (rose-400)' },
  { value: 'hover:text-white', label: 'Crisp Bright White' },
] as const;

const TIMING_OPTIONS = [
  { value: '', label: 'Default Curve (ease)' },
  { value: 'ease-out', label: 'Ease Out (Decelerate)' },
  { value: 'ease-in', label: 'Ease In (Accelerate)' },
  { value: 'ease-in-out', label: 'Ease In Out (Smooth S-Curve)' },
  { value: 'ease-linear', label: 'Linear (Constant Speed)' },
] as const;

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
  motionHoverBorderSelectId = 'motion-hover-border-select',
  motionHoverShadowSelectId = 'motion-hover-shadow-select',
  motionHoverBgSelectId = 'motion-hover-bg-select',
  motionHoverTextColorSelectId = 'motion-hover-text-color-select',
  anchorIdInputId,
  compiledClassNames,
}: AdvancedMotionStudioProps) {
  return (
    <div className="space-y-4">
      {/* 1. Motion & Animation Transitions */}
      <StudioSection title="Motion & Animation Transitions" badge="Dynamics">
        <div>
          <span className="block text-slate-300 font-bold mb-2 flex items-center gap-1.5">
            <Sparkles size={13} className="text-accent-gold" />
            <span>Motion &amp; Animations</span>
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
              id={motionHoverSelectId}
              label="Hover Interaction"
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
          </div>

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
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
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

            <div className="mt-2">
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
          </div>
        </div>
      </StudioSection>

      {/* 2. HTML Anchor ID Target */}
      {anchorIdInputId && (
        <StudioSection title="Page Anchor & Linking" badge="Deep Link">
          <StudioInput
            id={anchorIdInputId}
            label="HTML Anchor ID (Section Target)"
            value={styles.anchorId}
            onChange={(val) =>
              setStyles({
                ...styles,
                anchorId: val.toLowerCase().replace(/[^a-z0-9-_]/g, ''),
              })
            }
            placeholder="e.g. rally-info, volunteer-form"
            description="Allows links like #rally-info to jump directly to this block."
          />
        </StudioSection>
      )}

      {/* 3. Device Visibility Matrix */}
      <StudioSection title="Responsive Device Visibility" badge="Matrix">
        <div>
          <span className="block text-slate-300 font-bold mb-2">Device Visibility</span>
          <div className="space-y-1.5">
            {[
              {
                key: 'hideMobile' as const,
                label: 'Hide on Mobile (<640px)',
                active: styles.responsive.hideMobile,
              },
              {
                key: 'hideTablet' as const,
                label: 'Hide on Tablet (640-768px)',
                active: styles.responsive.hideTablet,
              },
              {
                key: 'hideDesktop' as const,
                label: 'Hide on Desktop (>768px)',
                active: styles.responsive.hideDesktop,
              },
              {
                key: 'hidePrint' as const,
                label: 'Hide on Print / Paper Export',
                active: styles.responsive.hidePrint,
              },
            ].map((item) => (
              <StudioToggle
                key={item.key}
                label={item.label}
                active={item.active}
                activeTone="rose"
                onToggle={() =>
                  setStyles({
                    ...styles,
                    responsive: {
                      ...styles.responsive,
                      [item.key]: !styles.responsive[item.key],
                    },
                  })
                }
                icon={
                  item.active ? (
                    <EyeOff size={13} className="text-rose-300" />
                  ) : (
                    <Eye size={13} className="text-slate-400" />
                  )
                }
              />
            ))}
          </div>
        </div>
      </StudioSection>

      {/* 4. Generated CSS Classes Preview */}
      {compiledClassNames !== undefined && (
        <StudioSection title="Generated CSS Class Output" badge="Classes">
          <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Compiled Classnames Preview
            </span>
            <p className="font-mono text-[10px] text-accent-gold break-all">
              {compiledClassNames || '(default block styles)'}
            </p>
          </div>
        </StudioSection>
      )}
    </div>
  );
}
