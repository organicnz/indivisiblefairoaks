'use client';

import type { Block } from '@/lib/blocks';

export interface CalloutBlockEditorProps {
  currentBlock: Extract<Block, { type: 'callout' }>;
  setCurrentBlock: (block: Block) => void;
  calloutTextId?: string;
}

export function CalloutBlockEditor({
  currentBlock,
  setCurrentBlock,
  calloutTextId,
}: CalloutBlockEditorProps) {
  return (
    <div className="space-y-3">
      <span className="block text-slate-300 font-bold">Callout Tone</span>
      <div className="flex gap-2">
        {(['info', 'action', 'warning'] as const).map((tone) => (
          <button
            key={tone}
            type="button"
            onClick={() => setCurrentBlock({ ...currentBlock, tone })}
            className={`flex-1 py-1.5 rounded-lg font-bold border capitalize transition-colors ${
              currentBlock.tone === tone
                ? 'bg-accent-gold text-ink-strong border-accent-gold font-black'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            {tone}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor={calloutTextId} className="block text-slate-300 font-bold mb-1">
          Callout Text
        </label>
        <textarea
          id={calloutTextId}
          rows={4}
          value={currentBlock.html}
          onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
          className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none"
        />
      </div>
    </div>
  );
}
