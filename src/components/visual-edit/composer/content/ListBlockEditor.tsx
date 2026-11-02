'use client';

import type { Block } from '@/lib/blocks';
import { RichTextListEditor } from './RichTextEditor';

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
    <RichTextListEditor
      id={listItemsId}
      ordered={currentBlock.type === 'orderedList'}
      items={currentBlock.items}
      onChange={(items) => setCurrentBlock({ ...currentBlock, items })}
      confirmDelete={true}
    />
  );
}
