'use client';

import type { Block } from '@/lib/blocks';

export interface QuoteBlockEditorProps {
  currentBlock: Extract<Block, { type: 'quote' }>;
  setCurrentBlock: (block: Block) => void;
  quoteTextId?: string;
}

export function QuoteBlockEditor({
  currentBlock,
  setCurrentBlock,
  quoteTextId,
}: QuoteBlockEditorProps) {
  return (
    <div>
      <label htmlFor={quoteTextId} className="block text-slate-300 font-bold mb-1">
        Quote Content
      </label>
      <textarea
        id={quoteTextId}
        rows={4}
        value={currentBlock.html}
        onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none"
      />
    </div>
  );
}
