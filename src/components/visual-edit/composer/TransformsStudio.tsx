'use client';

import type { VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from './ui';

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
