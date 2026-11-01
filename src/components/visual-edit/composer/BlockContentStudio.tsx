'use client';

import {
  type Block,
  createContentBlock,
  type InsertableBlockType,
  MAX_ROW_COLUMNS,
  MIN_ROW_COLUMNS,
  rowColumnMergeTarget,
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

  const addColumn = () => {
    if (currentBlock.columns.length >= MAX_ROW_COLUMNS) return;
    setCurrentBlock({
      ...currentBlock,
      columns: [...currentBlock.columns, createRowColumn()],
    });
  };

  const removeColumn = (columnIndex: number) => {
    const columns = currentBlock.columns;
    if (columns.length <= MIN_ROW_COLUMNS || columnIndex < 0 || columnIndex >= columns.length) {
      return;
    }

    const nextColumns = [...columns];
    const [removed] = nextColumns.splice(columnIndex, 1);
    const { index: targetIndex, side } = rowColumnMergeTarget(columnIndex);
    const target = nextColumns[targetIndex];
    nextColumns[targetIndex] = {
      ...target,
      blocks:
        side === 'left'
          ? [...target.blocks, ...removed.blocks]
          : [...removed.blocks, ...target.blocks],
    };

    setCurrentBlock({ ...currentBlock, columns: nextColumns });
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
      onAddColumn={addColumn}
      onRemoveColumn={removeColumn}
      onAddBlock={addBlock}
      onReorderBlock={reorderBlock}
      onRemoveBlock={removeBlock}
    />
  );
}
