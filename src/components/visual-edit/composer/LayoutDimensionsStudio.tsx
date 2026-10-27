'use client';

import type { VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from './ui';

export interface LayoutDimensionsStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  layoutDisplaySelectId?: string;
  layoutMaxWidthSelectId?: string;
  layoutWidthSelectId?: string;
  layoutMinWidthSelectId?: string;
  layoutHeightSelectId?: string;
  layoutMinHeightSelectId?: string;
  layoutMaxHeightSelectId?: string;
  layoutFlexDirSelectId?: string;
  layoutJustifySelectId?: string;
  layoutAlignSelectId?: string;
  layoutFlexWrapSelectId?: string;
  layoutAlignSelfSelectId?: string;
  layoutOrderSelectId?: string;
  layoutFlexGrowSelectId?: string;
  layoutFlexShrinkSelectId?: string;
  layoutAspectRatioSelectId?: string;
  layoutObjectFitSelectId?: string;
  layoutPositionSelectId?: string;
  layoutZIndexSelectId?: string;
  layoutOverflowSelectId?: string;
  layoutInsetSelectId?: string;
  layoutTopSelectId?: string;
  layoutBottomSelectId?: string;
  layoutLeftSelectId?: string;
  layoutRightSelectId?: string;
  layoutCursorSelectId?: string;
  layoutVisibilitySelectId?: string;
  layoutPointerEventsSelectId?: string;
  layoutUserSelectSelectId?: string;
}

export function LayoutDimensionsStudio({
  styles,
  setStyles,
  layoutDisplaySelectId,
  layoutMaxWidthSelectId,
  layoutWidthSelectId,
  layoutMinWidthSelectId,
  layoutHeightSelectId,
  layoutMinHeightSelectId,
  layoutMaxHeightSelectId,
  layoutFlexDirSelectId,
  layoutJustifySelectId,
  layoutAlignSelectId,
  layoutFlexWrapSelectId,
  layoutAlignSelfSelectId,
  layoutOrderSelectId,
  layoutFlexGrowSelectId,
  layoutFlexShrinkSelectId,
  layoutAspectRatioSelectId,
  layoutObjectFitSelectId,
  layoutPositionSelectId,
  layoutZIndexSelectId,
  layoutOverflowSelectId,
  layoutInsetSelectId,
  layoutTopSelectId,
  layoutBottomSelectId,
  layoutLeftSelectId,
  layoutRightSelectId,
  layoutCursorSelectId,
  layoutVisibilitySelectId,
  layoutPointerEventsSelectId,
  layoutUserSelectSelectId,
}: LayoutDimensionsStudioProps) {
  return (
    <StudioSection
      title="Layout, Display & Sizing"
      badge="Dimensions"
      description="Fine-tune display flow, widths, heights, flex alignment, and positioning offsets."
    >
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

      {/* Flex Options if display is flex */}
      {(styles.layout.display === 'flex' || styles.layout.display === 'inline-flex') && (
        <div className="grid grid-cols-4 gap-1.5 p-2 rounded-xl bg-white/5 border border-white/10 mb-2">
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
              { value: 'flex-row', label: 'Row' },
              { value: 'flex-col', label: 'Column' },
              { value: 'flex-row-reverse', label: 'Row Rev' },
              { value: 'flex-col-reverse', label: 'Col Rev' },
            ]}
            size="xs"
          />
          <StudioSelect
            id={layoutJustifySelectId}
            label="Justify"
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
              { value: 'justify-between', label: 'Between' },
              { value: 'justify-around', label: 'Around' },
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
              { value: 'items-start', label: 'Start' },
              { value: 'items-center', label: 'Center' },
              { value: 'items-end', label: 'End' },
              { value: 'items-stretch', label: 'Stretch' },
            ]}
            size="xs"
          />
          <StudioSelect
            id={layoutFlexWrapSelectId}
            label="Wrap"
            value={styles.layout.flexWrap || ''}
            onChange={(val) =>
              setStyles({
                ...styles,
                layout: { ...styles.layout, flexWrap: val },
              })
            }
            options={[
              { value: '', label: 'No Wrap' },
              { value: 'flex-wrap', label: 'Wrap' },
              { value: 'flex-wrap-reverse', label: 'Reverse' },
            ]}
            size="xs"
          />
        </div>
      )}

      {/* Flex Child & Self-Alignment */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
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
            { value: 'self-start', label: 'Start / Top (self-start)' },
            { value: 'self-center', label: 'Centered (self-center)' },
            { value: 'self-end', label: 'End / Bottom (self-end)' },
            { value: 'self-stretch', label: 'Stretch (self-stretch)' },
            { value: 'self-baseline', label: 'Baseline (self-baseline)' },
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
          label="Flex Sizing"
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

      {/* Media Aspect Ratio & Object Fit */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
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

      {/* Positioning & Layering */}
      <div className="grid grid-cols-3 gap-1.5">
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
            { value: '', label: 'Static' },
            { value: 'relative', label: 'Relative' },
            { value: 'sticky top-0', label: 'Sticky Top-0' },
            { value: 'sticky top-4', label: 'Sticky Top-4' },
            { value: 'absolute', label: 'Absolute' },
          ]}
        />
        <StudioSelect
          id={layoutZIndexSelectId}
          label="Z-Index"
          value={styles.layout.zIndex}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, zIndex: val },
            })
          }
          options={[
            { value: '', label: 'Auto' },
            { value: 'z-0', label: 'z-0' },
            { value: 'z-10', label: 'z-10' },
            { value: 'z-20', label: 'z-20' },
            { value: 'z-30', label: 'z-30' },
            { value: 'z-40', label: 'z-40' },
            { value: 'z-50', label: 'z-50' },
          ]}
        />
        <StudioSelect
          id={layoutOverflowSelectId}
          label="Overflow"
          value={styles.layout.overflow}
          onChange={(val) =>
            setStyles({
              ...styles,
              layout: { ...styles.layout, overflow: val },
            })
          }
          options={[
            { value: '', label: 'Visible' },
            { value: 'overflow-hidden', label: 'Hidden' },
            { value: 'overflow-auto', label: 'Auto Scroll' },
            { value: 'overflow-x-auto', label: 'Scroll X' },
          ]}
        />
      </div>

      {/* Directional Positioning Offsets (Pro) */}
      <div className="mt-2 p-2 rounded-lg border border-white/10 bg-white/5 space-y-1.5">
        <span className="text-[10px] text-slate-300 font-bold block">
          Directional Positioning Offsets (Pro)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          <StudioSelect
            id={layoutInsetSelectId}
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
            id={layoutTopSelectId}
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
            id={layoutBottomSelectId}
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
            id={layoutLeftSelectId}
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
            id={layoutRightSelectId}
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

      {/* Interactive Cursor & Visibility */}
      <div className="grid grid-cols-2 gap-1.5 mt-2">
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

      {/* Pointer Events & User Selection */}
      <div className="grid grid-cols-2 gap-1.5 mt-2">
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
