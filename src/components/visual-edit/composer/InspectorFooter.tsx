'use client';

import { AlertTriangle, Redo2, RotateCcw, Sparkles, Undo2 } from 'lucide-react';
import type { VisualComposerMode } from '@/types/unified';

export interface InspectorFooterProps {
  inspectorMode: VisualComposerMode;
  onResetStyles: () => void;
  onClose: () => void;
  onApply: () => void;
  /** When multiple blocks are selected, apply to all of them at once. */
  isBatchMode?: boolean;
  selectedCount?: number;
  /** Keep the inspector open after applying instead of closing it. */
  keepOpenOnApply?: boolean;
  onToggleKeepOpen?: () => void;
  /** Undo the last style change within this composer session. */
  onUndo?: () => void;
  /** Redo the last undone style change within this composer session. */
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /**
   * True when the panel holds style edits the page has not been given yet.
   * Closing would discard them silently, so the footer says so out loud.
   */
  dirty?: boolean;
  /**
   * Nothing to write, so Apply is inert.
   *
   * A no-op save mints a revision identical to the one before it and reports
   * success for work that did not happen. Batch mode never sets this: its
   * baseline describes one block, so applying untouched controls to the others
   * is a real change.
   */
  applyDisabled?: boolean;
  /** The named groups that differ from the last applied state. */
  changedGroups?: readonly { label: string; fields: string[] }[];
  /** Put one named group back where the page last agreed it was. */
  onRevertGroup?: (label: string) => void;
  /** True while the footer is asking whether to throw the edits away. */
  confirmDiscard?: boolean;
  /** Close, discarding the pending edits. */
  onConfirmDiscard?: () => void;
  /** Dismiss the discard prompt and stay in the composer. */
  onDismissDiscard?: () => void;
}

export function InspectorFooter({
  inspectorMode,
  onResetStyles,
  onClose,
  onApply,
  isBatchMode = false,
  selectedCount = 0,
  keepOpenOnApply = false,
  onToggleKeepOpen,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  dirty = false,
  applyDisabled = false,
  changedGroups = [],
  onRevertGroup,
  confirmDiscard = false,
  onConfirmDiscard,
  onDismissDiscard,
}: InspectorFooterProps) {
  return (
    <div className="space-y-2 border-t border-white/10 bg-slate-900/80 px-4 py-2.5">
      {/* History + reset, and the mode that decides what Apply does. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo the last design or copy change (⌘Z)"
            aria-label="Undo last change"
            aria-keyshortcuts="Meta+Z Control+Z"
            className={`flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-bold transition-colors ${
              canUndo
                ? 'cursor-pointer text-slate-300 hover:bg-white/10 hover:text-white'
                : 'cursor-not-allowed text-slate-400 opacity-50'
            }`}
          >
            <Undo2 size={13} />
            <span>Undo</span>
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo the last undone change (⌘⇧Z)"
            aria-label="Redo last undone change"
            aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
            className={`flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-bold transition-colors ${
              canRedo
                ? 'cursor-pointer text-slate-300 hover:bg-white/10 hover:text-white'
                : 'cursor-not-allowed text-slate-400 opacity-50'
            }`}
          >
            <Redo2 size={13} />
            <span>Redo</span>
          </button>

          <span className="mx-0.5 h-4 w-px shrink-0 bg-white/15" aria-hidden="true" />

          <button
            type="button"
            onClick={onResetStyles}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-bold text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <RotateCcw size={12} />
            <span>Reset Design</span>
          </button>
        </div>

        {onToggleKeepOpen ? (
          <button
            type="button"
            onClick={onToggleKeepOpen}
            aria-pressed={keepOpenOnApply}
            title={
              keepOpenOnApply
                ? 'Applying keeps this panel open. Click to close it after each apply.'
                : 'Applying closes this panel. Click to keep it open while you iterate.'
            }
            className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold transition-colors ${
              keepOpenOnApply
                ? 'border-accent-gold/50 bg-accent-gold/20 text-accent-gold'
                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Sparkles size={11} />
            <span>Keep editing</span>
          </button>
        ) : null}
      </div>

      {/*
        Closing with pending edits is the one destructive action this panel has,
        and it used to be one keystroke away with no warning. The prompt is
        inline rather than a modal: a dialog inside a dialog loses the operator's
        place, and the discard decision is small enough to state in one line.
      */}
      {confirmDiscard ? (
        <div
          role="alertdialog"
          aria-label="Discard unsaved style changes"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-2.5 py-1.5"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-rose-200">
            <AlertTriangle size={12} />
            Discard unsaved changes?
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDismissDiscard}
              className="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-bold text-white transition-colors hover:bg-white/10"
            >
              Back to editing
            </button>
            <button
              type="button"
              onClick={onConfirmDiscard}
              className="cursor-pointer rounded-lg bg-rose-500 px-2 py-1 text-[11px] font-black text-white transition-colors hover:bg-rose-400"
            >
              Discard
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {/* A live region, so the state is announced rather than only coloured. */}
            <p
              role="status"
              aria-live="polite"
              className={dirty ? 'text-[10px] font-bold text-accent-gold' : 'sr-only'}
            >
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </p>

            {/* The panel's two most useful keystrokes, where a clean draft
                leaves room for them. The buttons carry the same shortcuts in
                `aria-keyshortcuts`; this is the visual reminder. */}
            {!dirty ? (
              <p aria-hidden="true" className="text-[10px] text-slate-400">
                <kbd className="font-sans font-bold text-slate-300">⌘↵</kbd> apply
                <span className="mx-1 text-slate-400/60">·</span>
                <kbd className="font-sans font-bold text-slate-300">esc</kbd> close
              </p>
            ) : null}

            {/*
              A chip per group that differs from the last applied state, and a
              click puts that group back. "Something is unsaved" is a warning;
              "Type and Border are unsaved, and here is how to drop just those"
              is a decision the operator can make without losing the rest.
            */}
            {dirty
              ? changedGroups.map((group) => (
                  <button
                    key={group.label}
                    type="button"
                    data-testid="changed-group"
                    onClick={() => onRevertGroup?.(group.label)}
                    title={`Revert ${group.label.toLowerCase()}: ${group.fields.slice(0, 4).join(', ')}`}
                    aria-label={`Revert ${group.label.toLowerCase()} changes`}
                    className="group inline-flex cursor-pointer items-center gap-1 rounded-full border border-accent-gold/30 bg-accent-gold/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-gold transition-colors hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-200"
                  >
                    <span>{group.label}</span>
                    <RotateCcw size={8} className="opacity-60 group-hover:opacity-100" />
                  </button>
                ))
              : null}
          </div>

          <div className="flex items-center gap-2">
            {/* Commit. In batch mode the label names the count, so the scope of
                the write is visible before the click rather than inferred after. */}
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={applyDisabled}
              aria-keyshortcuts="Meta+Enter Control+Enter Meta+S Control+S"
              title={applyDisabled ? 'No changes to save yet' : 'Apply these changes (⌘↵)'}
              className={`rounded-xl px-4 py-1.5 text-xs font-black transition-colors ${
                applyDisabled
                  ? 'cursor-not-allowed bg-accent-gold/25 text-ink-strong/60'
                  : 'cursor-pointer bg-accent-gold text-ink-strong shadow-lg hover:bg-accent-gold/90'
              }`}
            >
              {isBatchMode ? (
                <>
                  <Sparkles size={12} className="mr-1 inline" />
                  <span>Apply to {selectedCount} blocks</span>
                </>
              ) : inspectorMode === 'section' ? (
                'Save Section'
              ) : (
                'Save Block'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
