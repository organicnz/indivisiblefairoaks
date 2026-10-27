'use client';

import type { Block } from '@/lib/blocks';

export interface UnsupportedBlockEditorProps {
  currentBlock: Extract<Block, { type: 'unsupported' }>;
  setCurrentBlock: (block: Block) => void;
  unsupportedHtmlId?: string;
}

export function UnsupportedBlockEditor({
  currentBlock,
  setCurrentBlock,
  unsupportedHtmlId,
}: UnsupportedBlockEditorProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={unsupportedHtmlId} className="block text-slate-300 font-bold">
        Raw HTML Markup
      </label>
      <textarea
        id={unsupportedHtmlId}
        rows={8}
        value={currentBlock.html}
        onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
        placeholder="<div>...</div>"
        className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sky-400 placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
      />
    </div>
  );
}
