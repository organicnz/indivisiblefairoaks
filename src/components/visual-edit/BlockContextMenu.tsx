'use client';

import {
  ArrowDown,
  ArrowUp,
  Copy,
  FileEdit,
  LayoutTemplate,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { KeyboardEventHandler, RefObject } from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import type { FixedPanelPosition } from './fixed-panel-position';

type BlockContextMenuProps = {
  blockIndex: number;
  blockCount: number;
  x: number;
  y: number;
  position: FixedPanelPosition | null;
  menuRef: RefObject<HTMLDivElement | null>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  onCustomize: () => void;
  onRowSettings: () => void;
  onEditContent: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddBelow: () => void;
  onDelete: () => void;
};

/**
 * Presentation-only on-canvas block menu. Focus, viewport clamping, dismissal,
 * and document guards stay in VisualEditOverlay so this extraction cannot change
 * the menu's keyboard or lifecycle behavior.
 */
export function BlockContextMenu({
  blockIndex,
  blockCount,
  x,
  y,
  position,
  menuRef,
  onKeyDown,
  onCustomize,
  onRowSettings,
  onEditContent,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onAddBelow,
  onDelete,
}: BlockContextMenuProps) {
  return (
    <div
      ref={menuRef}
      data-visual-edit-ui="context-menu"
      role="menu"
      aria-label="Block Context Menu"
      tabIndex={-1}
      className="fixed z-[10020] min-w-[210px] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-xl border border-white/20 bg-slate-950/95 p-1.5 text-xs text-white shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
      style={{
        top: position?.top ?? y,
        left: position?.left ?? x,
        maxHeight: position?.maxHeight,
      }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      <div className="px-2 py-1 text-[10px] font-bold text-accent-gold uppercase tracking-wider border-b border-white/10 mb-1 flex items-center justify-between">
        <span>Block #{blockIndex + 1}</span>
        <span className="text-[9px] text-slate-400 font-normal">Actions</span>
      </div>

      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={onCustomize}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-white transition-colors text-left"
      >
        <SlidersHorizontal size={13} className="text-accent-gold" />
        <span className="flex-1 font-semibold">Customize Block</span>
        <span className="font-mono text-[10px] text-slate-400">⌘E</span>
      </button>

      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={onRowSettings}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-white transition-colors text-left"
      >
        <LayoutTemplate size={13} className="text-sky-400" />
        <span className="flex-1 font-semibold">Row &amp; Section Settings</span>
        <span className="font-mono text-[10px] text-slate-400">⌘R</span>
      </button>

      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={onEditContent}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-white transition-colors text-left"
      >
        <FileEdit size={13} className="text-emerald-400" />
        <span className="flex-1">Edit Content</span>
      </button>

      <div className="my-1 border-t border-white/10" />

      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={onDuplicate}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-white transition-colors text-left"
      >
        <Copy size={13} className="text-amber-400" />
        <span className="flex-1">Duplicate Block</span>
        <span className="font-mono text-[10px] text-slate-400">⌘D</span>
      </button>

      {blockIndex > 0 ? (
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={onMoveUp}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-white transition-colors text-left"
        >
          <ArrowUp size={13} className="text-slate-400" />
          <span className="flex-1">Move Up</span>
        </button>
      ) : null}

      {blockIndex < blockCount - 1 ? (
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={onMoveDown}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-white transition-colors text-left"
        >
          <ArrowDown size={13} className="text-slate-400" />
          <span className="flex-1">Move Down</span>
        </button>
      ) : null}

      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={onAddBelow}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-white transition-colors text-left"
      >
        <Plus size={13} className="text-emerald-400" />
        <span className="flex-1">Add Block Below</span>
      </button>

      <div className="my-1 border-t border-white/10" />

      <div className="pt-0.5">
        <ConfirmAction
          label={`Delete Block #${blockIndex + 1}`}
          message={`Delete Block #${blockIndex + 1}?`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          danger
          idleRole="menuitem"
          idleTabIndex={-1}
          idleClassName="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition-colors text-left"
          onConfirm={onDelete}
        >
          <Trash2 size={13} className="text-rose-400" />
          <span className="flex-1">Delete Block</span>
        </ConfirmAction>
      </div>
    </div>
  );
}
