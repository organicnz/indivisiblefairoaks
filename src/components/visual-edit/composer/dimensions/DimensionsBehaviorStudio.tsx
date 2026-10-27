'use client';

import { MousePointerClick, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { VisualComposerBehaviorPreset, VisualComposerStyles } from '@/types/unified';
import { StudioSection, StudioSelect } from '../ui';

export const BEHAVIOR_PRESETS: readonly VisualComposerBehaviorPreset[] = [
  {
    id: 'interactive-button',
    name: 'Clickable Action Element',
    description: 'Pointer hand cursor with active pointer events and unselectable text',
    badge: 'Click',
    apply: () => ({
      cursor: 'cursor-pointer',
      pointerEvents: 'pointer-events-auto',
      userSelect: 'select-none',
      visibility: 'visible',
    }),
  },
  {
    id: 'draggable-handle',
    name: 'Draggable Move Handle',
    description: 'Grab hand cursor with active pointer events for reordering or drag gestures',
    badge: 'Grab',
    apply: () => ({
      cursor: 'cursor-grab',
      pointerEvents: 'pointer-events-auto',
      userSelect: 'select-none',
      visibility: 'visible',
    }),
  },
  {
    id: 'editorial-selectable',
    name: 'Selectable Text Reading',
    description: 'Text cursor with full user selection on click for easy copy-pasting',
    badge: 'Copy',
    apply: () => ({
      cursor: 'cursor-text',
      pointerEvents: 'pointer-events-auto',
      userSelect: 'select-all',
      visibility: 'visible',
    }),
  },
  {
    id: 'disabled-state',
    name: 'Disabled / Inactive',
    description: 'Not-allowed cursor with disabled pointer events and selection lock',
    badge: 'Lock',
    apply: () => ({
      cursor: 'cursor-not-allowed',
      pointerEvents: 'pointer-events-none',
      userSelect: 'select-none',
    }),
  },
  {
    id: 'ghost-pass-through',
    name: 'Ghost Pass-Through',
    description: 'Pass clicks directly through to underlying elements without blocking interaction',
    badge: 'Ghost',
    apply: () => ({
      pointerEvents: 'pointer-events-none',
    }),
  },
  {
    id: 'clean-default',
    name: 'Default Browser Behavior',
    description: 'Reset all custom interaction modifiers back to native browser defaults',
    badge: 'Reset',
    apply: () => ({
      cursor: '',
      visibility: '',
      pointerEvents: '',
      userSelect: '',
    }),
  },
] as const;

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
      {/* 1. Live Interactive Interaction & Cursor Playground */}
      <div className="p-3 rounded-xl border border-white/10 bg-slate-900/60 flex flex-col gap-2.5 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
            <MousePointerClick size={12} className="text-accent-gold" />
            <span>Interaction & Cursor Playground</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setStyles((prev) => ({
                ...prev,
                layout: {
                  ...prev.layout,
                  cursor: '',
                  visibility: '',
                  pointerEvents: '',
                  userSelect: '',
                },
              }));
              toast.success('Reset interaction behaviors to browser default');
            }}
            className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5 cursor-pointer"
          >
            <RotateCcw size={10} />
            <span>Reset Default</span>
          </button>
        </div>

        {/* Live Interactive Testing Canvas */}
        <div
          data-testid="behavior-live-preview-box"
          className={`relative w-full p-3 rounded-lg border border-dashed border-white/15 bg-black/40 flex flex-col items-center justify-center text-center transition-all ${styles.layout.cursor || 'cursor-default'} ${styles.layout.pointerEvents || 'pointer-events-auto'} ${styles.layout.userSelect || ''} ${styles.layout.visibility || ''}`}
        >
          <span className="text-xs font-semibold text-white mb-0.5">
            Interactive Behavior Test Area
          </span>
          <p className="text-[10px] text-slate-300 max-w-xs">
            Hover, click, drag, or select this sentence to test active cursor, pointer pass-through,
            and selection rules in real time.
          </p>
        </div>

        {/* Live Indicator Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
            Cursor:{' '}
            <strong className="text-white">
              {styles.layout.cursor ? styles.layout.cursor.replace('cursor-', '') : 'default'}
            </strong>
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
            Pointer:{' '}
            <strong className="text-white">
              {styles.layout.pointerEvents
                ? styles.layout.pointerEvents.replace('pointer-events-', '')
                : 'auto'}
            </strong>
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
            Select:{' '}
            <strong className="text-white">
              {styles.layout.userSelect ? styles.layout.userSelect.replace('select-', '') : 'auto'}
            </strong>
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-slate-300">
            Visibility:{' '}
            <strong className="text-white">{styles.layout.visibility || 'visible'}</strong>
          </span>
        </div>

        {/* 1-Click Behavior Presets */}
        <div className="pt-1 border-t border-white/5">
          <span className="text-[10px] font-bold text-slate-300 mb-1.5 block">
            1-Click Behavior Presets
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {BEHAVIOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  const applied = preset.apply();
                  setStyles((prev) => ({
                    ...prev,
                    layout: {
                      ...prev.layout,
                      ...applied,
                    },
                  }));
                  toast.success(`Applied ${preset.name}`);
                }}
                className="flex items-center justify-between text-left px-2 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-accent-gold/40 transition-all cursor-pointer group"
              >
                <span className="text-[10px] font-medium text-white group-hover:text-accent-gold truncate">
                  {preset.name}
                </span>
                <span className="text-[8px] px-1 py-0.2 rounded font-mono font-bold bg-accent-gold/20 text-accent-gold border border-accent-gold/30 shrink-0 ml-1">
                  {preset.badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Granular Controls */}
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
