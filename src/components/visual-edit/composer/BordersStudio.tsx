'use client';

import { Link2, Unlink2 } from 'lucide-react';
import type { VisualComposerBorderPreset, VisualComposerStyles } from '@/types/unified';
import { type ColorSwatch, ColorSwatchPicker, StudioSection, StudioSelect } from './ui';

export interface BordersStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  radiusSelectId?: string;
  borderWidthSelectId?: string;
  borderStyleSelectId?: string;
  borderSideSelectId?: string;
  radiusTopLeftSelectId?: string;
  radiusTopRightSelectId?: string;
  radiusBottomRightSelectId?: string;
  radiusBottomLeftSelectId?: string;
}

export const BORDER_COLOR_SWATCHES: readonly ColorSwatch[] = [
  { label: 'Default', value: 'border-border', bgClass: 'bg-white/20' },
  { label: 'Civic Gold', value: 'border-amber-500/50', bgClass: 'bg-amber-500' },
  { label: 'Patriotic Navy', value: 'border-blue-900/50', bgClass: 'bg-blue-900' },
  { label: 'Frost Glass', value: 'border-white/30', bgClass: 'bg-white/40' },
  { label: 'Crimson', value: 'border-rose-500/50', bgClass: 'bg-rose-500' },
  { label: 'Forest Green', value: 'border-emerald-500/50', bgClass: 'bg-emerald-500' },
] as const;

export const BORDER_GEOMETRY_PRESETS: readonly VisualComposerBorderPreset[] = [
  {
    id: 'modern-card',
    name: 'Modern Card',
    description: 'Clean 16px radius with thin 1px frame',
    border: {
      radius: 'rounded-2xl',
      width: 'border',
      style: 'solid',
      side: 'all',
      radiusLinked: true,
      color: 'border-white/20',
    },
  },
  {
    id: 'squircle-pill',
    name: 'Squircle Capsule',
    description: 'Full capsule rounding with medium border',
    border: {
      radius: 'rounded-full',
      width: 'border-2',
      style: 'solid',
      side: 'all',
      radiusLinked: true,
    },
  },
  {
    id: 'civic-callout',
    name: 'Civic Accent Bar',
    description: 'Thick 4px gold left accent bar with rounded right corners',
    border: {
      radius: 'rounded-r-xl',
      width: 'border-4',
      style: 'solid',
      side: 'left',
      color: 'border-amber-500/50',
      radiusLinked: true,
    },
  },
  {
    id: 'diagonal-shield',
    name: 'Diagonal Shield',
    description: 'Organic leaf shape with unlinked top-left and bottom-right pill corners',
    border: {
      radius: '',
      radiusLinked: false,
      radiusTopLeft: 'rounded-tl-3xl',
      radiusTopRight: 'rounded-tr-none',
      radiusBottomRight: 'rounded-br-3xl',
      radiusBottomLeft: 'rounded-bl-none',
      width: 'border',
      style: 'solid',
      side: 'all',
      color: 'border-amber-500/50',
    },
  },
  {
    id: 'sharp-flush',
    name: 'Sharp Flush',
    description: 'Architectural sharp edges with heavy 2px frame',
    border: {
      radius: 'rounded-none',
      width: 'border-2',
      style: 'solid',
      side: 'all',
      radiusLinked: true,
    },
  },
] as const;

export function BordersStudio({
  styles,
  setStyles,
  radiusSelectId,
  borderWidthSelectId,
  borderStyleSelectId,
  borderSideSelectId,
  radiusTopLeftSelectId,
  radiusTopRightSelectId,
  radiusBottomRightSelectId,
  radiusBottomLeftSelectId,
}: BordersStudioProps) {
  return (
    <StudioSection
      title="Border & Corner Radius"
      badge="Geometry"
      action={
        <button
          type="button"
          data-testid="corner-radius-link-toggle"
          onClick={() =>
            setStyles({
              ...styles,
              border: {
                ...styles.border,
                radiusLinked: styles.border.radiusLinked === false,
              },
            })
          }
          title={
            styles.border.radiusLinked === false
              ? 'Link corners together'
              : 'Unlink individual 4 corners'
          }
          className="text-[9px] text-accent-gold flex items-center gap-1 hover:underline cursor-pointer"
        >
          {styles.border.radiusLinked === false ? <Unlink2 size={10} /> : <Link2 size={10} />}
          <span>{styles.border.radiusLinked === false ? 'Unlinked' : 'Linked'}</span>
        </button>
      }
    >
      {/* 1-Click Border & Corner Geometry Presets */}
      <div className="p-2.5 rounded-xl border border-white/10 bg-white/5 space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-300 font-bold block">
            1-Click Border &amp; Corner Presets (Pro)
          </span>
          <button
            type="button"
            onClick={() =>
              setStyles({
                ...styles,
                border: {
                  radius: 'rounded-none',
                  width: 'border-0',
                  style: 'none',
                  side: 'all',
                  color: 'border-border',
                  radiusLinked: true,
                  radiusTopLeft: '',
                  radiusTopRight: '',
                  radiusBottomRight: '',
                  radiusBottomLeft: '',
                },
              })
            }
            className="text-[10px] text-slate-400 hover:text-white transition-colors underline"
          >
            Clear Border
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {BORDER_GEOMETRY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                setStyles({
                  ...styles,
                  border: {
                    ...styles.border,
                    ...preset.border,
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

      {/* Interactive Live Border Preview */}
      <div className="relative overflow-hidden p-3 rounded-xl border border-white/10 bg-slate-900 mb-3 flex items-center justify-between min-h-[56px]">
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1.5 bg-white/10 text-white font-medium text-xs transition-all duration-200 ${
              styles.border.radiusLinked === false
                ? `${styles.border.radiusTopLeft || 'rounded-tl-none'} ${styles.border.radiusTopRight || 'rounded-tr-none'} ${styles.border.radiusBottomRight || 'rounded-br-none'} ${styles.border.radiusBottomLeft || 'rounded-bl-none'}`
                : styles.border.radius || 'rounded-none'
            } ${styles.border.width || 'border'} ${styles.border.color || 'border-border'}`}
          >
            Frame Geometry
          </div>
          <span className="text-[10px] text-slate-300">Live Corner &amp; Side Stroke</span>
        </div>
        <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-accent-gold/20 text-accent-gold border border-accent-gold/30">
          Geometry
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StudioSelect
          id={radiusSelectId}
          label="Corner Radius"
          value={styles.border.radius}
          onChange={(val) =>
            setStyles({
              ...styles,
              border: { ...styles.border, radius: val },
            })
          }
          options={[
            { value: 'rounded-none', label: 'Square (0)' },
            { value: 'rounded-md', label: 'Subtle (6px)' },
            { value: 'rounded-xl', label: 'Standard (12px)' },
            { value: 'rounded-2xl', label: 'Modern Card (16px)' },
            { value: 'rounded-3xl', label: 'Pill Smooth (24px)' },
            { value: 'rounded-full', label: 'Full Capsule' },
            { value: 'rounded-t-2xl', label: 'Top Rounded' },
            { value: 'rounded-b-2xl', label: 'Bottom Rounded' },
          ]}
        />
        <StudioSelect
          id={borderWidthSelectId}
          label="Border Width"
          value={styles.border.width}
          onChange={(val) =>
            setStyles({
              ...styles,
              border: { ...styles.border, width: val },
            })
          }
          options={[
            { value: 'border-0', label: 'No Border' },
            { value: 'border', label: 'Thin (1px)' },
            { value: 'border-2', label: 'Medium (2px)' },
            { value: 'border-4', label: 'Heavy (4px)' },
            { value: 'border-8', label: 'Thick Accent (8px)' },
          ]}
        />
        <StudioSelect
          id={borderStyleSelectId}
          label="Border Style"
          value={styles.border.style}
          onChange={(val) =>
            setStyles({
              ...styles,
              border: {
                ...styles.border,
                style: val as typeof styles.border.style,
              },
            })
          }
          options={[
            { value: 'solid', label: 'Solid Line' },
            { value: 'dashed', label: 'Dashed Line' },
            { value: 'dotted', label: 'Dotted Line' },
            { value: 'double', label: 'Double Line' },
            { value: 'none', label: 'None' },
          ]}
        />
        <StudioSelect
          id={borderSideSelectId}
          label="Border Sides"
          value={styles.border.side}
          onChange={(val) =>
            setStyles({
              ...styles,
              border: {
                ...styles.border,
                side: val as typeof styles.border.side,
              },
            })
          }
          options={[
            { value: 'all', label: 'All 4 Sides' },
            { value: 'left', label: 'Left Accent Bar' },
            { value: 'top', label: 'Top Accent Bar' },
            { value: 'bottom', label: 'Bottom Accent Bar' },
            { value: 'right', label: 'Right Accent Bar' },
            { value: 'y', label: 'Top & Bottom' },
          ]}
        />
      </div>

      {/* 4-Corner Independent Unlinked Radius */}
      {styles.border.radiusLinked === false && (
        <div className="mt-2 p-2.5 rounded-xl border border-white/10 bg-white/5 space-y-1.5">
          <span className="text-[10px] text-slate-300 font-bold block">
            4-Corner Radius Controls (Pro)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <StudioSelect
              id={radiusTopLeftSelectId}
              label="Top-Left"
              value={styles.border.radiusTopLeft || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  border: { ...styles.border, radiusTopLeft: val },
                })
              }
              options={[
                { value: '', label: 'Default (0)' },
                { value: 'rounded-tl-none', label: 'Square (0)' },
                { value: 'rounded-tl-md', label: 'Subtle (6px)' },
                { value: 'rounded-tl-xl', label: 'Medium (12px)' },
                { value: 'rounded-tl-2xl', label: 'Modern (16px)' },
                { value: 'rounded-tl-3xl', label: 'Pill (24px)' },
                { value: 'rounded-tl-full', label: 'Full' },
              ]}
              size="xs"
            />
            <StudioSelect
              id={radiusTopRightSelectId}
              label="Top-Right"
              value={styles.border.radiusTopRight || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  border: { ...styles.border, radiusTopRight: val },
                })
              }
              options={[
                { value: '', label: 'Default (0)' },
                { value: 'rounded-tr-none', label: 'Square (0)' },
                { value: 'rounded-tr-md', label: 'Subtle (6px)' },
                { value: 'rounded-tr-xl', label: 'Medium (12px)' },
                { value: 'rounded-tr-2xl', label: 'Modern (16px)' },
                { value: 'rounded-tr-3xl', label: 'Pill (24px)' },
                { value: 'rounded-tr-full', label: 'Full' },
              ]}
              size="xs"
            />
            <StudioSelect
              id={radiusBottomRightSelectId}
              label="Bottom-Right"
              value={styles.border.radiusBottomRight || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  border: { ...styles.border, radiusBottomRight: val },
                })
              }
              options={[
                { value: '', label: 'Default (0)' },
                { value: 'rounded-br-none', label: 'Square (0)' },
                { value: 'rounded-br-md', label: 'Subtle (6px)' },
                { value: 'rounded-br-xl', label: 'Medium (12px)' },
                { value: 'rounded-br-2xl', label: 'Modern (16px)' },
                { value: 'rounded-br-3xl', label: 'Pill (24px)' },
                { value: 'rounded-br-full', label: 'Full' },
              ]}
              size="xs"
            />
            <StudioSelect
              id={radiusBottomLeftSelectId}
              label="Bottom-Left"
              value={styles.border.radiusBottomLeft || ''}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  border: { ...styles.border, radiusBottomLeft: val },
                })
              }
              options={[
                { value: '', label: 'Default (0)' },
                { value: 'rounded-bl-none', label: 'Square (0)' },
                { value: 'rounded-bl-md', label: 'Subtle (6px)' },
                { value: 'rounded-bl-xl', label: 'Medium (12px)' },
                { value: 'rounded-bl-2xl', label: 'Modern (16px)' },
                { value: 'rounded-bl-3xl', label: 'Pill (24px)' },
                { value: 'rounded-bl-full', label: 'Full' },
              ]}
              size="xs"
            />
          </div>
        </div>
      )}

      {/* Border Color Swatches using ColorSwatchPicker */}
      <div className="mt-2.5">
        <ColorSwatchPicker
          label="Border Color Preset"
          value={styles.border.color}
          swatches={BORDER_COLOR_SWATCHES}
          onChange={(val) =>
            setStyles({
              ...styles,
              border: { ...styles.border, color: val },
            })
          }
        />
      </div>
    </StudioSection>
  );
}
