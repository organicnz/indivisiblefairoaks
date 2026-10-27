'use client';

import type { Block } from '@/lib/blocks';

export interface ListBlockEditorProps {
  currentBlock: Extract<Block, { type: 'bulletList' | 'orderedList' }>;
  setCurrentBlock: (block: Block) => void;
  listItemsId?: string;
}

export function ListBlockEditor({
  currentBlock,
  setCurrentBlock,
  listItemsId,
}: ListBlockEditorProps) {
  return (
    <div>
      <label htmlFor={listItemsId} className="block text-slate-300 font-bold mb-1">
        List Items (one per line)
      </label>
      <textarea
        id={listItemsId}
        rows={6}
        value={currentBlock.items.join('\n')}
        onChange={(e) => setCurrentBlock({ ...currentBlock, items: e.target.value.split('\n') })}
        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono"
      />
    </div>
  );
}
