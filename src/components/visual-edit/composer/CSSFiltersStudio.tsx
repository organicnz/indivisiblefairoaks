'use client';

import type { VisualComposerFilterPreset, VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from './ui';

export const CSS_FILTER_PRESETS: readonly VisualComposerFilterPreset[] = [
  {
    id: 'clear-glass',
    name: 'Clear Glass',
    description: 'Medium backdrop blur with luminous highlight',
    effects: {
      backdropBlur: 'backdrop-blur-md',
      opacity: '',
      grayscale: '',
      brightness: 'brightness-110',
      contrast: '',
      saturate: '',
      hueRotate: '',
      sepia: '',
      blur: '',
      blendMode: '',
      hoverBrightness: 'hover:brightness-105 transition-all',
      hoverOpacity: '',
      invert: '',
      dropShadow: 'drop-shadow-sm',
    },
  },
  {
    id: 'deep-frosted',
    name: 'Deep Frosted',
    description: 'Heavy blur, subtle opacity, vivid saturation and deep drop shadow',
    effects: {
      backdropBlur: 'backdrop-blur-xl',
      opacity: 'opacity-90',
      grayscale: '',
      brightness: 'brightness-125',
      contrast: 'contrast-125',
      saturate: 'saturate-150',
      hueRotate: '',
      sepia: '',
      blur: '',
      blendMode: '',
      hoverBrightness: 'hover:brightness-110 transition-all',
      hoverOpacity: '',
      invert: '',
      dropShadow: 'drop-shadow-xl',
    },
  },
  {
    id: 'dramatic-bw',
    name: 'Dramatic B&W',
    description: 'High dynamic monochrome with deep shadows',
    effects: {
      backdropBlur: '',
      opacity: '',
      grayscale: 'grayscale',
      brightness: 'brightness-90',
      contrast: 'contrast-150',
      saturate: '',
      hueRotate: '',
      sepia: '',
      blur: '',
      blendMode: '',
      hoverBrightness: '',
      hoverOpacity: '',
      invert: '',
      dropShadow: 'drop-shadow-md',
    },
  },
  {
    id: 'warm-sepia',
    name: 'Warm Sepia',
    description: 'Vintage historical tone with punchy contrast',
    effects: {
      backdropBlur: '',
      opacity: '',
      grayscale: '',
      brightness: 'brightness-90',
      contrast: 'contrast-125',
      saturate: '',
      hueRotate: '',
      sepia: 'sepia',
      blur: '',
      blendMode: '',
      hoverBrightness: '',
      hoverOpacity: '',
      invert: '',
      dropShadow: '',
    },
  },
  {
    id: 'vivid-neon',
    name: 'Vivid Neon',
    description: 'Super-saturated colors with golden amber hue rotation and radiant pop',
    effects: {
      backdropBlur: '',
      opacity: '',
      grayscale: '',
      brightness: 'brightness-110',
      contrast: 'contrast-125',
      saturate: 'saturate-200',
      hueRotate: 'hue-rotate-30',
      sepia: '',
      blur: '',
      blendMode: '',
      hoverBrightness: 'hover:brightness-125 transition-all',
      hoverOpacity: '',
      invert: '',
      dropShadow: 'drop-shadow-lg',
    },
  },
  {
    id: 'soft-focus',
    name: 'Soft Focus',
    description: 'Gentle dreamy bokeh with luminous highlight',
    effects: {
      backdropBlur: '',
      opacity: '',
      grayscale: '',
      brightness: 'brightness-105',
      contrast: '',
      saturate: '',
      hueRotate: '',
      sepia: '',
      blur: 'blur-xs',
      blendMode: '',
      hoverBrightness: '',
      hoverOpacity: '',
      invert: '',
      dropShadow: '',
    },
  },
] as const;

export interface CSSFiltersStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  effectBackdropBlurSelectId?: string;
  effectOpacitySelectId?: string;
  effectGrayscaleSelectId?: string;
  effectBrightnessSelectId?: string;
  effectContrastSelectId?: string;
  effectSaturateSelectId?: string;
  effectHueRotateSelectId?: string;
  effectSepiaSelectId?: string;
  effectBlurSelectId?: string;
  effectBlendModeSelectId?: string;
  effectHoverBrightnessSelectId?: string;
  effectHoverOpacitySelectId?: string;
  effectInvertSelectId?: string;
  effectDropShadowSelectId?: string;
}

export function CSSFiltersStudio({
  styles,
  setStyles,
  effectBackdropBlurSelectId,
  effectOpacitySelectId,
  effectGrayscaleSelectId,
  effectBrightnessSelectId,
  effectContrastSelectId,
  effectSaturateSelectId,
  effectHueRotateSelectId,
  effectSepiaSelectId,
  effectBlurSelectId,
  effectBlendModeSelectId,
  effectHoverBrightnessSelectId,
  effectHoverOpacitySelectId,
  effectInvertSelectId,
  effectDropShadowSelectId,
}: CSSFiltersStudioProps) {
  return (
    <StudioSection
      title="Glassmorphism & Visual Effects"
      badge="FX Studio"
      description="Stack optical filters, backdrop blur, brightness shifts, and blend modes."
    >
      {/* 1-Click Optical & Filter Presets */}
      <div className="p-2.5 rounded-xl border border-white/10 bg-white/5 space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-300 font-bold block">
            1-Click Optical &amp; Filter Presets (Pro)
          </span>
          <button
            type="button"
            onClick={() =>
              setStyles({
                ...styles,
                effects: {
                  backdropBlur: '',
                  opacity: '',
                  grayscale: '',
                  brightness: '',
                  contrast: '',
                  saturate: '',
                  hueRotate: '',
                  sepia: '',
                  blur: '',
                  blendMode: '',
                  hoverBrightness: '',
                  hoverOpacity: '',
                  invert: '',
                  dropShadow: '',
                },
              })
            }
            className="text-[10px] text-slate-400 hover:text-white transition-colors underline"
          >
            Clear FX
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {CSS_FILTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                setStyles({
                  ...styles,
                  effects: {
                    ...styles.effects,
                    ...preset.effects,
                  },
                })
              }
              title={preset.description}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Live Optics Preview Card */}
      <div className="relative overflow-hidden p-3 rounded-xl border border-white/10 bg-slate-900 mb-3">
        <div className="flex items-center justify-between">
          <div
            className={`p-2 rounded-lg border border-white/20 bg-white/10 transition-all duration-300 text-xs text-white ${
              styles.effects.backdropBlur || ''
            } ${styles.effects.opacity || ''} ${styles.effects.grayscale || ''} ${
              styles.effects.brightness || ''
            } ${styles.effects.contrast || ''} ${styles.effects.saturate || ''} ${
              styles.effects.hueRotate || ''
            } ${styles.effects.sepia || ''} ${styles.effects.blur || ''} ${
              styles.effects.dropShadow || ''
            } ${styles.effects.blendMode || ''}`}
          >
            <span className="font-semibold block text-[11px]">Optical Filter Preview</span>
            <span className="text-[10px] text-slate-300">Live Glassmorphism &amp; FX Stacking</span>
          </div>
          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-accent-gold/20 text-accent-gold border border-accent-gold/30">
            Live FX
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <StudioSelect
          id={effectBackdropBlurSelectId}
          label="Backdrop Blur"
          value={styles.effects.backdropBlur}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, backdropBlur: val },
            })
          }
          options={[
            { value: '', label: 'None' },
            { value: 'backdrop-blur-sm', label: 'Subtle (sm)' },
            { value: 'backdrop-blur-md', label: 'Medium (md)' },
            { value: 'backdrop-blur-lg', label: 'Deep (lg)' },
            { value: 'backdrop-blur-xl', label: 'Ultra Glass (xl)' },
          ]}
        />
        <StudioSelect
          id={effectOpacitySelectId}
          label="Opacity"
          value={styles.effects.opacity}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, opacity: val },
            })
          }
          options={[
            { value: '', label: '100% Solid' },
            { value: 'opacity-90', label: '90%' },
            { value: 'opacity-80', label: '80%' },
            { value: 'opacity-70', label: '70%' },
            { value: 'opacity-50', label: '50% Dimmed' },
          ]}
        />
        <StudioSelect
          id={effectGrayscaleSelectId}
          label="Grayscale Filter"
          value={styles.effects.grayscale}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, grayscale: val },
            })
          }
          options={[
            { value: '', label: 'Full Color' },
            { value: 'grayscale', label: 'Full Grayscale' },
            {
              value: 'grayscale hover:grayscale-0 transition-all duration-300',
              label: 'Hover Reveal Color',
            },
          ]}
        />
      </div>

      {/* CSS Filters & Color Grading */}
      <div className="grid grid-cols-2 gap-1.5 mt-2">
        <StudioSelect
          id={effectBrightnessSelectId}
          label="Brightness"
          value={styles.effects.brightness || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, brightness: val },
            })
          }
          options={[
            { value: '', label: 'Normal (100%)' },
            { value: 'brightness-50', label: 'Dim (50%)' },
            { value: 'brightness-75', label: 'Subtle Dim (75%)' },
            { value: 'brightness-90', label: 'Moody (90%)' },
            { value: 'brightness-110', label: 'Highlight (+10%)' },
            { value: 'brightness-125', label: 'Luminous (+25%)' },
            { value: 'brightness-150', label: 'Radiant Pop (+50%)' },
          ]}
        />
        <StudioSelect
          id={effectContrastSelectId}
          label="Contrast"
          value={styles.effects.contrast || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, contrast: val },
            })
          }
          options={[
            { value: '', label: 'Normal (100%)' },
            { value: 'contrast-50', label: 'Muted (50%)' },
            { value: 'contrast-75', label: 'Soft Low (75%)' },
            { value: 'contrast-125', label: 'Punchy (+25%)' },
            { value: 'contrast-150', label: 'High Dynamic (+50%)' },
            { value: 'contrast-200', label: 'Dramatic Black & White (+100%)' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
        <StudioSelect
          id={effectSaturateSelectId}
          label="Saturation"
          value={styles.effects.saturate || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, saturate: val },
            })
          }
          options={[
            { value: '', label: '100% Normal' },
            { value: 'saturate-50', label: '50% Desaturated' },
            { value: 'saturate-150', label: '150% Vibrant Rich' },
            { value: 'saturate-200', label: '200% Super Saturated' },
          ]}
        />
        <StudioSelect
          id={effectHueRotateSelectId}
          label="Hue Shift (Color Shift)"
          value={styles.effects.hueRotate || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, hueRotate: val },
            })
          }
          options={[
            { value: '', label: '0° Normal' },
            { value: 'hue-rotate-15', label: '15° Warm Shift' },
            { value: 'hue-rotate-30', label: '30° Golden Amber' },
            { value: 'hue-rotate-60', label: '60° Emerald Green' },
            { value: 'hue-rotate-90', label: '90° Cyan Accent' },
            { value: 'hue-rotate-180', label: '180° Inverted Spectrum' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
        <StudioSelect
          id={effectSepiaSelectId}
          label="Sepia Vintage"
          value={styles.effects.sepia || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, sepia: val },
            })
          }
          options={[
            { value: '', label: 'None (Modern Color)' },
            { value: 'sepia', label: 'Warm Sepia Tone' },
            {
              value: 'sepia hover:sepia-0 transition-all duration-300',
              label: 'Hover Reveal Modern',
            },
          ]}
        />
        <StudioSelect
          id={effectBlurSelectId}
          label="Element Blur Filter"
          value={styles.effects.blur || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, blur: val },
            })
          }
          options={[
            { value: '', label: 'Sharp (No Blur)' },
            { value: 'blur-xs', label: 'Soft Focus (xs)' },
            { value: 'blur-sm', label: 'Light Blur (sm)' },
            { value: 'blur-md', label: 'Medium Bokeh (md)' },
          ]}
        />
      </div>

      <div className="mt-1.5">
        <StudioSelect
          id={effectBlendModeSelectId}
          label="Mix Blend Mode (Layer Blending)"
          value={styles.effects.blendMode || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, blendMode: val },
            })
          }
          options={[
            { value: '', label: 'Normal (Default)' },
            { value: 'mix-blend-multiply', label: 'Multiply (Darken / Shadow)' },
            { value: 'mix-blend-screen', label: 'Screen (Lighten / Glow)' },
            { value: 'mix-blend-overlay', label: 'Overlay (High Contrast)' },
            { value: 'mix-blend-darken', label: 'Darken' },
            { value: 'mix-blend-lighten', label: 'Lighten' },
            { value: 'mix-blend-color-dodge', label: 'Color Dodge (Intense Glow)' },
            { value: 'mix-blend-color-burn', label: 'Color Burn (Deep Shadow)' },
            { value: 'mix-blend-hard-light', label: 'Hard Light' },
            { value: 'mix-blend-soft-light', label: 'Soft Light' },
            { value: 'mix-blend-difference', label: 'Difference (Inversion Effect)' },
            { value: 'mix-blend-exclusion', label: 'Exclusion' },
            { value: 'mix-blend-luminosity', label: 'Luminosity (Luma Blend)' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
        <StudioSelect
          id={effectHoverBrightnessSelectId}
          label="Hover Brightness Shift"
          value={styles.effects.hoverBrightness || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, hoverBrightness: val },
            })
          }
          options={[
            { value: '', label: 'No Brightness Shift' },
            { value: 'hover:brightness-105 transition-all', label: 'Subtle Light (+5%)' },
            { value: 'hover:brightness-110 transition-all', label: 'Luminous (+10%)' },
            { value: 'hover:brightness-125 transition-all', label: 'High Radiance (+25%)' },
            { value: 'hover:brightness-90 transition-all', label: 'Darken Depth (-10%)' },
            { value: 'hover:brightness-75 transition-all', label: 'Moody Shadow (-25%)' },
          ]}
        />
        <StudioSelect
          id={effectHoverOpacitySelectId}
          label="Hover Opacity Shift"
          value={styles.effects.hoverOpacity || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, hoverOpacity: val },
            })
          }
          options={[
            { value: '', label: 'No Opacity Shift' },
            { value: 'hover:opacity-100 transition-opacity', label: 'Force Opaque (100%)' },
            { value: 'hover:opacity-90 transition-opacity', label: 'Gentle Fade (90%)' },
            { value: 'hover:opacity-80 transition-opacity', label: 'Medium Translucent (80%)' },
            { value: 'hover:opacity-60 transition-opacity', label: 'Ghost Subtle (60%)' },
          ]}
        />
      </div>

      {/* CSS Invert & Drop Shadow */}
      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
        <StudioSelect
          id={effectInvertSelectId}
          label="CSS Invert Filter"
          value={styles.effects.invert || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, invert: val },
            })
          }
          options={[
            { value: '', label: 'Normal (0% Invert)' },
            { value: 'invert', label: 'Full Invert (100%)' },
          ]}
        />
        <StudioSelect
          id={effectDropShadowSelectId}
          label="CSS Drop Shadow (Alpha)"
          value={styles.effects.dropShadow || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              effects: { ...styles.effects, dropShadow: val },
            })
          }
          options={[
            { value: '', label: 'None (No Drop Shadow)' },
            { value: 'drop-shadow-sm', label: 'Subtle Soft (sm)' },
            { value: 'drop-shadow-md', label: 'Medium Silhouette (md)' },
            { value: 'drop-shadow-lg', label: 'Elevated Alpha (lg)' },
            { value: 'drop-shadow-xl', label: 'High Silhouette (xl)' },
            { value: 'drop-shadow-2xl', label: 'Maximum Depth (2xl)' },
          ]}
        />
      </div>
    </StudioSection>
  );
}
