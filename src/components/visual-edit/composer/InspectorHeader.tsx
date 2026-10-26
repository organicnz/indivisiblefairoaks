'use client';

import {
  Box,
  ClipboardCopy,
  ClipboardPaste,
  LayoutTemplate,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
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
}: InspectorHeaderProps) {
  return (
    <>
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-gold/20 text-accent-gold">
            <SlidersHorizontal size={15} />
          </div>
          <div>
            <h2 id={titleId} className="text-sm font-bold text-white tracking-wide">
              Visual Composer Inspector
            </h2>
            <p id={descId} className="text-[11px] text-slate-400 capitalize">
              Block #{blockIndex + 1} · {blockType}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
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
            title="Reset styles to defaults"
            aria-label="Reset styles to defaults"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border border-white/10 bg-white/5 text-slate-300 hover:text-accent-gold hover:bg-white/10 transition-colors"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>

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
