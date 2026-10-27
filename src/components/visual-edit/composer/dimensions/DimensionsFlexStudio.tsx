'use client';

import { Sparkles } from 'lucide-react';
import type { VisualComposerFlexPreset, VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export const FLEX_PRESETS: readonly VisualComposerFlexPreset[] = [
  {
    id: 'center-stage',
    name: 'Center Stage',
    description: 'Centered vertical column flow (hero or modal layout)',
    apply: () => ({
      display: 'flex',
      flexDirection: 'flex-col',
      justifyContent: 'justify-center',
      alignItems: 'items-center',
    }),
  },
  {
    id: 'space-between-row',
    name: 'Space Between',
    description: 'Horizontal navbar or card header row with end-to-end items',
    apply: () => ({
      display: 'flex',
      flexDirection: 'flex-row',
      justifyContent: 'justify-between',
      alignItems: 'items-center',
    }),
  },
  {
    id: 'left-stack',
    name: 'Left Stack',
    description: 'Clean vertical stack aligned to the left edge',
    apply: () => ({
      display: 'flex',
      flexDirection: 'flex-col',
      justifyContent: 'justify-start',
      alignItems: 'items-start',
    }),
  },
  {
    id: 'wrap-grid',
    name: 'Row Wrap Grid',
    description: 'Dynamic flex row wrapping items onto multiple lines',
    apply: () => ({
      display: 'flex',
      flexDirection: 'flex-row',
      justifyContent: 'justify-start',
      alignItems: 'items-stretch',
      flexWrap: 'flex-wrap',
    }),
  },
  {
    id: 'centered-row',
    name: 'Centered Row',
    description: 'Single-line horizontal row centered on both axes',
    apply: () => ({
      display: 'flex',
      flexDirection: 'flex-row',
      justifyContent: 'justify-center',
      alignItems: 'items-center',
    }),
  },
  {
    id: 'right-action-bar',
    name: 'Right Action Bar',
    description: 'Horizontal row pushed to the right for action buttons',
    apply: () => ({
      display: 'flex',
      flexDirection: 'flex-row',
      justifyContent: 'justify-end',
      alignItems: 'items-center',
    }),
  },
] as const;

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
      {/* 1-Click Flex Alignment Presets */}
      <div className="space-y-1.5 mb-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          1-Click Flex Flow Presets
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {FLEX_PRESETS.map((preset) => (
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

      {/* Live Flex Flow Preview Visualizer */}
      {isFlexContainer && (
        <div className="p-2.5 rounded-xl border border-white/10 bg-slate-900/60 space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={11} className="text-accent-gold" />
              <span>Live Flexbox Flow Preview</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {styles.layout.flexDirection || 'flex-row'} ·{' '}
              {styles.layout.justifyContent || 'justify-start'} ·{' '}
              {styles.layout.alignItems || 'items-start'}
            </span>
          </div>
          <div
            data-testid="flex-live-preview"
            className={`h-24 w-full rounded-lg border border-white/10 bg-slate-950/80 p-2 flex gap-1.5 transition-all overflow-hidden ${
              styles.layout.flexDirection || 'flex-row'
            } ${styles.layout.justifyContent || 'justify-start'} ${
              styles.layout.alignItems || 'items-start'
            } ${styles.layout.flexWrap || ''}`}
          >
            <div className="flex h-7 w-12 items-center justify-center rounded bg-accent-gold/20 border border-accent-gold/40 text-[10px] font-bold text-accent-gold shrink-0">
              Item 1
            </div>
            <div className="flex h-7 w-12 items-center justify-center rounded bg-sky-500/20 border border-sky-400/40 text-[10px] font-bold text-sky-300 shrink-0">
              Item 2
            </div>
            <div className="flex h-7 w-12 items-center justify-center rounded bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-bold text-emerald-300 shrink-0">
              Item 3
            </div>
          </div>
        </div>
      )}

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
        <div className="p-3 rounded-xl border border-white/10 bg-white/5 mb-3 text-xs text-slate-300 space-y-2">
          <p>
            Current display mode is{' '}
            <strong className="text-white">{styles.layout.display || 'Normal Flow'}</strong>. Switch
            Display Mode to <strong className="text-accent-gold">Flex Container</strong> to unlock
            container-level direction, justify, align, and wrap controls.
          </p>
          <button
            type="button"
            data-testid="enable-flex-container-button"
            onClick={() =>
              setStyles((prev) => ({
                ...prev,
                layout: { ...prev.layout, display: 'flex' },
              }))
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent-gold/40 bg-accent-gold/20 px-2.5 py-1 text-[11px] font-bold text-accent-gold hover:bg-accent-gold/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles size={12} />
            <span>Enable Flex Container</span>
          </button>
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
