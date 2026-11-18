'use client';

import { GripVertical, Layers, Trash2 } from 'lucide-react';
import { ModalDialog } from './ModalDialog';

const CANCEL_BUTTON =
  'px-3 py-1.5 rounded-xl border border-white/15 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold';
const CONFIRM_BUTTON =
  'px-4 py-1.5 rounded-xl bg-accent-gold hover:bg-accent-gold/90 text-ink-strong text-xs font-bold transition-colors cursor-pointer shadow-md touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold';

export function RegionSwitchDialog({
  regionLabel,
  onKeepEditing,
  onDiscard,
}: {
  regionLabel: string;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  return (
    <ModalDialog
      testId="region-switch-confirm-dialog"
      labelledBy="confirm-region-switch-title"
      describedBy="confirm-region-switch-description"
      onDismiss={onKeepEditing}
    >
      <div className="flex items-center gap-2 text-accent-gold font-bold text-sm">
        <Layers size={18} aria-hidden="true" />
        <h3 id="confirm-region-switch-title" className="text-white text-base">
          Switch document?
        </h3>
      </div>
      <p id="confirm-region-switch-description" className="text-xs text-slate-300 leading-relaxed">
        You have unsaved page changes. Switching to “{regionLabel}” will discard them. This cannot be
        undone.
      </p>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
        <button type="button" onClick={onKeepEditing} className={CANCEL_BUTTON}>
          Keep editing
        </button>
        <button type="button" onClick={onDiscard} className={CONFIRM_BUTTON}>
          Discard and switch
        </button>
      </div>
    </ModalDialog>
  );
}

export function DeleteSectionsDialog({
  indexes,
  sectionLabel,
  saving,
  onCancel,
  onConfirm,
}: {
  indexes: number[];
  sectionLabel: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const count = indexes.length;
  return (
    <ModalDialog
      testId="block-delete-confirm-dialog"
      labelledBy="confirm-delete-dialog-title"
      describedBy="confirm-delete-dialog-description"
      onDismiss={onCancel}
    >
      <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
        <Trash2 size={18} />
        <h3 id="confirm-delete-dialog-title" className="text-white text-base">
          {count === 1 ? 'Delete Section?' : `Delete ${count} Sections?`}
        </h3>
      </div>
      <p id="confirm-delete-dialog-description" className="text-xs text-slate-300 leading-relaxed">
        {count === 1
          ? `Are you sure you want to delete “${sectionLabel || 'this section'}”? Undo will be available in this session.`
          : `Are you sure you want to delete ${count} selected sections? Undo will be available in this session.`}
      </p>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
        <button type="button" onClick={onCancel} className={CANCEL_BUTTON}>
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          {saving ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </ModalDialog>
  );
}

export function ReorderSectionDialog({
  label,
  fromIndex,
  toIndex,
  saving,
  onCancel,
  onConfirm,
}: {
  label: string;
  fromIndex: number;
  toIndex: number;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalDialog
      testId="block-reorder-confirm-dialog"
      labelledBy="confirm-reorder-dialog-title"
      describedBy="confirm-reorder-dialog-description"
      onDismiss={onCancel}
    >
      <div className="flex items-center gap-2 text-accent-gold font-bold text-sm">
        <GripVertical size={18} />
        <h3 id="confirm-reorder-dialog-title" className="text-white text-base">
          Confirm Move Section?
        </h3>
      </div>
      <p id="confirm-reorder-dialog-description" className="text-xs text-slate-300 leading-relaxed">
        Move “{label}” from position #{fromIndex + 1} to #{toIndex + 1}? This will update the page
        layout order.
      </p>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
        <button type="button" onClick={onCancel} className={CANCEL_BUTTON}>
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className={`${CONFIRM_BUTTON} disabled:opacity-50`}
        >
          {saving ? 'Moving…' : 'Confirm Move'}
        </button>
      </div>
    </ModalDialog>
  );
}

export function RouteLeaveDialog({
  pathname,
  onStay,
  onDiscard,
}: {
  pathname: string;
  onStay: () => void;
  onDiscard: () => void;
}) {
  return (
    <ModalDialog
      testId="route-leave-confirm-dialog"
      labelledBy="confirm-route-leave-title"
      describedBy="confirm-route-leave-description"
      onDismiss={onStay}
    >
      <div className="flex items-center gap-2 text-accent-gold font-bold text-sm">
        <Layers size={18} aria-hidden="true" />
        <h3 id="confirm-route-leave-title" className="text-white text-base">
          Leave this page?
        </h3>
      </div>
      <p id="confirm-route-leave-description" className="text-xs text-slate-300 leading-relaxed">
        You have unsaved page changes. Leaving for{' '}
        <code className="font-mono text-white">{pathname}</code> will discard them. This cannot be
        undone.
      </p>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
        <button type="button" onClick={onStay} className={CANCEL_BUTTON}>
          Stay on this page
        </button>
        <button type="button" onClick={onDiscard} className={CONFIRM_BUTTON}>
          Discard and leave
        </button>
      </div>
    </ModalDialog>
  );
}
