'use client';

import type { Block, HeadingLevel } from '@/lib/blocks';
import { RichTextBlockEditor } from './RichTextEditor';

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
      <span className="block font-bold text-slate-300">Heading Level</span>
      <div className="flex gap-2">
        {([1, 2, 3, 4, 5, 6] as HeadingLevel[]).map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => setCurrentBlock({ ...currentBlock, level: lvl })}
            aria-label={`Heading level ${lvl}`}
            aria-pressed={currentBlock.level === lvl}
            className={`flex-1 rounded-lg border py-1.5 font-bold transition-colors ${
              currentBlock.level === lvl
                ? 'border-accent-gold bg-accent-gold font-black text-ink-strong'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            H{lvl}
          </button>
        ))}
      </div>
      <RichTextBlockEditor
        id={headingTextId}
        label="Heading Text"
        value={currentBlock.html}
        onChange={(html) => setCurrentBlock({ ...currentBlock, html })}
        placeholder="Write the heading…"
        variant="heading"
      />
    </div>
  );
}
