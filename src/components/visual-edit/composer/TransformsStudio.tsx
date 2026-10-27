'use client';

import type { VisualComposerStyles, VisualComposerTransformPreset } from '@/types/unified';
import { StudioSection, StudioSelect } from './ui';

export const TRANSFORM_PRESETS: readonly VisualComposerTransformPreset[] = [
  {
    id: 'subtle-lift',
    name: 'Subtle Lift',
    description: 'Elevated pop with -4px Y-translation and 105% scale',
    transform: {
      rotate: '',
      scale: 'scale-105',
      skew: '',
      translateX: '',
      translateY: '-translate-y-1',
      transformOrigin: 'origin-center',
    },
  },
  {
    id: 'dynamic-tilt',
    name: 'Dynamic Tilt',
    description: '2° dynamic tilt angle with subtle slant and -8px lift',
    transform: {
      rotate: 'rotate-2',
      scale: 'scale-105',
      skew: 'skew-x-1',
      translateX: '',
      translateY: '-translate-y-2',
      transformOrigin: 'origin-center',
    },
  },
  {
    id: 'hero-slant',
    name: 'Hero Slant',
    description: 'Civic dynamic diagonal slant with forward X translation',
    transform: {
      rotate: '',
      scale: '',
      skew: 'skew-x-1',
      translateX: 'translate-x-1',
      translateY: '',
      transformOrigin: 'origin-left',
    },
  },
  {
    id: 'accent-stamp',
    name: 'Accent Stamp',
    description: 'Stamp angle of -3° with compact 95% scale',
    transform: {
      rotate: '-rotate-3',
      scale: 'scale-95',
      skew: '',
      translateX: '',
      translateY: '',
      transformOrigin: 'origin-center',
    },
  },
  {
    id: 'floating-hover',
    name: 'Floating Hover',
    description: 'Center hovering lift of -16px with heroic 110% zoom',
    transform: {
      rotate: '',
      scale: 'scale-110',
      skew: '',
      translateX: '',
      translateY: '-translate-y-4',
      transformOrigin: 'origin-center',
    },
  },
] as const;

export interface TransformsStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  transformRotateSelectId?: string;
  transformScaleSelectId?: string;
  transformSkewSelectId?: string;
  transformTranslateXSelectId?: string;
  transformTranslateYSelectId?: string;
  transformOriginSelectId?: string;
}

export function TransformsStudio({
  styles,
  setStyles,
  transformRotateSelectId,
  transformScaleSelectId,
  transformSkewSelectId,
  transformTranslateXSelectId,
  transformTranslateYSelectId,
  transformOriginSelectId,
}: TransformsStudioProps) {
  return (
    <StudioSection
      title="Transforms & 3D Tilt"
      badge="3D Motion"
      description="Apply physical angles, scale spotlighting, slant, and 2D translation offsets."
    >
      {/* 1-Click Transform & 3D Tilt Presets */}
      <div className="p-2.5 rounded-xl border border-white/10 bg-white/5 space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-300 font-bold block">
            1-Click 3D Tilt &amp; Angle Presets (Pro)
          </span>
          <button
            type="button"
            onClick={() =>
              setStyles({
                ...styles,
                transform: {
                  rotate: '',
                  scale: '',
                  skew: '',
                  translateX: '',
                  translateY: '',
                  transformOrigin: '',
                },
              })
            }
            className="text-[10px] text-slate-400 hover:text-white transition-colors underline"
          >
            Reset Flat
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {TRANSFORM_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                setStyles({
                  ...styles,
                  transform: {
                    ...styles.transform,
                    ...preset.transform,
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

      {/* Interactive Live 3D Transform Preview Card */}
      <div className="relative overflow-hidden p-3 rounded-xl border border-white/10 bg-slate-900 mb-3 flex items-center justify-between min-h-[64px]">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg border border-accent-gold/40 bg-accent-gold/10 text-white font-bold text-xs transition-all duration-300 ${
              styles.transform?.rotate || ''
            } ${styles.transform?.scale || ''} ${styles.transform?.skew || ''} ${
              styles.transform?.translateX || ''
            } ${styles.transform?.translateY || ''} ${
              styles.transform?.transformOrigin || 'origin-center'
            }`}
          >
            3D Tilt Preview
          </div>
          <span className="text-[10px] text-slate-300">Physical Angle &amp; Translation</span>
        </div>
        <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-accent-gold/20 text-accent-gold border border-accent-gold/30">
          Live 3D
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <StudioSelect
          id={transformRotateSelectId}
          label="Rotation Angle"
          value={styles.transform?.rotate || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              transform: { ...styles.transform, rotate: val },
            })
          }
          options={[
            { value: '', label: '0° (Flat)' },
            { value: 'rotate-1', label: '1° Subtle Right' },
            { value: '-rotate-1', label: '-1° Subtle Left' },
            { value: 'rotate-2', label: '2° Dynamic Angle' },
            { value: '-rotate-2', label: '-2° Dynamic Angle' },
            { value: 'rotate-3', label: '3° Playful Tilt' },
            { value: '-rotate-3', label: '-3° Playful Tilt' },
            { value: 'rotate-6', label: '6° Accent Stamp' },
            { value: '-rotate-6', label: '-6° Accent Stamp' },
          ]}
        />
        <StudioSelect
          id={transformScaleSelectId}
          label="Scale Size"
          value={styles.transform?.scale || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              transform: { ...styles.transform, scale: val },
            })
          }
          options={[
            { value: '', label: '100% Normal' },
            { value: 'scale-95', label: '95% Compact' },
            { value: 'scale-105', label: '105% Spotlight Pop' },
            { value: 'scale-110', label: '110% Heroic Zoom' },
          ]}
        />
        <StudioSelect
          id={transformSkewSelectId}
          label="Skew Slant"
          value={styles.transform?.skew || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              transform: { ...styles.transform, skew: val },
            })
          }
          options={[
            { value: '', label: 'None (0°)' },
            { value: 'skew-x-1', label: '1° Civic Slant' },
            { value: '-skew-x-1', label: '-1° Reverse Slant' },
            { value: 'skew-y-1', label: '1° Vertical Slant' },
          ]}
        />
      </div>

      {/* 2D Translation & Origin */}
      <div className="grid grid-cols-3 gap-1.5 mt-2">
        <StudioSelect
          id={transformTranslateXSelectId}
          label="Translate X"
          value={styles.transform?.translateX || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              transform: { ...styles.transform, translateX: val },
            })
          }
          options={[
            { value: '', label: '0 (None)' },
            { value: 'translate-x-1', label: '+4px (translate-x-1)' },
            { value: '-translate-x-1', label: '-4px (-translate-x-1)' },
            { value: 'translate-x-2', label: '+8px (translate-x-2)' },
            { value: '-translate-x-2', label: '-8px (-translate-x-2)' },
            { value: 'translate-x-4', label: '+16px (translate-x-4)' },
            { value: '-translate-x-4', label: '-16px (-translate-x-4)' },
            { value: 'translate-x-full', label: '+100% (+full)' },
            { value: '-translate-x-full', label: '-100% (-full)' },
          ]}
        />
        <StudioSelect
          id={transformTranslateYSelectId}
          label="Translate Y"
          value={styles.transform?.translateY || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              transform: { ...styles.transform, translateY: val },
            })
          }
          options={[
            { value: '', label: '0 (None)' },
            { value: 'translate-y-1', label: '+4px (translate-y-1)' },
            { value: '-translate-y-1', label: '-4px (-translate-y-1)' },
            { value: 'translate-y-2', label: '+8px (translate-y-2)' },
            { value: '-translate-y-2', label: '-8px (-translate-y-2)' },
            { value: 'translate-y-4', label: '+16px (translate-y-4)' },
            { value: '-translate-y-4', label: '-16px (-translate-y-4)' },
            { value: '-translate-y-1/2', label: '-50% (Center Offset)' },
            { value: 'translate-y-full', label: '+100% (+full)' },
          ]}
        />
        <StudioSelect
          id={transformOriginSelectId}
          label="Transform Origin"
          value={styles.transform?.transformOrigin || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              transform: { ...styles.transform, transformOrigin: val },
            })
          }
          options={[
            { value: '', label: 'Default (Center)' },
            { value: 'origin-center', label: 'Center' },
            { value: 'origin-top', label: 'Top' },
            { value: 'origin-top-right', label: 'Top Right' },
            { value: 'origin-right', label: 'Right' },
            { value: 'origin-bottom-right', label: 'Bottom Right' },
            { value: 'origin-bottom', label: 'Bottom' },
            { value: 'origin-bottom-left', label: 'Bottom Left' },
            { value: 'origin-left', label: 'Left' },
            { value: 'origin-top-left', label: 'Top Left' },
          ]}
        />
      </div>
    </StudioSection>
  );
}
