'use client';

import type { Block } from '@/lib/blocks';

export interface CodeBlockEditorProps {
  currentBlock: Extract<Block, { type: 'code' }>;
  setCurrentBlock: (block: Block) => void;
  codeTextId?: string;
}

export function CodeBlockEditor({
  currentBlock,
  setCurrentBlock,
  codeTextId,
}: CodeBlockEditorProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={codeTextId} className="block text-slate-300 font-bold">
        Code Snippet
      </label>
      <textarea
        id={codeTextId}
        rows={6}
        value={currentBlock.text}
        onChange={(e) => setCurrentBlock({ ...currentBlock, text: e.target.value })}
        placeholder="console.log('Civic action');"
        className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-emerald-400 placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
      />
    </div>
  );
}
