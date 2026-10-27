'use client';

import { Move } from 'lucide-react';
import type { Block } from '@/lib/blocks';
import type { VisualComposerStyles } from '@/types/unified';
import { BoxModelDiagram, StudioSection, StudioSelect } from '../ui';

export interface BoxModelSpacingStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  currentBlock: Block;
  isSidesLinked: boolean;
  setIsSidesLinked: React.Dispatch<React.SetStateAction<boolean>>;
  cycleMarginValue: (current: string, axis?: 'vertical' | 'horizontal') => string;
  cyclePaddingValue: (current: string, axis?: 'vertical' | 'horizontal') => string;
  marginSelectId?: string;
  paddingSelectId?: string;
}

export function BoxModelSpacingStudio({
  styles,
  setStyles,
  currentBlock,
  isSidesLinked,
  setIsSidesLinked,
  cycleMarginValue,
  cyclePaddingValue,
  marginSelectId = 'vc-margin-select',
  paddingSelectId = 'vc-padding-select',
}: BoxModelSpacingStudioProps) {
  return (
    <StudioSection
      title="Spacing & Padding"
      badge="CSS Box"
      description="Inspect and adjust outer margins, inner paddings, and 2D bounding boxes in real-time."
      action={<Move size={13} className="text-accent-gold" />}
    >
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StudioSelect
          id={marginSelectId}
          label="Quick Margin"
          value={styles.margin.top}
          onChange={(val) =>
            setStyles({
              ...styles,
              margin: {
                ...styles.margin,
                top: val,
                bottom: isSidesLinked ? val : styles.margin.bottom,
                left: isSidesLinked ? val : styles.margin.left,
                right: isSidesLinked ? val : styles.margin.right,
              },
            })
          }
          options={[
            { value: '', label: 'None' },
            { value: 'my-2', label: 'Tight (my-2)' },
            { value: 'my-4', label: 'Normal (my-4)' },
            { value: 'my-6', label: 'Spacious (my-6)' },
            { value: 'my-8', label: 'Hero (my-8)' },
            { value: 'my-12', label: 'Loose (my-12)' },
          ]}
        />
        <StudioSelect
          id={paddingSelectId}
          label="Quick Padding"
          value={styles.padding.top}
          onChange={(val) =>
            setStyles({
              ...styles,
              padding: {
                ...styles.padding,
                top: val,
                bottom: isSidesLinked ? val : styles.padding.bottom,
                left: isSidesLinked ? val : styles.padding.left,
                right: isSidesLinked ? val : styles.padding.right,
              },
            })
          }
          options={[
            { value: '', label: 'None' },
            { value: 'p-2', label: 'Small (p-2)' },
            { value: 'p-4', label: 'Medium (p-4)' },
            { value: 'p-6', label: 'Spacious (p-6)' },
            { value: 'p-8', label: 'Hero (p-8)' },
            { value: 'p-12', label: 'Showcase (p-12)' },
          ]}
        />
      </div>

      {/* Interactive 2D Visual CSS Box Model Diagram */}
      <BoxModelDiagram
        styles={styles}
        setStyles={setStyles}
        isSidesLinked={isSidesLinked}
        setIsSidesLinked={setIsSidesLinked}
        cycleMarginValue={cycleMarginValue}
        cyclePaddingValue={cyclePaddingValue}
        currentBlock={currentBlock}
      />
    </StudioSection>
  );
}
