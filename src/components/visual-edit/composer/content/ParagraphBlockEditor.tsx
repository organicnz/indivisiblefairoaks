'use client';

import type { Block } from '@/lib/blocks';
import { RichTextBlockEditor } from './RichTextEditor';

export interface ParagraphBlockEditorProps {
  currentBlock: Extract<Block, { type: 'paragraph' }>;
  setCurrentBlock: (block: Block) => void;
  paragraphTextId?: string;
}

/**
 * A paragraph is inline HTML, so it gets the visual editor rather than a
 * textarea. The raw-HTML toggle inside the editor is the escape hatch for the
 * markup a visual surface does not model.
 */
export function ParagraphBlockEditor({
  currentBlock,
  setCurrentBlock,
  paragraphTextId,
}: ParagraphBlockEditorProps) {
  return (
    <RichTextBlockEditor
      id={paragraphTextId}
      label="Paragraph"
      value={currentBlock.html}
      onChange={(html) => setCurrentBlock({ ...currentBlock, html })}
      placeholder="Write a paragraph…"
      variant="paragraph"
    />
  );
}
