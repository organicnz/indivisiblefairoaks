import {
  type Block,
  type ContentBlock,
  type LeafBlockType,
  nextBlockId,
  type RowBlock,
  type RowColumn,
} from './types';

/** More than three columns stop being readable at the composer's page width. */
export const MAX_ROW_COLUMNS = 3;
export const MIN_ROW_COLUMNS = 1;

/** Block types an author can add. `unsupported` is a parse fallback, not a choice. */
export type InsertableBlockType = Exclude<LeafBlockType, 'unsupported'>;

/**
 * An empty column.
 *
 * The id is generated here rather than by the caller because a row editor
 * creates columns and nested blocks in the same gesture, and a caller that had
 * to remember both would eventually forget one.
 */
export function createRowColumn(blocks: ContentBlock[] = []): RowColumn {
  return { id: nextBlockId(), blocks };
}

/**
 * A row with the requested number of empty columns.
 *
 * Clamped rather than trusted: a count of zero would serialize a grid with no
 * cells, which parses back as a malformed row and becomes unsupported markup.
 * A count above the maximum is almost always a typo for the maximum.
 */
export function createRowBlock(id: string, columnCount = 2): RowBlock {
  const count = Math.min(
    MAX_ROW_COLUMNS,
    Math.max(MIN_ROW_COLUMNS, Number.isFinite(columnCount) ? Math.trunc(columnCount) : 2)
  );
  return {
    id,
    type: 'row',
    columns: Array.from({ length: count }, () => createRowColumn()),
  };
}

/**
 * The starting content for one insertable block.
 *
 * This used to live in the overlay's Add Block switch and, separately, in the
 * element library. The row editor is the third caller, and a row whose columns
 * got different defaults from the page is not a second style of block — it is
 * the same block, inserted somewhere else.
 */
export function createContentBlock(type: InsertableBlockType, id = nextBlockId()): ContentBlock {
  switch (type) {
    case 'paragraph':
      return { id, type: 'paragraph', html: 'Add section copy here...' };
    case 'heading':
      return { id, type: 'heading', level: 2, html: 'New Section Heading' };
    case 'bulletList':
      return { id, type: 'bulletList', items: ['Action item 1', 'Action item 2'] };
    case 'orderedList':
      return { id, type: 'orderedList', items: ['Step 1', 'Step 2'] };
    case 'table':
      return {
        id,
        type: 'table',
        head: ['Column A', 'Column B'],
        rows: [
          ['Row 1', 'Row 1'],
          ['Row 2', 'Row 2'],
        ],
      };
    case 'callout':
      return { id, type: 'callout', tone: 'info', html: 'Important civic action note.' };
    case 'image':
      return {
        id,
        type: 'image',
        src: '',
        alt: 'Image description',
        caption: '',
        width: null,
        height: null,
      };
    case 'button':
      return { id, type: 'button', label: 'Take Action', href: '/take-action' };
    case 'quote':
      return { id, type: 'quote', html: 'Inspiring constituent quote.' };
    case 'divider':
      return { id, type: 'divider' };
    case 'code':
      return { id, type: 'code', text: '// inline code block' };
  }
}

/**
 * Copy a block with new ids all the way down.
 *
 * A shallow `{ ...block, id }` duplicate leaves the row's columns and nested
 * blocks sharing ids with the original. The editor addresses nested blocks by
 * id, so editing the copy would edit the original's child. `handleImportPageJson`
 * has the same problem from the other direction: ids read out of a file can
 * collide with ids already on the page.
 */
export function cloneBlockWithFreshIds(block: Block): Block {
  const id = nextBlockId();
  if (block.type !== 'row') return { ...block, id };
  return {
    ...block,
    id,
    columns: block.columns.map((column) => ({
      id: nextBlockId(),
      blocks: column.blocks.map((child) => ({ ...child, id: nextBlockId() })),
    })),
  };
}

export function isRowBlock(block: Block): block is RowBlock {
  return block.type === 'row';
}
