'use client';

import type { Block, HeadingLevel } from '@/lib/blocks';

export interface HeadingBlockEditorProps {
  currentBlock: Extract<Block, { type: 'heading' }>;
  setCurrentBlock: (block: Block) => void;
  headingTextId?: string;
}

export function HeadingBlockEditor({
  currentBlock,
  setCurrentBlock,
  headingTextId,
}: HeadingBlockEditorProps) {
  return (
    <div className="space-y-3">
      <span className="block text-slate-300 font-bold">Heading Level</span>
      <div className="flex gap-2">
        {([1, 2, 3, 4, 5, 6] as HeadingLevel[]).map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => setCurrentBlock({ ...currentBlock, level: lvl })}
            className={`flex-1 py-1.5 rounded-lg font-bold border transition-colors ${
              currentBlock.level === lvl
                ? 'bg-accent-gold text-ink-strong border-accent-gold font-black'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            H{lvl}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor={headingTextId} className="block text-slate-300 font-bold mb-1">
          Heading Text
        </label>
        <textarea
          id={headingTextId}
          rows={3}
          value={currentBlock.html}
          onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
          className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/40"
        />
      </div>
    </div>
  );
}
