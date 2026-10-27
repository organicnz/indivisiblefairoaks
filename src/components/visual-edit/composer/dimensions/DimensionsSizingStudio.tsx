'use client';

import { Sparkles } from 'lucide-react';
import type { VisualComposerSizingPreset, VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export const SIZING_PRESETS: readonly VisualComposerSizingPreset[] = [
  {
    id: 'full-width',
    name: 'Full Width',
    description: 'Expands element to full 100% width of parent container',
    apply: () => ({
      width: 'w-full',
      maxWidth: '',
    }),
  },
  {
    id: 'prose-reading',
    name: 'Reading Column',
    description: 'Limits reading line length to 65ch (max-w-prose) for editorial ease',
    apply: () => ({
      width: 'w-full',
      maxWidth: 'max-w-prose',
    }),
  },
  {
    id: 'compact-card',
    name: 'Compact Card',
    description: 'Constrains width to 384px (max-w-sm) for compact sidebar cards',
    apply: () => ({
      width: 'w-full',
      maxWidth: 'max-w-sm',
    }),
  },
  {
    id: 'hero-banner',
    name: 'Hero Banner',
    description: 'Sets full width and 400px min-height for hero banners',
    apply: () => ({
      width: 'w-full',
      minHeight: 'min-h-[400px]',
    }),
  },
  {
    id: 'square-media',
    name: 'Square 1:1',
    description: 'Forces equal 1:1 aspect ratio with object cover for avatars/tiles',
    apply: () => ({
      aspectRatio: 'aspect-square',
      objectFit: 'object-cover',
    }),
  },
  {
    id: 'video-widescreen',
    name: 'Video 16:9',
    description: 'Enforces standard 16:9 widescreen aspect ratio with object cover',
    apply: () => ({
      aspectRatio: 'aspect-video',
      objectFit: 'object-cover',
    }),
  },
] as const;

export interface DimensionsSizingStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  layoutDisplaySelectId?: string;
  layoutMaxWidthSelectId?: string;
  layoutWidthSelectId?: string;
  layoutMinWidthSelectId?: string;
  layoutHeightSelectId?: string;
  layoutMinHeightSelectId?: string;
  layoutMaxHeightSelectId?: string;
  layoutAspectRatioSelectId?: string;
  layoutObjectFitSelectId?: string;
}

export function DimensionsSizingStudio({
  styles,
  setStyles,
  layoutDisplaySelectId,
  layoutMaxWidthSelectId,
  layoutWidthSelectId,
  layoutMinWidthSelectId,
  layoutHeightSelectId,
  layoutMinHeightSelectId,
  layoutMaxHeightSelectId,
  layoutAspectRatioSelectId,
  layoutObjectFitSelectId,
}: DimensionsSizingStudioProps) {
  return (
    <StudioSection
      title="Layout, Display & Sizing"
      badge="Dimensions"
      description="Configure element display mode, width boundaries, vertical heights, and media aspect ratios."
    >
      {/* 1-Click Sizing Presets */}
      <div className="space-y-1.5 mb-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          1-Click Sizing Presets
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {SIZING_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setStyles((prev) => ({
                  ...prev,
                  layout: {
                    ...prev.layout,
                    ...preset.apply(),
                  },
                }));
              }}
              title={preset.description}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-left text-[10px] font-medium text-slate-300 hover:border-accent-gold/40 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              <Sparkles size={10} className="text-accent-gold shrink-0" />
              <span className="truncate">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Live Sizing Visualizer */}
      <div className="p-2.5 rounded-xl border border-white/10 bg-slate-900/60 space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={11} className="text-accent-gold" />
            <span>Sizing &amp; Boundaries Preview</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {styles.layout.width || 'w-auto'} · {styles.layout.maxWidth || 'max-w-none'} ·{' '}
            {styles.layout.height || 'h-auto'}
          </span>
        </div>
        <div
          data-testid="sizing-live-preview"
          className="h-16 w-full rounded-lg border border-white/10 bg-slate-950/80 p-2 flex items-center justify-center overflow-hidden"
        >
          <div
            className={`flex h-10 items-center justify-center rounded bg-accent-gold/20 border border-accent-gold/40 px-3 text-[10px] font-bold text-accent-gold transition-all ${
              styles.layout.width || 'w-auto'
            } ${styles.layout.maxWidth || ''} ${styles.layout.aspectRatio || ''}`}
          >
            <span className="truncate">
              {styles.layout.display || 'block'} ({styles.layout.width || 'auto'} /{' '}
              {styles.layout.maxWidth || 'full'})
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <StudioSelect
          id={layoutDisplaySelectId}
          label="Display Mode"
          value={styles.layout.display}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, display: val },
            })
          }
          options={[
            { value: '', label: 'Default (Normal Flow)' },
            { value: 'block', label: 'Block' },
            { value: 'inline-block', label: 'Inline Block' },
            { value: 'flex', label: 'Flex Container' },
            { value: 'inline-flex', label: 'Inline Flex' },
            { value: 'grid', label: 'Grid Container' },
          ]}
        />
        <StudioSelect
          id={layoutMaxWidthSelectId}
          label="Max Width Container"
          value={styles.layout.maxWidth}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, maxWidth: val },
            })
          }
          options={[
            { value: '', label: 'Full Width (Auto)' },
            { value: 'max-w-prose', label: 'Prose Reading (65ch)' },
            { value: 'max-w-sm', label: 'Small (384px)' },
            { value: 'max-w-md', label: 'Medium (448px)' },
            { value: 'max-w-lg', label: 'Large (512px)' },
            { value: 'max-w-xl', label: 'Extra Large (576px)' },
            { value: 'max-w-2xl', label: '2X Large (672px)' },
            { value: 'max-w-4xl', label: '4X Large (896px)' },
          ]}
        />
      </div>

      {/* Width & Min-Width Grid */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <StudioSelect
          id={layoutWidthSelectId}
          label="Element Width"
          value={styles.layout.width || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, width: val },
            })
          }
          options={[
            { value: '', label: 'Auto (Default)' },
            { value: 'w-full', label: 'Full Width (100%)' },
            { value: 'w-1/2', label: 'Half Width (50%)' },
            { value: 'w-1/3', label: 'One Third (33%)' },
            { value: 'w-2/3', label: 'Two Thirds (66%)' },
            { value: 'w-3/4', label: 'Three Fourths (75%)' },
            { value: 'w-1/4', label: 'One Fourth (25%)' },
            { value: 'w-fit', label: 'Fit Content (w-fit)' },
            { value: 'w-max', label: 'Max Content (w-max)' },
          ]}
        />
        <StudioSelect
          id={layoutMinWidthSelectId}
          label="Min Width"
          value={styles.layout.minWidth || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, minWidth: val },
            })
          }
          options={[
            { value: '', label: 'None (0)' },
            { value: 'min-w-0', label: 'Allow Shrink (min-w-0)' },
            { value: 'min-w-full', label: 'Full Canvas (100%)' },
            { value: 'min-w-[200px]', label: '200px Minimum' },
            { value: 'min-w-[300px]', label: '300px Minimum' },
            { value: 'min-w-min', label: 'Min Content' },
            { value: 'min-w-max', label: 'Max Content' },
          ]}
        />
      </div>

      {/* Height, Min-Height & Max-Height Grid */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <StudioSelect
          id={layoutHeightSelectId}
          label="Height"
          value={styles.layout.height || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, height: val },
            })
          }
          options={[
            { value: '', label: 'Auto (Content)' },
            { value: 'h-full', label: 'Full Height (100%)' },
            { value: 'h-24', label: '96px (h-24)' },
            { value: 'h-32', label: '128px (h-32)' },
            { value: 'h-48', label: '192px (h-48)' },
            { value: 'h-64', label: '256px (h-64)' },
            { value: 'h-96', label: '384px (h-96)' },
            { value: 'h-screen', label: 'Screen (100vh)' },
          ]}
        />
        <StudioSelect
          id={layoutMinHeightSelectId}
          label="Min Height"
          value={styles.layout.minHeight || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, minHeight: val },
            })
          }
          options={[
            { value: '', label: 'None (0)' },
            { value: 'min-h-[100px]', label: '100px' },
            { value: 'min-h-[200px]', label: '200px' },
            { value: 'min-h-[300px]', label: '300px' },
            { value: 'min-h-full', label: 'Full (100%)' },
            { value: 'min-h-screen', label: 'Screen (100vh)' },
          ]}
        />
        <StudioSelect
          id={layoutMaxHeightSelectId}
          label="Max Height"
          value={styles.layout.maxHeight || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, maxHeight: val },
            })
          }
          options={[
            { value: '', label: 'None (Unlimited)' },
            { value: 'max-h-full', label: 'Full (100%)' },
            { value: 'max-h-96', label: '384px (max-h-96)' },
            { value: 'max-h-[500px]', label: '500px' },
            { value: 'max-h-screen', label: 'Screen (100vh)' },
          ]}
        />
      </div>

      {/* Media Aspect Ratio & Object Fit */}
      <div className="grid grid-cols-2 gap-1.5">
        <StudioSelect
          id={layoutAspectRatioSelectId}
          label="Aspect Ratio"
          value={styles.layout.aspectRatio || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, aspectRatio: val },
            })
          }
          options={[
            { value: '', label: 'Natural Ratio (Auto)' },
            { value: 'aspect-square', label: 'Square 1:1 (aspect-square)' },
            { value: 'aspect-video', label: 'Widescreen 16:9 (aspect-video)' },
            { value: 'aspect-[4/3]', label: 'Standard Photo 4:3' },
            { value: 'aspect-[3/2]', label: 'Classic 3:2' },
            { value: 'aspect-[21/9]', label: 'Cinematic Ultra-Wide 21:9' },
          ]}
        />
        <StudioSelect
          id={layoutObjectFitSelectId}
          label="Media Object Fit"
          value={styles.layout.objectFit || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, objectFit: val },
            })
          }
          options={[
            { value: '', label: 'Default Fit' },
            { value: 'object-cover', label: 'Cover (Fill Boundary)' },
            { value: 'object-contain', label: 'Contain (Keep Proportions)' },
            { value: 'object-fill', label: 'Fill (Stretch)' },
            { value: 'object-scale-down', label: 'Scale Down' },
          ]}
        />
      </div>
    </StudioSection>
  );
}
