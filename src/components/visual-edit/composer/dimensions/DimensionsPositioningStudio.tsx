'use client';

import { Sparkles } from 'lucide-react';
import type { VisualComposerPositionPreset, VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export const POSITION_PRESETS: readonly VisualComposerPositionPreset[] = [
  {
    id: 'normal-flow',
    name: 'Normal Flow',
    description: 'Static browser layout flow with default z-index',
    apply: () => ({
      position: '',
      inset: '',
      top: '',
      bottom: '',
      left: '',
      right: '',
      zIndex: '',
    }),
  },
  {
    id: 'relative-anchor',
    name: 'Relative Anchor',
    description: 'Relative positioning context to anchor nested absolute badges or pins',
    apply: () => ({
      position: 'relative',
    }),
  },
  {
    id: 'sticky-top-bar',
    name: 'Sticky Header',
    description: 'Pins element to top edge (0) while scrolling with mid z-index',
    apply: () => ({
      position: 'sticky top-0',
      zIndex: 'z-30',
    }),
  },
  {
    id: 'sticky-card-pull',
    name: 'Sticky Floating',
    description: 'Floats 16px below top with z-20 for sticky callout cards',
    apply: () => ({
      position: 'sticky top-4',
      zIndex: 'z-20',
    }),
  },
  {
    id: 'absolute-full-cover',
    name: 'Absolute Cover',
    description: 'Covers entire parent canvas edge-to-edge (inset-0)',
    apply: () => ({
      position: 'absolute',
      inset: 'inset-0',
      zIndex: 'z-10',
    }),
  },
  {
    id: 'fixed-corner-action',
    name: 'Fixed Action Button',
    description: 'Pins to bottom-right viewport corner for floating actions',
    apply: () => ({
      position: 'fixed',
      bottom: 'bottom-4',
      right: 'right-4',
      zIndex: 'z-50',
    }),
  },
] as const;

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
      {/* 1-Click Positioning Presets */}
      <div className="space-y-1.5 mb-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          1-Click Positioning Presets
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {POSITION_PRESETS.map((preset) => (
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

      {/* Live Positioning Visualizer */}
      <div className="p-2.5 rounded-xl border border-white/10 bg-slate-900/60 space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={11} className="text-accent-gold" />
            <span>Positioning Geometry Preview</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {styles.layout.position || 'static'} · {styles.layout.zIndex || 'z-auto'}
          </span>
        </div>
        <div
          data-testid="position-live-preview"
          className="relative h-20 w-full rounded-lg border border-white/10 bg-slate-950/80 p-2 overflow-hidden flex items-center justify-center text-center"
        >
          <div className="absolute inset-1 rounded border border-dashed border-white/10 pointer-events-none" />
          <div
            className={`rounded px-2.5 py-1 text-[10px] font-bold transition-all shadow-sm ${
              styles.layout.position === 'absolute' || styles.layout.position === 'fixed'
                ? 'bg-rose-500/20 border border-rose-400/40 text-rose-300'
                : styles.layout.position.includes('sticky')
                  ? 'bg-sky-500/20 border border-sky-400/40 text-sky-300'
                  : 'bg-accent-gold/20 border border-accent-gold/40 text-accent-gold'
            } ${styles.layout.position || 'relative'} ${styles.layout.inset || ''} ${styles.layout.top || ''} ${styles.layout.bottom || ''} ${styles.layout.left || ''} ${styles.layout.right || ''}`}
          >
            {styles.layout.position || 'Normal Flow'}
          </div>
        </div>
      </div>

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
