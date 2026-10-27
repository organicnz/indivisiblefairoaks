'use client';

import type { VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export interface DimensionsBehaviorStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  layoutCursorSelectId?: string;
  layoutVisibilitySelectId?: string;
  layoutPointerEventsSelectId?: string;
  layoutUserSelectSelectId?: string;
}

export function DimensionsBehaviorStudio({
  styles,
  setStyles,
  layoutCursorSelectId,
  layoutVisibilitySelectId,
  layoutPointerEventsSelectId,
  layoutUserSelectSelectId,
}: DimensionsBehaviorStudioProps) {
  return (
    <StudioSection
      title="Interaction Behavior, Pointer & Cursors"
      badge="Interactions"
      description="Configure pointer events pass-through, hover cursor appearance, DOM space visibility, and text copy selection."
    >
      <div className="grid grid-cols-2 gap-2 mb-2">
        <StudioSelect
          id={layoutCursorSelectId}
          label="Cursor Behavior"
          value={styles.layout.cursor || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, cursor: val },
            })
          }
          options={[
            { value: '', label: 'Default (Browser)' },
            { value: 'cursor-pointer', label: 'Clickable Pointer (cursor-pointer)' },
            { value: 'cursor-grab', label: 'Draggable Grab (cursor-grab)' },
            { value: 'cursor-text', label: 'Text Selection (cursor-text)' },
            { value: 'cursor-not-allowed', label: 'Disabled / Not Allowed (cursor-not-allowed)' },
            { value: 'cursor-default', label: 'Arrow Default (cursor-default)' },
          ]}
        />
        <StudioSelect
          id={layoutVisibilitySelectId}
          label="CSS Visibility"
          value={styles.layout.visibility || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, visibility: val },
            })
          }
          options={[
            { value: '', label: 'Default (visible)' },
            { value: 'visible', label: 'Force Visible (visible)' },
            { value: 'invisible', label: 'Hidden in DOM Space (invisible)' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StudioSelect
          id={layoutPointerEventsSelectId}
          label="Pointer Events"
          value={styles.layout.pointerEvents || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, pointerEvents: val },
            })
          }
          options={[
            { value: '', label: 'Default (Auto)' },
            { value: 'pointer-events-auto', label: 'Interactive (pointer-events-auto)' },
            { value: 'pointer-events-none', label: 'Pass Through (pointer-events-none)' },
          ]}
        />
        <StudioSelect
          id={layoutUserSelectSelectId}
          label="User Selection"
          value={styles.layout.userSelect || ''}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, userSelect: val },
            })
          }
          options={[
            { value: '', label: 'Default (Selectable)' },
            { value: 'select-none', label: 'Prevent Selection (select-none)' },
            { value: 'select-text', label: 'Select Text (select-text)' },
            { value: 'select-all', label: 'Select All on Click (select-all)' },
          ]}
        />
      </div>
    </StudioSection>
  );
}
