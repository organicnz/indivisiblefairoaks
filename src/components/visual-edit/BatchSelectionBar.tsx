'use client';

import { Layers, Sparkles, Trash2, X } from 'lucide-react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';

export function BatchSelectionBar({
  count,
  saving,
  onStyleTogether,
  onDeleteSelected,
  onClear,
}: {
  count: number;
  saving: boolean;
  onStyleTogether: () => void;
  onDeleteSelected: () => void;
  onClear: () => void;
}) {
  return (

    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent-gold/50 bg-secondary/95 px-3 py-2 text-white shadow-float backdrop-blur-md"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-accent-gold">
        <Layers size={13} />
        {count} blocks selected
      </span>
      <span className="h-4 w-px bg-white/20" aria-hidden="true" />
      {/**
       * Block mode, not section mode: the tabs that hold the design
       * controls (Presets, Box Model, Type) only render in block mode, so
       * opening the batch in section mode would hide every control the
       * batch exists for.
       */}
      <button
        type="button"
        onClick={() => onStyleTogether()}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-accent-gold px-3 py-1 text-[11px] font-black text-ink-strong transition-colors hover:bg-accent-gold/90"
      >
        <Sparkles size={12} />
        <span>Style together</span>
      </button>
      <ConfirmAction
        label="Delete selected blocks"
        message={`Delete ${count} blocks?`}
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        danger
        busy={saving}
        idleClassName="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 px-3 py-1 text-[11px] font-black text-rose-200 transition-colors hover:bg-rose-500 hover:text-white"
        onConfirm={onDeleteSelected}
      >
        <Trash2 size={12} />
        <span>Delete selected</span>
      </ConfirmAction>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear block selection"
        className="rounded-full p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
      >
        <X size={13} />
      </button>
    </div>
  );
}
