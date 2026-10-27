'use client';

import { RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { VisualComposerStyles } from '@/types/unified';
import { SHAPE_DIVIDER_PRESETS } from '../constants';
import { StudioSection, StudioSelect } from '../ui';

export interface SectionDividersStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  showBorders?: boolean;
  showDividers?: boolean;
  showClipping?: boolean;
  sectionRadiusSelectId?: string;
  sectionShadowSelectId?: string;
  sectionBorderSelectId?: string;
  sectionBorderColorSelectId?: string;
  sectionBackdropBlurSelectId?: string;
  sectionDividerSelectId?: string;
  sectionTopDividerSelectId?: string;
  sectionBottomDividerSelectId?: string;
  sectionDividerColorSelectId?: string;
  sectionOverflowSelectId?: string;
  sectionZIndexSelectId?: string;
}

export function SectionDividersStudio({
  styles,
  setStyles,
  showBorders = true,
  showDividers = true,
  showClipping = true,
  sectionRadiusSelectId,
  sectionShadowSelectId,
  sectionBorderSelectId,
  sectionBorderColorSelectId,
  sectionBackdropBlurSelectId,
  sectionDividerSelectId,
  sectionTopDividerSelectId,
  sectionBottomDividerSelectId,
  sectionDividerColorSelectId = 'section-divider-color',
  sectionOverflowSelectId,
  sectionZIndexSelectId,
}: SectionDividersStudioProps) {
  return (
    <>
      {/* ── Section Shape & Boundary Geometry Visualizer ── */}
      <StudioSection
        title="Shape Dividers & Boundary Geometry"
        badge="Visualizer"
        description="Interactive live geometry preview and 1-click architectural section dividers."
      >
        <div className="p-3 rounded-xl border border-white/10 bg-slate-900/60 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent-gold" />
              <span>Live Section Boundary Preview</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setStyles((prev) => ({
                  ...prev,
                  section: {
                    ...prev.section,
                    divider: '',
                    topDivider: '',
                    bottomDivider: '',
                    dividerColor: '',
                    radius: 'rounded-none',
                    border: '',
                    shadow: 'shadow-none',
                  },
                }));
                toast.success('Reset section boundaries to flush rectangular');
              }}
              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5 cursor-pointer"
            >
              <RotateCcw size={10} />
              <span>Reset Boundaries</span>
            </button>
          </div>

          {/* Simulated Section Outer Canvas */}
          <div className="relative w-full h-28 rounded-lg bg-black/40 border border-white/5 p-2 flex items-center justify-center overflow-hidden">
            <div
              className={`w-full h-full flex flex-col justify-between p-2 transition-all duration-300 relative ${styles.section.radius || 'rounded-none'} ${styles.section.border || 'border'} ${styles.section.borderColor || 'border-border'} ${styles.section.shadow || 'shadow-none'} ${styles.effects.backdropBlur || ''} ${styles.section.overflow || ''} bg-slate-800/60`}
            >
              {/* Top Divider Indicator Bar */}
              <div className="w-full flex items-center justify-center">
                {styles.section.topDivider ? (
                  <div
                    className={`w-full h-1.5 rounded-full ${styles.section.dividerColor || 'bg-amber-500/60'} animate-pulse`}
                  />
                ) : (
                  <span className="text-[8px] text-slate-400 tracking-wider font-mono">
                    TOP FLUSH
                  </span>
                )}
              </div>

              {/* Center Simulated Section Body */}
              <div className="flex flex-col items-center justify-center gap-0.5">
                <span className="text-[10px] font-bold text-white tracking-wide">
                  Section Canvas Surface
                </span>
                <span className="text-[8px] text-slate-400 font-mono">
                  {styles.section.containerWidth || 'Standard Container'} •{' '}
                  {styles.section.paddingY || 'py-8'}
                </span>
              </div>

              {/* Bottom Divider Indicator Bar */}
              <div className="w-full flex items-center justify-center">
                {styles.section.bottomDivider ? (
                  <div
                    className={`w-full h-1.5 rounded-full ${styles.section.dividerColor || 'bg-amber-500/60'} animate-pulse`}
                  />
                ) : (
                  <span className="text-[8px] text-slate-400 tracking-wider font-mono">
                    BOTTOM FLUSH
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live Badge Metas */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
              Radius:{' '}
              <strong className="text-white">{styles.section.radius || 'Square (0)'}</strong>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
              Shadow:{' '}
              <strong className="text-white">{styles.section.shadow || 'Flat (None)'}</strong>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
              Top:{' '}
              <strong className="text-accent-gold">
                {styles.section.topDivider ? 'Custom Shape' : 'Flush'}
              </strong>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
              Bottom:{' '}
              <strong className="text-accent-gold">
                {styles.section.bottomDivider ? 'Custom Shape' : 'Flush'}
              </strong>
            </span>
            {styles.effects.backdropBlur && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-accent-gold/10 border border-accent-gold/30 text-accent-gold">
                Glass: {styles.effects.backdropBlur}
              </span>
            )}
          </div>

          {/* 1-Click Divider Presets */}
          <div className="pt-1 border-t border-white/5">
            <span className="text-[10px] font-bold text-slate-300 mb-1.5 block">
              1-Click Boundary Presets
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {SHAPE_DIVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const applied = preset.apply();
                    setStyles((prev) => ({
                      ...prev,
                      section: {
                        ...prev.section,
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
      </StudioSection>

      {/* ── 5. Borders & Glassmorphism ──────────────────────────────────── */}
      {showBorders && (
        <StudioSection
          title="Borders, Radius & Glassmorphism"
          badge="Style"
          description="Surface curvature, shadow elevations, hairline framing, and frost blur."
        >
          <div className="grid grid-cols-2 gap-2">
            <StudioSelect
              id={sectionRadiusSelectId}
              label="Section Corner Radius"
              size="xs"
              value={styles.section.radius}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, radius: val },
                })
              }
              options={[
                { value: 'rounded-none', label: 'Square (0)' },
                { value: 'rounded-xl', label: 'Subtle (12px)' },
                { value: 'rounded-2xl', label: 'Modern Card (16px)' },
                { value: 'rounded-3xl', label: 'Pill Smooth (24px)' },
                { value: 'rounded-[2.5rem]', label: 'Deep Dramatic (40px)' },
              ]}
            />
            <StudioSelect
              id={sectionShadowSelectId}
              label="Section Shadow"
              size="xs"
              value={styles.section.shadow}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, shadow: val },
                })
              }
              options={[
                { value: 'shadow-none', label: 'Flat (None)' },
                { value: 'shadow-md', label: 'Medium' },
                { value: 'shadow-xl', label: 'High Elevation' },
                { value: 'shadow-2xl', label: 'Maximum Depth' },
                { value: 'shadow-2xl shadow-amber-500/10', label: 'Civic Gold Glow' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StudioSelect
              id={sectionBorderSelectId}
              label="Section Border Frame"
              size="xs"
              value={styles.section.border || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, border: val },
                })
              }
              options={[
                { value: '', label: 'None (No Border)' },
                { value: 'border', label: 'Thin Hairline (1px)' },
                { value: 'border-2', label: 'Medium Border (2px)' },
                { value: 'border-4', label: 'Heavy Frame (4px)' },
                { value: 'border-y-2', label: 'Top & Bottom Frame' },
                { value: 'border-t-4', label: 'Top Accent Bar' },
                { value: 'border-b-4', label: 'Bottom Accent Bar' },
              ]}
            />
            <StudioSelect
              id={sectionBorderColorSelectId}
              label="Section Border Color"
              size="xs"
              value={styles.section.borderColor || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, borderColor: val },
                })
              }
              options={[
                { value: 'border-border', label: 'Default Frame Color' },
                { value: 'border-amber-500/50', label: 'Civic Gold Outline' },
                { value: 'border-blue-900/60', label: 'Patriotic Navy Outline' },
                { value: 'border-white/20', label: 'Frost Glass Outline' },
                { value: 'border-rose-500/50', label: 'Alert Crimson Outline' },
                { value: 'border-emerald-500/50', label: 'Grassroots Emerald Outline' },
              ]}
            />
          </div>

          <StudioSelect
            id={sectionBackdropBlurSelectId}
            label="Section Backdrop Glass Effect"
            value={styles.effects.backdropBlur}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, backdropBlur: val },
              })
            }
            options={[
              { value: '', label: 'None (Standard Clear)' },
              { value: 'backdrop-blur-sm', label: 'Subtle Frosted (blur-sm)' },
              { value: 'backdrop-blur-md', label: 'Medium Frosted Glass (blur-md)' },
              { value: 'backdrop-blur-lg', label: 'Deep Glass Surface (blur-lg)' },
              { value: 'backdrop-blur-xl', label: 'Ultra Liquid Glass (blur-xl)' },
            ]}
          />
        </StudioSection>
      )}

      {/* ── 6. Shape Dividers & Separators ─────────────────────────────── */}
      {showDividers && (
        <StudioSection
          title="Shape Dividers & Cutouts"
          badge="Visual"
          description="Top and bottom geometric slants, curved arches, and glowing horizons."
        >
          <StudioSelect
            id={sectionDividerSelectId}
            label="Section Separator Dividers & Cutouts"
            value={styles.section.divider}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, divider: val },
              })
            }
            options={[
              { value: '', label: 'No Divider (None)' },
              { value: 'border-t border-border', label: 'Top Hairline Separator' },
              { value: 'border-b border-border', label: 'Bottom Hairline Separator' },
              { value: 'border-y border-border', label: 'Top & Bottom Separators' },
              { value: 'border-t-4 border-amber-500', label: 'Gold Accent Header Bar' },
              { value: 'border-t-4 border-blue-900', label: 'Navy Accent Header Bar' },
              {
                value: '[clip-path:polygon(0_0,100%_3vw,100%_100%,0_100%)]',
                label: 'Diagonal Slant Cutout (3vw)',
              },
              {
                value: '[clip-path:polygon(0_3vw,100%_0,100%_100%,0_100%)]',
                label: 'Reverse Diagonal Slant (-3vw)',
              },
              {
                value: '[clip-path:polygon(0_0,100%_0,100%_calc(100%-3vw),0_100%)]',
                label: 'Bottom Diagonal Slant (3vw)',
              },
              {
                value: '[clip-path:polygon(0_0,50%_3vw,100%_0,100%_100%,0_100%)]',
                label: 'Triangle Arrow Transition',
              },
              {
                value: 'rounded-t-[3rem] border-t-2 border-border',
                label: 'Curved Arch Header (3rem)',
              },
              {
                value: 'rounded-b-[3rem] border-b-2 border-border',
                label: 'Pill Arch Footer (3rem)',
              },
              {
                value:
                  'shadow-[0_-8px_24px_-6px_rgba(245,158,11,0.25)] border-t border-amber-500/40',
                label: 'Top Civic Gold Horizon Glow',
              },
              {
                value:
                  'shadow-[0_8px_24px_-6px_rgba(245,158,11,0.25)] border-b border-amber-500/40',
                label: 'Bottom Civic Gold Horizon Glow',
              },
            ]}
          />

          <div className="grid grid-cols-2 gap-2">
            <StudioSelect
              id={sectionTopDividerSelectId}
              label="Top Shape Divider (Pro)"
              size="xs"
              value={styles.section.topDivider || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, topDivider: val },
                })
              }
              options={[
                { value: '', label: 'None (Flush Top)' },
                { value: 'border-t border-border/80', label: 'Hairline Border Top' },
                { value: 'border-t-2 border-accent-gold', label: 'Gold Accent Bar (2px)' },
                { value: 'border-t-4 border-amber-500', label: 'Bold Gold Banner (4px)' },
                { value: 'border-t-4 border-blue-900', label: 'Navy Accent Header (4px)' },
                {
                  value: 'rounded-t-[2.5rem] border-t-2 border-border',
                  label: 'Curved Arch Top',
                },
                {
                  value: 'rounded-t-[4rem] border-t-2 border-border',
                  label: 'Deep Arch Dome Top',
                },
                {
                  value: '[clip-path:polygon(0_3vw,100%_0,100%_100%,0_100%)]',
                  label: 'Slanted Slope (-3vw)',
                },
                {
                  value: '[clip-path:polygon(0_0,100%_3vw,100%_100%,0_100%)]',
                  label: 'Inverse Slope (+3vw)',
                },
                {
                  value:
                    'shadow-[0_-12px_32px_-8px_rgba(245,158,11,0.3)] border-t border-amber-500/50',
                  label: 'Top Radiant Gold Glow',
                },
              ]}
            />
            <StudioSelect
              id={sectionBottomDividerSelectId}
              label="Bottom Shape Divider (Pro)"
              size="xs"
              value={styles.section.bottomDivider || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, bottomDivider: val },
                })
              }
              options={[
                { value: '', label: 'None (Flush Bottom)' },
                { value: 'border-b border-border/80', label: 'Hairline Border Bottom' },
                { value: 'border-b-2 border-accent-gold', label: 'Gold Accent Bar (2px)' },
                { value: 'border-b-4 border-amber-500', label: 'Bold Gold Banner (4px)' },
                { value: 'border-b-4 border-blue-900', label: 'Navy Accent Footer (4px)' },
                {
                  value: 'rounded-b-[2.5rem] border-b-2 border-border',
                  label: 'Pill Arch Footer',
                },
                {
                  value: 'rounded-b-[4rem] border-b-2 border-border',
                  label: 'Deep Arch Cradle',
                },
                {
                  value: '[clip-path:polygon(0_0,100%_0,100%_calc(100%-3vw),0_100%)]',
                  label: 'Slanted Slant (3vw)',
                },
                {
                  value: '[clip-path:polygon(0_0,100%_0,100%_100%,0_calc(100%-3vw))]',
                  label: 'Inverse Slant (-3vw)',
                },
                {
                  value:
                    'shadow-[0_12px_32px_-8px_rgba(245,158,11,0.3)] border-b border-amber-500/50',
                  label: 'Bottom Radiant Gold Glow',
                },
              ]}
            />
          </div>

          <StudioSelect
            id={sectionDividerColorSelectId}
            label="Divider Accent Color (Pro)"
            size="xs"
            value={styles.section.dividerColor || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                section: { ...styles.section, dividerColor: val },
              })
            }
            options={[
              { value: '', label: 'Default Border Frame' },
              { value: 'text-amber-500/40', label: 'Civic Gold Accent' },
              { value: 'text-blue-900/50', label: 'Patriotic Navy Depth' },
              { value: 'text-white/20', label: 'Frost Glass Accent' },
              { value: 'text-emerald-500/40', label: 'Grassroots Emerald' },
              { value: 'text-rose-500/40', label: 'Alert Crimson' },
            ]}
          />
        </StudioSection>
      )}

      {/* ── 7. Overflow & Stacking Z-Index ──────────────────────────────── */}
      {showClipping && (
        <StudioSection
          title="Clipping & Stacking Elevation"
          badge="Z-Index"
          description="Boundary clipping and layer stacking order."
        >
          <div className="grid grid-cols-2 gap-2">
            <StudioSelect
              id={sectionOverflowSelectId}
              label="Section Overflow & Shape Boundary Clipping"
              value={styles.section.overflow || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, overflow: val },
                })
              }
              options={[
                { value: '', label: 'Visible (Default)' },
                { value: 'overflow-hidden', label: 'Hidden (Clip Bleeds)' },
                { value: 'overflow-clip', label: 'Clip (Strict Boundary)' },
                { value: 'overflow-x-hidden', label: 'Horizontal Hidden Only' },
                { value: 'overflow-y-auto', label: 'Vertical Scrollable (Auto)' },
              ]}
            />
            <StudioSelect
              id={sectionZIndexSelectId}
              label="Stacking Z-Index"
              value={styles.section.zIndex || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  section: { ...styles.section, zIndex: val },
                })
              }
              options={[
                { value: '', label: 'Auto (Default 0)' },
                { value: 'relative z-10', label: 'Low Float (z-10)' },
                { value: 'relative z-20', label: 'Mid Floating (z-20)' },
                { value: 'relative z-30', label: 'High Elevation (z-30)' },
                { value: 'relative z-40', label: 'Modal / Sticky Layer (z-40)' },
                { value: 'relative z-50', label: 'Topmost Foreground (z-50)' },
              ]}
            />
          </div>
        </StudioSection>
      )}
    </>
  );
}
