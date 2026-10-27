'use client';

import type { VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export interface DimensionsPositioningStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  layoutPositionSelectId?: string;
  layoutZIndexSelectId?: string;
  layoutOverflowSelectId?: string;
  layoutInsetSelectId?: string;
  layoutTopSelectId?: string;
  layoutBottomSelectId?: string;
  layoutLeftSelectId?: string;
  layoutRightSelectId?: string;
}

export function DimensionsPositioningStudio({
  styles,
  setStyles,
  layoutPositionSelectId,
  layoutZIndexSelectId,
  layoutOverflowSelectId,
  layoutInsetSelectId,
  layoutTopSelectId,
  layoutBottomSelectId,
  layoutLeftSelectId,
  layoutRightSelectId,
}: DimensionsPositioningStudioProps) {
  return (
    <StudioSection
      title="Positioning, Offsets & Layering"
      badge="Positioning"
      description="Control position flow (relative, sticky, absolute), z-index stacking, overflow clipping, and directional insets."
    >
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <StudioSelect
          id={layoutPositionSelectId}
          label="Position"
          value={styles.layout.position}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, position: val },
            })
          }
          options={[
            { value: '', label: 'Static (Normal Flow)' },
            { value: 'relative', label: 'Relative' },
            { value: 'sticky top-0', label: 'Sticky Top-0' },
            { value: 'sticky top-4', label: 'Sticky Top-4' },
            { value: 'absolute', label: 'Absolute' },
            { value: 'fixed', label: 'Fixed Viewport' },
          ]}
        />
        <StudioSelect
          id={layoutZIndexSelectId}
          label="Z-Index Stacking"
          value={styles.layout.zIndex}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, zIndex: val },
            })
          }
          options={[
            { value: '', label: 'Auto' },
            { value: 'z-0', label: 'z-0 (Base)' },
            { value: 'z-10', label: 'z-10 (Low)' },
            { value: 'z-20', label: 'z-20 (Mid)' },
            { value: 'z-30', label: 'z-30 (Above Content)' },
            { value: 'z-40', label: 'z-40 (Floating Bar)' },
            { value: 'z-50', label: 'z-50 (Modal / Toast)' },
          ]}
        />
        <StudioSelect
          id={layoutOverflowSelectId}
          label="Overflow Clipping"
          value={styles.layout.overflow}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, overflow: val },
            })
          }
          options={[
            { value: '', label: 'Visible' },
            { value: 'overflow-hidden', label: 'Hidden (Clip Edges)' },
            { value: 'overflow-auto', label: 'Auto Scroll' },
            { value: 'overflow-x-auto', label: 'Horizontal Scroll' },
            { value: 'overflow-y-auto', label: 'Vertical Scroll' },
          ]}
        />
      </div>

      {/* Directional Positioning Offsets */}
      <div className="p-2.5 rounded-xl border border-white/10 bg-white/5 space-y-1.5">
        <span className="text-[10px] text-slate-300 font-bold block">
          Directional Positioning Offsets (Pro)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          <StudioSelect
            id={layoutInsetSelectId || 'layout-inset'}
            label="Inset All"
            value={styles.layout.inset || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, inset: val },
              })
            }
            options={[
              { value: '', label: 'Auto' },
              { value: 'inset-0', label: 'Cover (0)' },
              { value: 'inset-2', label: 'Inset 8px' },
              { value: 'inset-4', label: 'Inset 16px' },
              { value: 'inset-x-0', label: 'Span X (0)' },
              { value: 'inset-y-0', label: 'Span Y (0)' },
            ]}
            size="xs"
          />
          <StudioSelect
            id={layoutTopSelectId || 'layout-top'}
            label="Top"
            value={styles.layout.top || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, top: val },
              })
            }
            options={[
              { value: '', label: 'Auto' },
              { value: 'top-0', label: 'Top 0' },
              { value: 'top-2', label: 'Top 8px' },
              { value: 'top-4', label: 'Top 16px' },
              { value: 'top-8', label: 'Top 32px' },
              { value: 'top-1/2', label: 'Top 50%' },
              { value: '-top-4', label: '-16px Pull' },
            ]}
            size="xs"
          />
          <StudioSelect
            id={layoutBottomSelectId || 'layout-bottom'}
            label="Bottom"
            value={styles.layout.bottom || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, bottom: val },
              })
            }
            options={[
              { value: '', label: 'Auto' },
              { value: 'bottom-0', label: 'Bottom 0' },
              { value: 'bottom-2', label: 'Bottom 8px' },
              { value: 'bottom-4', label: 'Bottom 16px' },
              { value: 'bottom-8', label: 'Bottom 32px' },
              { value: '-bottom-4', label: '-16px Pull' },
            ]}
            size="xs"
          />
          <StudioSelect
            id={layoutLeftSelectId || 'layout-left'}
            label="Left"
            value={styles.layout.left || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, left: val },
              })
            }
            options={[
              { value: '', label: 'Auto' },
              { value: 'left-0', label: 'Left 0' },
              { value: 'left-2', label: 'Left 8px' },
              { value: 'left-4', label: 'Left 16px' },
              { value: 'left-1/2', label: 'Left 50%' },
              { value: '-left-4', label: '-16px Pull' },
            ]}
            size="xs"
          />
          <StudioSelect
            id={layoutRightSelectId || 'layout-right'}
            label="Right"
            value={styles.layout.right || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, right: val },
              })
            }
            options={[
              { value: '', label: 'Auto' },
              { value: 'right-0', label: 'Right 0' },
              { value: 'right-2', label: 'Right 8px' },
              { value: 'right-4', label: 'Right 16px' },
              { value: 'right-8', label: 'Right 32px' },
              { value: '-right-4', label: '-16px Pull' },
            ]}
            size="xs"
          />
        </div>
      </div>
    </StudioSection>
  );
}
