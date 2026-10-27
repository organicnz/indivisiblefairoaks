'use client';

import { Link2, Unlink2 } from 'lucide-react';
import type { VisualComposerStyles } from '@/types/unified';
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
