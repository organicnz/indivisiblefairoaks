'use client';

import {
  type Block,
  createContentBlock,
  type InsertableBlockType,
  MAX_ROW_COLUMNS,
  MIN_ROW_COLUMNS,
  type RowBlock,
} from '@/lib/blocks';
import { createRowColumn } from '@/lib/blocks/create';
import {
  BlockTypeConverter,
  ButtonBlockEditor,
  CalloutBlockEditor,
  CodeBlockEditor,
  DividerBlockEditor,
  HeadingBlockEditor,
  ImageBlockEditor,
  ListBlockEditor,
  ParagraphBlockEditor,
  QuoteBlockEditor,
  TableBlockEditor,
  UnsupportedBlockEditor,
} from './content';
import { LeafContentStudio } from './content/LeafContentStudio';
import { RowBlockEditor } from './content/RowBlockEditor';

export {
  BlockTypeConverter,
  ButtonBlockEditor,
  CalloutBlockEditor,
  CodeBlockEditor,
  DividerBlockEditor,
  HeadingBlockEditor,
  ImageBlockEditor,
  ListBlockEditor,
  ParagraphBlockEditor,
  QuoteBlockEditor,
  TableBlockEditor,
  UnsupportedBlockEditor,
};

export interface BlockContentStudioProps {
  currentBlock: Block;
  setCurrentBlock: (block: Block) => void;
  headingTextId?: string;
  paragraphTextId?: string;
  imageSrcId?: string;
  imageAltId?: string;
  imageCaptionId?: string;
  buttonLabelId?: string;
  buttonHrefId?: string;
  calloutTextId?: string;
  quoteTextId?: string;
  listItemsId?: string;
  codeTextId?: string;
  tableHeadId?: string;
  tableRowsId?: string;
  unsupportedHtmlId?: string;
}

/**
 * The Content tab for whatever block is selected.
 *
 * A row is a different editor, not a different set of fields: its content is
 * the columns and the blocks inside them, and every one of those operations
 * produces a new `RowBlock` through the same `setCurrentBlock` the leaf editors
 * use. That is what keeps the row on the panel's normal save/undo path — a row
 * that took a side door to the page would be the one block whose edits Escape
 * did not guard.
 */
export function BlockContentStudio({
  currentBlock,
  setCurrentBlock,
  ...leafIds
}: BlockContentStudioProps) {
  if (currentBlock.type !== 'row') {
    return (
      <LeafContentStudio
        currentBlock={currentBlock}
        setCurrentBlock={setCurrentBlock}
        {...leafIds}
      />
    );
  }

  const resize = (count: number) => {
    if (count === currentBlock.columns.length) return;
    setCurrentBlock(resizeRow(currentBlock, count));
  };

  const addBlock = (columnIndex: number, kind: InsertableBlockType) => {
    setCurrentBlock({
      ...currentBlock,
      columns: currentBlock.columns.map((column, index) =>
        index === columnIndex
          ? { ...column, blocks: [...column.blocks, createContentBlock(kind)] }
          : column
      ),
    });
  };

  const reorderBlock = (columnIndex: number, blockId: string, targetIndex: number) => {
    const column = currentBlock.columns[columnIndex];
    if (!column) return;
    const from = column.blocks.findIndex((child) => child.id === blockId);
    if (from === -1 || from === targetIndex) return;
    if (targetIndex < 0 || targetIndex >= column.blocks.length) return;
    const blocks = [...column.blocks];
    const [moved] = blocks.splice(from, 1);
    blocks.splice(targetIndex, 0, moved);
    setCurrentBlock({
      ...currentBlock,
      columns: currentBlock.columns.map((item, index) =>
        index === columnIndex ? { ...item, blocks } : item
      ),
    });
  };

  const removeBlock = (blockId: string) => {
    setCurrentBlock({
      ...currentBlock,
      columns: currentBlock.columns.map((column) => ({
        ...column,
        blocks: column.blocks.filter((child) => child.id !== blockId),
      })),
    });
  };

  return (
    <RowBlockEditor
      currentBlock={currentBlock}
      setCurrentBlock={setCurrentBlock}
      onColumnsChange={resize}
      onAddBlock={addBlock}
      onReorderBlock={reorderBlock}
      onRemoveBlock={removeBlock}
    />
  );
}

/**
 * Resize a row without losing a column's blocks.
 *
 * Removing a column used to drop whatever it held, which is a destructive
 * consequence of a layout control — the blocks were authored, and a grid that is
 * one column narrower is not a reason to delete them. They move into the column
 * before them, which is the only merge that keeps document order. Adding a
 * column appends an empty one; growing never moves anything.
 *
 * Clamped at both ends because the serializer and the parser both assume a row
 * has at least one column, and a fourth column stops being readable at the
 * composer's page width.
 */
function resizeRow(row: RowBlock, requested: number): RowBlock {
  const count = Math.min(MAX_ROW_COLUMNS, Math.max(MIN_ROW_COLUMNS, requested));
  if (count === row.columns.length) return row;

  if (count < row.columns.length) {
    const kept = row.columns.slice(0, count).map((column) => ({ ...column }));
    for (const dropped of row.columns.slice(count)) {
      const last = kept[kept.length - 1];
      last.blocks = [...last.blocks, ...dropped.blocks];
    }
    return { ...row, columns: kept };
  }

  return {
    ...row,
    columns: [
      ...row.columns,
      ...Array.from({ length: count - row.columns.length }, () => createRowColumn()),
    ],
  };
}
