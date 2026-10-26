'use client';

import { Eye, EyeOff, Sparkles } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';

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
  anchorIdInputId,
  compiledClassNames,
}: AdvancedMotionStudioProps) {
  return (
    <div className="space-y-4">
      {/* Motion & Animations */}
      <div>
        <span className="block text-slate-300 font-bold mb-2 flex items-center gap-1.5">
          <Sparkles size={13} className="text-accent-gold" />
          <span>Motion &amp; Animations</span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor={motionEntranceSelectId}
              className="text-[10px] text-slate-400 mb-1 block"
            >
              Entrance Animation
            </label>
            <select
              id={motionEntranceSelectId}
              value={styles.motion.entrance}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  motion: { ...styles.motion, entrance: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">None (Static)</option>
              <option value="animate-in fade-in duration-300">Smooth Fade In</option>
              <option value="animate-in fade-in slide-in-from-bottom-4 duration-300">
                Slide Up
              </option>
              <option value="animate-in fade-in slide-in-from-top-4 duration-300">
                Slide Down
              </option>
              <option value="animate-in fade-in zoom-in-95 duration-200">Zoom In Pop</option>
              <option value="animate-pulse duration-700">Gentle Pulse</option>
            </select>
          </div>
          <div>
            <label htmlFor={motionHoverSelectId} className="text-[10px] text-slate-400 mb-1 block">
              Hover Interaction
            </label>
            <select
              id={motionHoverSelectId}
              value={styles.motion.hover}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  motion: { ...styles.motion, hover: e.target.value },
                })
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
            >
              <option value="">None</option>
              <option value="hover:-translate-y-1 hover:shadow-xl transition-all duration-200">
                Float Card Up
              </option>
              <option value="hover:scale-[1.02] transition-transform duration-200">
                Scale Pop
              </option>
              <option value="hover:ring-2 hover:ring-amber-500/60 transition-all duration-200">
                Gold Border Glow
              </option>
              <option value="hover:opacity-85 transition-opacity duration-200">Subtle Dim</option>
            </select>
          </div>
        </div>

        {/* Fine-Grained Hover Micro-Interactions Matrix */}
        <div className="mt-2.5 p-2 rounded-xl bg-white/5 border border-white/10 space-y-2">
          <span className="text-[10px] text-accent-gold font-bold uppercase tracking-wider block">
            Hover Micro-Interactions &amp; Timing
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor={motionHoverScaleSelectId}
                className="text-[9px] text-slate-400 mb-0.5 block"
              >
                Scale on Hover
              </label>
              <select
                id={motionHoverScaleSelectId}
                value={styles.motion.hoverScale}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    motion: { ...styles.motion, hoverScale: e.target.value },
                  })
                }
                className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
              >
                <option value="">None (1.0x)</option>
                <option value="hover:scale-[1.01]">Subtle (+1%)</option>
                <option value="hover:scale-[1.02]">Card Pop (+2%)</option>
                <option value="hover:scale-105">Prominent (+5%)</option>
                <option value="hover:scale-110">Zoom In (+10%)</option>
                <option value="hover:scale-95">Press Down (-5%)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor={motionHoverLiftSelectId}
                className="text-[9px] text-slate-400 mb-0.5 block"
              >
                Vertical Lift
              </label>
              <select
                id={motionHoverLiftSelectId}
                value={styles.motion.hoverLift}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    motion: { ...styles.motion, hoverLift: e.target.value },
                  })
                }
                className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
              >
                <option value="">None (0)</option>
                <option value="hover:-translate-y-0.5">Subtle (-2px)</option>
                <option value="hover:-translate-y-1">Card Lift (-4px)</option>
                <option value="hover:-translate-y-2">Float (-8px)</option>
                <option value="hover:-translate-y-3">Dramatic (-12px)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor={motionHoverRotateSelectId}
                className="text-[9px] text-slate-400 mb-0.5 block"
              >
                Hover Rotation
              </label>
              <select
                id={motionHoverRotateSelectId}
                value={styles.motion.hoverRotate}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    motion: { ...styles.motion, hoverRotate: e.target.value },
                  })
                }
                className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
              >
                <option value="">None (0deg)</option>
                <option value="hover:rotate-1">Slight CW (+1deg)</option>
                <option value="hover:-rotate-1">Slight CCW (-1deg)</option>
                <option value="hover:rotate-2">Playful Tilt (+2deg)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor={motionDurationSelectId}
                className="text-[9px] text-slate-400 mb-0.5 block"
              >
                Transition Speed
              </label>
              <select
                id={motionDurationSelectId}
                value={styles.motion.duration}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    motion: { ...styles.motion, duration: e.target.value },
                  })
                }
                className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
              >
                <option value="">Default</option>
                <option value="transition-all duration-150">Snappy (150ms)</option>
                <option value="transition-all duration-200">Standard (200ms)</option>
                <option value="transition-all duration-300">Smooth (300ms)</option>
                <option value="transition-all duration-500">Cinematic (500ms)</option>
                <option value="transition-all duration-700">Ambient (700ms)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label
                htmlFor={motionDelaySelectId}
                className="text-[9px] text-slate-400 mb-0.5 block"
              >
                Entrance Stagger Delay
              </label>
              <select
                id={motionDelaySelectId}
                value={styles.motion.delay || ''}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    motion: { ...styles.motion, delay: e.target.value },
                  })
                }
                className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
              >
                <option value="">None (0ms)</option>
                <option value="delay-100">+100ms Stagger</option>
                <option value="delay-150">+150ms</option>
                <option value="delay-200">+200ms</option>
                <option value="delay-300">+300ms</option>
                <option value="delay-500">+500ms</option>
                <option value="delay-700">+700ms</option>
                <option value="delay-1000">+1000ms</option>
              </select>
            </div>

            <div>
              <label
                htmlFor={motionHoverGlowSelectId}
                className="text-[9px] text-slate-400 mb-0.5 block"
              >
                Hover Glow Ring
              </label>
              <select
                id={motionHoverGlowSelectId}
                value={styles.motion.hoverGlow || ''}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    motion: { ...styles.motion, hoverGlow: e.target.value },
                  })
                }
                className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
              >
                <option value="">None</option>
                <option value="hover:ring-2 hover:ring-accent-gold/60">
                  Gold Civic Ring (2px)
                </option>
                <option value="hover:ring-4 hover:ring-accent-gold/40">
                  Gold Civic Halo (4px)
                </option>
                <option value="hover:ring-2 hover:ring-blue-500/60">Navy Blue Focus (2px)</option>
                <option value="hover:ring-2 hover:ring-emerald-500/60">
                  Emerald Civic Glow (2px)
                </option>
                <option value="hover:ring-2 hover:ring-white/40">Subtle White Halo (2px)</option>
                <option value="hover:shadow-[0_0_24px_rgba(245,158,11,0.35)]">
                  Radial Amber Glow
                </option>
                <option value="hover:shadow-[0_0_30px_rgba(59,130,246,0.35)]">
                  Radial Blue Glow
                </option>
              </select>
            </div>
          </div>

          <div className="mt-2">
            <label
              htmlFor={motionTimingSelectId}
              className="text-[9px] text-slate-400 mb-0.5 block"
            >
              Animation Easing Curve
            </label>
            <select
              id={motionTimingSelectId}
              value={styles.motion.timing || ''}
              onChange={(e) =>
                setStyles({
                  ...styles,
                  motion: { ...styles.motion, timing: e.target.value },
                })
              }
              className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
            >
              <option value="">Default Curve (ease)</option>
              <option value="ease-out">Ease Out (Decelerate)</option>
              <option value="ease-in">Ease In (Accelerate)</option>
              <option value="ease-in-out">Ease In Out (Smooth S-Curve)</option>
              <option value="ease-linear">Linear (Constant Speed)</option>
            </select>
          </div>
        </div>
      </div>

      {/* HTML Anchor ID */}
      {anchorIdInputId && (
        <div>
          <label htmlFor={anchorIdInputId} className="block text-slate-300 font-bold mb-1">
            HTML Anchor ID (Section Target)
          </label>
          <input
            id={anchorIdInputId}
            type="text"
            value={styles.anchorId}
            onChange={(e) =>
              setStyles({
                ...styles,
                anchorId: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''),
              })
            }
            placeholder="e.g. rally-info, volunteer-form"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            Allows links like <code className="text-accent-gold">#rally-info</code> to jump directly
            to this block.
          </p>
        </div>
      )}

      {/* Device Visibility */}
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
            <button
              key={item.key}
              type="button"
              onClick={() =>
                setStyles({
                  ...styles,
                  responsive: {
                    ...styles.responsive,
                    [item.key]: !styles.responsive[item.key],
                  },
                })
              }
              className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-colors ${
                item.active
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              <span>{item.label}</span>
              {item.active ? <EyeOff size={13} /> : <Eye size={13} className="text-slate-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* Generated CSS Classes Preview */}
      {compiledClassNames !== undefined && (
        <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Compiled Classnames Preview
          </span>
          <p className="font-mono text-[10px] text-accent-gold break-all">
            {compiledClassNames || '(default block styles)'}
          </p>
        </div>
      )}
    </div>
  );
}
