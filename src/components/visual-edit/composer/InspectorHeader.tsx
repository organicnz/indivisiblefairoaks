'use client';

import {
  ArrowDown,
  ArrowUp,
  Box,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  Crosshair,
  LayoutTemplate,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type React from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import type { VisualComposerMode } from '@/types/unified';

export interface InspectorHeaderProps {
  titleId: string;
  descId: string;
  blockIndex: number;
  blockType: string;
  inspectorMode: VisualComposerMode;
  setInspectorMode: (mode: VisualComposerMode) => void;
  hasCopiedStyles: boolean;
  onCopyStyles: () => void;
  onPasteStyles: () => void;
  onResetStyles: () => void;
  onClose: () => void;
  /** When batch-editing, show "N blocks selected" instead of the single-block subtitle. */
  isBatchMode?: boolean;
  selectedCount?: number;
  /**
   * The block's own text. An ordinal and a type ("Block #4 · paragraph") do not
   * tell an operator which paragraph they are looking at; its first words do.
   */
  blockLabel?: string;
  /** Scroll this block into view on the page. Omitted when nothing can locate it. */
  onLocate?: () => void;
  /**
   * Step to the previous or next block without closing the panel.
   * Omitted in batch mode (there is no single neighbouring block to edit) and
   * when the page cannot move the composer's target.
   */
  onNavigate?: (direction: 'previous' | 'next') => void;
  canNavigatePrevious?: boolean;
  canNavigateNext?: boolean;
  /** Ref forwarded to the 'Block Element' button for focus-on-open (FR-4). */
  firstFocusRef?: React.RefObject<HTMLButtonElement | null>;
  /** Optional atomic deletion callback for this block or batch. */
  onDeleteBlock?: () => void;
  /** Reorder this block up/down in the page directly from the composer header. */
  onMoveBlock?: (direction: 'up' | 'down') => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function InspectorHeader({
  titleId,
  descId,
  blockIndex,
  blockType,
  inspectorMode,
  setInspectorMode,
  hasCopiedStyles,
  onCopyStyles,
  onPasteStyles,
  onResetStyles,
  onClose,
  isBatchMode = false,
  selectedCount = 0,
  blockLabel = '',
  onLocate,
  onNavigate,
  canNavigatePrevious = false,
  canNavigateNext = false,
  firstFocusRef,
  onDeleteBlock,
  onMoveBlock,
  canMoveUp = false,
  canMoveDown = false,
}: InspectorHeaderProps) {
  return (
    <>
      {/* Drawer Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-3">
        {/* The action cluster keeps its width; the title gives way by wrapping. */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-gold/20 text-accent-gold">
            <SlidersHorizontal size={15} />
          </div>
          <div>
            <h2 id={titleId} className="text-sm font-bold text-white tracking-wide">
              Visual Composer Inspector
            </h2>
            {isBatchMode && selectedCount > 1 ? (
              <p
                id={descId}
                className="text-[11px] font-bold uppercase tracking-wider text-accent-gold"
              >
                {selectedCount} blocks · batch styling
              </p>
            ) : (
              <p id={descId} className="max-w-[15rem] text-[11px] text-slate-400">
                <span className="capitalize">{`Block #${blockIndex + 1} · ${blockType}`}</span>
                {blockLabel ? <span className="text-slate-400"> — “{blockLabel}”</span> : null}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/*
            Walk the page without closing. On a long page this is the whole
            difference between editing a column of blocks and opening the panel
            once per block — the move that used to require close, find, reopen.
          */}
          {onNavigate ? (
            <div className="flex items-center rounded-lg border border-white/10 bg-white/5">
              <button
                type="button"
                onClick={() => onNavigate('previous')}
                disabled={!canNavigatePrevious}
                aria-label="Previous block"
                aria-keyshortcuts="Alt+ArrowUp"
                title={
                  canNavigatePrevious
                    ? 'Edit the previous block (⌥↑)'
                    : 'This is the first block on the page'
                }
                className="rounded-l-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="h-3 w-px bg-white/15" aria-hidden="true" />
              <button
                type="button"
                onClick={() => onNavigate('next')}
                disabled={!canNavigateNext}
                aria-label="Next block"
                aria-keyshortcuts="Alt+ArrowDown"
                title={
                  canNavigateNext
                    ? 'Edit the next block (⌥↓)'
                    : 'This is the last block on the page'
                }
                className="rounded-r-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          ) : null}

          {/* Reorder: move the block up/down on the page directly from the composer. */}
          {onMoveBlock && !isBatchMode ? (
            <div className="flex items-center rounded-lg border border-white/10 bg-white/5">
              <button
                type="button"
                onClick={() => onMoveBlock('up')}
                disabled={!canMoveUp}
                aria-label="Move block up in page order"
                aria-keyshortcuts="Alt+Shift+ArrowUp"
                title={
                  canMoveUp
                    ? 'Move this block up in the page (⌥⇧↑)'
                    : 'This is the first block on the page'
                }
                className="rounded-l-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ArrowUp size={14} />
              </button>
              <span className="h-3 w-px bg-white/15" aria-hidden="true" />
              <button
                type="button"
                onClick={() => onMoveBlock('down')}
                disabled={!canMoveDown}
                aria-label="Move block down in page order"
                aria-keyshortcuts="Alt+Shift+ArrowDown"
                title={
                  canMoveDown
                    ? 'Move this block down in the page (⌥⇧↓)'
                    : 'This is the last block on the page'
                }
                className="rounded-r-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ArrowDown size={14} />
              </button>
            </div>
          ) : null}

          {/* Locate: scroll the block into view, without changing the selection. */}
          {onLocate ? (
            <button
              type="button"
              onClick={onLocate}
              aria-label="Show this block on the page"
              title="Scroll this block into view on the page"
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-accent-gold"
            >
              <Crosshair size={14} />
            </button>
          ) : null}

          {/* Quick Copy Styles Button */}
          <button
            type="button"
            onClick={onCopyStyles}
            title="Copy current styles to clipboard"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ClipboardCopy size={12} />
            <span>Copy</span>
          </button>

          {/* Quick Paste Styles Button */}
          <button
            type="button"
            onClick={onPasteStyles}
            disabled={!hasCopiedStyles}
            title={hasCopiedStyles ? 'Paste copied styles' : 'Clipboard empty'}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${
              hasCopiedStyles
                ? 'border-accent-gold/40 bg-accent-gold/15 text-accent-gold hover:bg-accent-gold/25'
                : 'border-white/5 bg-white/5 text-slate-400 opacity-40 cursor-not-allowed'
            }`}
          >
            <ClipboardPaste size={12} />
            <span>Paste</span>
          </button>

          {/* Quick Reset Styles Button */}
          <button
            type="button"
            onClick={onResetStyles}
            title="Reset design to defaults — keeps the block's anchor id"
            aria-label="Reset design to defaults, keeping the anchor id"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border border-white/10 bg-white/5 text-slate-300 hover:text-accent-gold hover:bg-white/10 transition-colors"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>

          {/* Quick Delete Block Button */}
          {onDeleteBlock ? (
            <ConfirmAction
              label={
                isBatchMode && selectedCount > 1
                  ? `Delete ${selectedCount} selected blocks`
                  : `Delete block #${blockIndex + 1}`
              }
              message={
                isBatchMode && selectedCount > 1
                  ? `Delete ${selectedCount} blocks?`
                  : `Delete #${blockIndex + 1} (${blockType})?`
              }
              confirmLabel="Delete"
              cancelLabel="Cancel"
              danger
              idleClassName="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:text-white hover:bg-rose-500/25 transition-colors cursor-pointer"
              onConfirm={onDeleteBlock}
            >
              <Trash2 size={12} />
              <span>
                {isBatchMode && selectedCount > 1 ? `Delete (${selectedCount})` : 'Delete'}
              </span>
            </ConfirmAction>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Inspector"
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors ml-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Target Level Mode Switcher: Block Element vs Row / Section */}
      <div className="flex border-b border-white/10 bg-slate-900/80 p-2 gap-1.5">
        <button
          type="button"
          ref={firstFocusRef}
          aria-pressed={inspectorMode === 'block'}
          onClick={() => setInspectorMode('block')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
            inspectorMode === 'block'
              ? 'bg-accent-gold text-ink-strong shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Box size={13} />
          <span>Block Element</span>
        </button>
        <button
          type="button"
          aria-pressed={inspectorMode === 'section'}
          onClick={() => setInspectorMode('section')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
            inspectorMode === 'section'
              ? 'bg-accent-gold text-ink-strong shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <LayoutTemplate size={13} />
          <span>Row / Section</span>
        </button>
      </div>
    </>
  );
}
