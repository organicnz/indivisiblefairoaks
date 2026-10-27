'use client';

import type { VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export interface DimensionsFlexStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  layoutFlexDirSelectId?: string;
  layoutJustifySelectId?: string;
  layoutAlignSelectId?: string;
  layoutFlexWrapSelectId?: string;
  layoutAlignSelfSelectId?: string;
  layoutOrderSelectId?: string;
  layoutFlexGrowSelectId?: string;
  layoutFlexShrinkSelectId?: string;
}

export function DimensionsFlexStudio({
  styles,
  setStyles,
  layoutFlexDirSelectId,
  layoutJustifySelectId,
  layoutAlignSelectId,
  layoutFlexWrapSelectId,
  layoutAlignSelfSelectId,
  layoutOrderSelectId,
  layoutFlexGrowSelectId,
  layoutFlexShrinkSelectId,
}: DimensionsFlexStudioProps) {
  const isFlexContainer =
    styles.layout.display === 'flex' || styles.layout.display === 'inline-flex';

  return (
    <StudioSection
      title="Flexbox Flow & Alignment"
      badge="Flex Layout"
      description="Fine-tune flex directions, justification, cross-axis alignment, wrapping, order, and grow/shrink scale."
    >
      {/* Flex Container Controls */}
      {isFlexContainer ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2.5 rounded-xl bg-white/5 border border-white/10 mb-3">
          <StudioSelect
            id={layoutFlexDirSelectId}
            label="Direction"
            value={styles.layout.flexDirection}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, flexDirection: val },
              })
            }
            options={[
              { value: 'flex-row', label: 'Row (Horizontal)' },
              { value: 'flex-col', label: 'Column (Vertical)' },
              { value: 'flex-row-reverse', label: 'Row Reverse' },
              { value: 'flex-col-reverse', label: 'Col Reverse' },
            ]}
            size="xs"
          />
          <StudioSelect
            id={layoutJustifySelectId}
            label="Justify Content"
            value={styles.layout.justifyContent}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, justifyContent: val },
              })
            }
            options={[
              { value: 'justify-start', label: 'Start' },
              { value: 'justify-center', label: 'Center' },
              { value: 'justify-end', label: 'End' },
              { value: 'justify-between', label: 'Space Between' },
              { value: 'justify-around', label: 'Space Around' },
              { value: 'justify-evenly', label: 'Space Evenly' },
            ]}
            size="xs"
          />
          <StudioSelect
            id={layoutAlignSelectId}
            label="Align Items"
            value={styles.layout.alignItems}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, alignItems: val },
              })
            }
            options={[
              { value: 'items-start', label: 'Start / Top' },
              { value: 'items-center', label: 'Center Vertically' },
              { value: 'items-end', label: 'End / Bottom' },
              { value: 'items-stretch', label: 'Stretch to Fill' },
              { value: 'items-baseline', label: 'Text Baseline' },
            ]}
            size="xs"
          />
          <StudioSelect
            id={layoutFlexWrapSelectId}
            label="Flex Wrap"
            value={styles.layout.flexWrap || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, flexWrap: val },
              })
            }
            options={[
              { value: '', label: 'No Wrap' },
              { value: 'flex-wrap', label: 'Wrap onto Rows' },
              { value: 'flex-wrap-reverse', label: 'Wrap Reverse' },
            ]}
            size="xs"
          />
        </div>
      ) : (
        <div className="p-2.5 rounded-xl border border-white/10 bg-white/5 mb-3 text-[11px] text-slate-400">
          <p>
            Current display mode is{' '}
            <strong className="text-white">{styles.layout.display || 'Normal Flow'}</strong>. Switch
            Display Mode to <strong className="text-accent-gold">Flex Container</strong> to unlock
            container-level direction and justify controls.
          </p>
        </div>
      )}

      {/* Flex Child Alignment & Order */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <StudioSelect
          id={layoutAlignSelfSelectId}
          label="Self Alignment"
          value={styles.layout.alignSelf || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, alignSelf: val },
            })
          }
          options={[
            { value: '', label: 'Default (Auto)' },
            { value: 'self-auto', label: 'Auto (self-auto)' },
            { value: 'self-start', label: 'Start / Top' },
            { value: 'self-center', label: 'Centered' },
            { value: 'self-end', label: 'End / Bottom' },
            { value: 'self-stretch', label: 'Stretch' },
            { value: 'self-baseline', label: 'Baseline' },
          ]}
        />
        <StudioSelect
          id={layoutOrderSelectId}
          label="Display Order"
          value={styles.layout.order || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, order: val },
            })
          }
          options={[
            { value: '', label: 'Natural Order' },
            { value: 'order-first', label: 'Order First' },
            { value: 'order-last', label: 'Order Last' },
            { value: 'order-1', label: 'Position 1' },
            { value: 'order-2', label: 'Position 2' },
            { value: 'order-3', label: 'Position 3' },
          ]}
        />
        <StudioSelect
          id={layoutFlexGrowSelectId}
          label="Flex Sizing (Grow)"
          value={styles.layout.flexGrow || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, flexGrow: val },
            })
          }
          options={[
            { value: '', label: 'Default Sizing' },
            { value: 'grow', label: 'Grow to Fill (grow)' },
            { value: 'grow-0', label: 'Fixed Scale (grow-0)' },
            { value: 'shrink', label: 'Allow Shrink (shrink)' },
            { value: 'shrink-0', label: 'Prevent Shrink (shrink-0)' },
          ]}
        />
        <StudioSelect
          id={layoutFlexShrinkSelectId}
          label="Flex Shrink"
          value={styles.layout.flexShrink || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, flexShrink: val },
            })
          }
          options={[
            { value: '', label: 'Default Shrink' },
            { value: 'shrink', label: 'Allow Shrink (shrink)' },
            { value: 'shrink-0', label: 'Prevent Shrink (shrink-0)' },
          ]}
        />
      </div>
    </StudioSection>
  );
}
