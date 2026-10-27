'use client';

import { RotateCcw } from 'lucide-react';
import type { VisualComposerMode } from '@/types/unified';

export interface InspectorFooterProps {
  inspectorMode: VisualComposerMode;
  onResetStyles: () => void;
  onClose: () => void;
  onApply: () => void;
}

export function InspectorFooter({
  inspectorMode,
  onResetStyles,
  onClose,
  onApply,
}: InspectorFooterProps) {
  return (
    <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/80 px-5 py-3">
      <button
        type="button"
        onClick={onResetStyles}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <RotateCcw size={13} />
        <span>Reset Styles</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onApply}
          className="rounded-xl bg-accent-gold px-4 py-1.5 text-xs font-bold text-ink-strong hover:bg-accent-gold/90 transition-colors shadow-lg font-black cursor-pointer"
        >
          {inspectorMode === 'section' ? 'Save Section' : 'Save Block'}
        </button>
      </div>
    </div>
  );
}
