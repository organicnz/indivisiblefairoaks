'use client';

import type { Block } from '@/lib/blocks';

export interface ParagraphBlockEditorProps {
  currentBlock: Extract<Block, { type: 'paragraph' }>;
  setCurrentBlock: (block: Block) => void;
  paragraphTextId?: string;
}

export function ParagraphBlockEditor({
  currentBlock,
  setCurrentBlock,
  paragraphTextId,
}: ParagraphBlockEditorProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={paragraphTextId} className="block text-slate-300 font-bold">
        Paragraph HTML / Content
      </label>
      <textarea
        id={paragraphTextId}
        rows={6}
        value={currentBlock.html}
        onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/40 font-mono text-[11px]"
      />
      <p className="text-[10px] text-slate-400">Supports rich inline HTML tags.</p>
    </div>
  );
}
