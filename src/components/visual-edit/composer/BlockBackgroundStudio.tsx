'use client';

import { Sparkles } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';
import {
  ColorSwatchPicker,
  StudioInput,
  StudioSection,
  StudioSelect,
  ThemeModeSelector,
} from './ui';

export interface BlockBackgroundStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  bgThemeSelectId?: string;
  shadowSelectId?: string;
  blockThemeModeSelectId?: string;
  shadowColorSelectId?: string;
  clipPathSelectId?: string;
  bgGradientSelectId?: string;
  bgImageInputId?: string;
  bgOverlaySelectId?: string;
  bgSizeSelectId?: string;
  bgPositionSelectId?: string;
  bgRepeatSelectId?: string;
}

export const BLOCK_GRADIENT_OPTIONS = [
  { value: '', label: 'None (Solid / Preset)' },
  {
    value: 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent',
    label: 'Civic Gold Warmth',
  },
  {
    value: 'bg-gradient-to-br from-blue-950/60 via-slate-900 to-slate-950 text-white',
    label: 'Patriotic Midnight Navy',
  },
  {
    value: 'bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 text-white',
    label: 'Grassroots Forest Green',
  },
  {
    value: 'bg-gradient-to-br from-rose-950/60 via-slate-900 to-slate-950 text-white',
    label: 'Alert Crimson Accent',
  },
  {
    value:
      'bg-gradient-to-br from-white/15 via-white/5 to-white/10 backdrop-blur-md border border-white/20 text-white',
    label: 'Liquid Frost Glass',
  },
] as const;

export const BLOCK_OVERLAY_OPTIONS = [
  { value: '', label: 'None (Clean Media)' },
  { value: 'bg-black/40', label: 'Dark Tint (40%)' },
  { value: 'bg-black/60', label: 'Dark Contrast (60%)' },
  { value: 'bg-black/80', label: 'Deep Blackout (80%)' },
  { value: 'bg-slate-950/70 backdrop-blur-xs', label: 'Midnight Frost Glass' },
  { value: 'bg-amber-500/15', label: 'Civic Gold Wash (15%)' },
  { value: 'bg-blue-950/50', label: 'Patriotic Navy Tint (50%)' },
  { value: 'bg-emerald-950/40', label: 'Grassroots Emerald Wash' },
  { value: 'bg-rose-950/40', label: 'Alert Crimson Wash' },
] as const;

export const BLOCK_BG_SIZE_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'bg-cover', label: 'Cover (Fill Element)' },
  { value: 'bg-contain', label: 'Contain (Fit Proportions)' },
  { value: 'bg-auto', label: 'Original Size (Auto)' },
] as const;

export const BLOCK_BG_POSITION_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'bg-center', label: 'Center Centered' },
  { value: 'bg-top', label: 'Top Aligned' },
  { value: 'bg-bottom', label: 'Bottom Aligned' },
  { value: 'bg-left', label: 'Left Aligned' },
  { value: 'bg-right', label: 'Right Aligned' },
] as const;

export const BLOCK_BG_REPEAT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'bg-no-repeat', label: 'No Repeat (Clean)' },
  { value: 'bg-repeat', label: 'Tile Seamless (Repeat)' },
  { value: 'bg-repeat-x', label: 'Repeat Horizontal (X)' },
  { value: 'bg-repeat-y', label: 'Repeat Vertical (Y)' },
] as const;

export function BlockBackgroundStudio({
  styles,
  setStyles,
  bgThemeSelectId,
  shadowSelectId,
  blockThemeModeSelectId = 'block-theme-mode-select',
  shadowColorSelectId = 'shadow-color-select',
  clipPathSelectId = 'clip-path-select',
  bgGradientSelectId = 'block-bg-gradient-select',
  bgImageInputId = 'block-bg-image-input',
  bgOverlaySelectId = 'block-bg-overlay-select',
  bgSizeSelectId = 'block-bg-size-select',
  bgPositionSelectId = 'block-bg-position-select',
  bgRepeatSelectId = 'block-bg-repeat-select',
}: BlockBackgroundStudioProps) {
  return (
    <>
      {/* ── Background & Elevation Studio ── */}
      <StudioSection
        title="Background & Elevation"
        badge="Surface"
        description="Choose element surface tone, shadow depth, dark/light theme lock, and custom shape masks."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <StudioSelect
            id={bgThemeSelectId}
            label="Background Theme"
            value={styles.background.preset}
            onChange={(val) =>
              setStyles({
                ...styles,
                background: { ...styles.background, preset: val },
              })
            }
            options={[
              { value: 'bg-transparent', label: 'Transparent' },
              { value: 'bg-slate-900/60', label: 'Slate Card (60%)' },
              { value: 'bg-slate-950/90', label: 'Deep Midnight' },
              { value: 'bg-amber-500/10', label: 'Civic Gold Light' },
              { value: 'bg-emerald-500/10', label: 'Community Green' },
              { value: 'bg-rose-500/10', label: 'Alert Crimson' },
              { value: 'bg-white/10', label: 'Glass Surface' },
            ]}
          />
          <ColorSwatchPicker
            label="Quick Surface Tint"
            value={styles.background.preset}
            onChange={(val) =>
              setStyles({
                ...styles,
                background: { ...styles.background, preset: val, gradient: '' },
              })
            }
          />
          <StudioSelect
            id={shadowSelectId}
            label="Elevation Shadow"
            value={styles.shadow}
            onChange={(val) => setStyles({ ...styles, shadow: val })}
            options={[
              { value: 'shadow-none', label: 'Flat (None)' },
              { value: 'shadow-sm', label: 'Subtle Soft' },
              { value: 'shadow-md', label: 'Medium Card' },
              { value: 'shadow-lg', label: 'Elevated Surface' },
              { value: 'shadow-xl', label: 'High Elevation' },
              { value: 'shadow-2xl', label: 'Maximum Depth' },
              { value: 'shadow-inner', label: 'Inset Recessed' },
              { value: 'shadow-lg shadow-amber-500/25', label: 'Civic Gold Glow' },
              { value: 'shadow-lg shadow-sky-500/25', label: 'Cyan Tech Glow' },
              { value: 'shadow-2xl shadow-blue-950/60', label: 'Patriotic Navy Shadow' },
            ]}
          />
          <ThemeModeSelector
            id={blockThemeModeSelectId}
            label="Element Theme Mode"
            value={styles.themeMode || 'inherit'}
            onChange={(val) =>
              setStyles({
                ...styles,
                themeMode: val,
              })
            }
            description="Forces block into dark, light, or system reactive palette."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <StudioSelect
            id={bgGradientSelectId}
            label="Surface Gradient (Pro)"
            value={styles.background.gradient || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                background: { ...styles.background, gradient: val },
              })
            }
            options={BLOCK_GRADIENT_OPTIONS}
          />
          <StudioSelect
            id={shadowColorSelectId}
            label="Shadow Aura Glow (Pro)"
            value={styles.effects.shadowColor || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, shadowColor: val },
              })
            }
            options={[
              { value: '', label: 'Default Shadow Tint' },
              { value: 'shadow-amber-500/20', label: 'Civic Gold Aura (20%)' },
              { value: 'shadow-blue-500/30', label: 'Navy / Sky Aura (30%)' },
              { value: 'shadow-emerald-500/20', label: 'Forest Emerald Glow' },
              { value: 'shadow-rose-500/25', label: 'Crimson Alert Glow' },
              { value: 'shadow-white/10', label: 'Frost White Radiance' },
              { value: 'shadow-black/50', label: 'High-Contrast Deep Black' },
            ]}
          />
          <StudioSelect
            id={clipPathSelectId}
            label="Shape Mask / Clip Path (Pro)"
            value={styles.effects.clipPath || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                effects: { ...styles.effects, clipPath: val },
              })
            }
            options={[
              { value: '', label: 'None (Standard Box)' },
              {
                value: '[clip-path:polygon(0_0,100%_0,100%_85%,0_100%)]',
                label: 'Angled Slant (Bottom Cut)',
              },
              {
                value: '[clip-path:polygon(0_15%,100%_0,100%_100%,0_100%)]',
                label: 'Angled Slant (Top Cut)',
              },
              {
                value: '[clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]',
                label: 'Diamond Badge Mask',
              },
              {
                value: '[clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]',
                label: 'Hexagon Badge Mask',
              },
              { value: '[clip-path:ellipse(50%_50%_at_50%_50%)]', label: 'Smooth Ellipse' },
            ]}
          />
        </div>

        {/* ── Block Background Image & Media Overlay ── */}
        <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 space-y-2.5">
          <span className="text-[10px] text-accent-gold font-bold uppercase tracking-wider block">
            Block Background Image &amp; Overlay (Pro)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <StudioInput
              id={bgImageInputId}
              label="Background Image URL"
              value={styles.background.image || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  background: { ...styles.background, image: val },
                })
              }
              placeholder="https://... or /images/..."
              description="Applies background image with auto-clipping."
            />
            <StudioSelect
              id={bgOverlaySelectId}
              label="Overlay Tint"
              value={styles.background.overlay || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  background: { ...styles.background, overlay: val },
                })
              }
              options={BLOCK_OVERLAY_OPTIONS}
              size="xs"
            />
          </div>

          {Boolean(styles.background.image) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <StudioSelect
                id={bgSizeSelectId}
                label="Image Sizing"
                value={styles.background.size || ''}
                onChange={(val) =>
                  setStyles({
                    ...styles,
                    background: { ...styles.background, size: val },
                  })
                }
                options={BLOCK_BG_SIZE_OPTIONS}
                size="xs"
              />
              <StudioSelect
                id={bgPositionSelectId}
                label="Image Position"
                value={styles.background.position || ''}
                onChange={(val) =>
                  setStyles({
                    ...styles,
                    background: { ...styles.background, position: val },
                  })
                }
                options={BLOCK_BG_POSITION_OPTIONS}
                size="xs"
              />
              <StudioSelect
                id={bgRepeatSelectId}
                label="Pattern Repeat"
                value={styles.background.repeat || ''}
                onChange={(val) =>
                  setStyles({
                    ...styles,
                    background: { ...styles.background, repeat: val },
                  })
                }
                options={BLOCK_BG_REPEAT_OPTIONS}
                size="xs"
              />
            </div>
          )}
        </div>
      </StudioSection>

      {/* ── Decorative Corner Ribbon / Badge ── */}
      <StudioSection
        title="Decorative Badge / Ribbon Accent (Pro)"
        badge="Pro"
        action={<Sparkles size={13} className="text-accent-gold" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <StudioInput
            id="block-badge-text-input"
            label="Badge Label Text"
            value={styles.badgeText || ''}
            onChange={(val) => setStyles({ ...styles, badgeText: val })}
            placeholder="e.g. NEW, FEATURED"
          />
          <StudioSelect
            id="block-badge-tone-select"
            label="Badge Tone"
            value={styles.badgeTone || 'gold'}
            onChange={(val) =>
              setStyles({
                ...styles,
                badgeTone: val as VisualComposerStyles['badgeTone'],
              })
            }
            options={[
              { value: 'gold', label: 'Civic Gold (Default)' },
              { value: 'navy', label: 'Patriotic Navy' },
              { value: 'emerald', label: 'Action Emerald' },
              { value: 'crimson', label: 'Urgent Crimson' },
              { value: 'slate', label: 'Minimal Slate' },
            ]}
          />
          <StudioSelect
            id="block-badge-position-select"
            label="Badge Placement"
            value={styles.badgePosition || 'top-right'}
            onChange={(val) =>
              setStyles({
                ...styles,
                badgePosition: val as VisualComposerStyles['badgePosition'],
              })
            }
            options={[
              { value: 'top-right', label: 'Top-Right Corner' },
              { value: 'top-left', label: 'Top-Left Corner' },
            ]}
          />
        </div>
      </StudioSection>
    </>
  );
}
