'use client';

import type { Block } from '@/lib/blocks';
import { RichTextBlockEditor } from './RichTextEditor';

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
    <RichTextBlockEditor
      id={quoteTextId}
      label="Quote Content"
      value={currentBlock.html}
      onChange={(html) => setCurrentBlock({ ...currentBlock, html })}
      placeholder="Write the quote…"
      variant="quote"
    />
  );
}
