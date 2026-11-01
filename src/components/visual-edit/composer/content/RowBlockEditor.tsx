'use client';

import { ChevronDown, ChevronUp, Columns3, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import {
  type Block,
  type ContentBlock,
  type InsertableBlockType,
  MAX_ROW_COLUMNS,
  MIN_ROW_COLUMNS,
  type RowBlock,
  stripTags,
} from '@/lib/blocks';
import { StudioSection } from '../ui';
import { LeafContentStudio } from './LeafContentStudio';

/** What the add-block menu offers inside a column. `unsupported` is a parse fallback. */
const COLUMN_BLOCK_OPTIONS: readonly { kind: InsertableBlockType; label: string }[] = [
  { kind: 'paragraph', label: 'Paragraph' },
  { kind: 'heading', label: 'Heading' },
  { kind: 'bulletList', label: 'Bullet list' },
  { kind: 'orderedList', label: 'Numbered list' },
  { kind: 'quote', label: 'Quote' },
  { kind: 'callout', label: 'Callout' },
  { kind: 'code', label: 'Code' },
  { kind: 'image', label: 'Image' },
  { kind: 'button', label: 'Button' },
  { kind: 'divider', label: 'Divider' },
  { kind: 'table', label: 'Table' },
] as const;

const TYPE_FALLBACK: Record<ContentBlock['type'], string> = {
  paragraph: 'Paragraph',
  heading: 'Heading',
  bulletList: 'Bullet list',
  orderedList: 'Numbered list',
  quote: 'Quote',
  callout: 'Callout',
  code: 'Code',
  image: 'Image',
  divider: 'Divider',
  table: 'Table',
  button: 'Button',
  unsupported: 'Preserved markup',
};

/**
 * A nested block's row label.
 *
 * The text is the point: two paragraphs in a column are indistinguishable when
 * both read "Paragraph", so a block with copy is named by its copy and only an
 * empty one falls back to its type.
 */
function leafLabel(block: ContentBlock): string {
  const text = stripTags(
    block.type === 'image'
      ? block.alt || block.caption
      : block.type === 'button'
        ? block.label
        : block.type === 'table'
          ? block.head.join(' ')
          : 'html' in block
            ? block.html
            : block.type === 'code'
              ? block.text
              : ''
  )
    .replace(/\s+/g, ' ')
    .trim();
  if (text) return text.length > 48 ? `${text.slice(0, 48)}…` : text;
  return TYPE_FALLBACK[block.type];
}

export interface RowBlockEditorProps {
  currentBlock: RowBlock;
  setCurrentBlock: (block: Block) => void;
  /** Append an empty column, keeping every existing column where it is. */
  onAddColumn: () => void;
  /** Remove the column at this position; the studio owns the merge. */
  onRemoveColumn: (columnIndex: number) => void;
  onAddBlock: (columnIndex: number, kind: InsertableBlockType) => void;
  /**
   * Move a block to an index within its own column.
   *
   * One operation for the drag and for the arrow keys, so the two halves of the
   * same control cannot disagree about what a move is — and neither can leave
   * an undo step the other does not.
   */
  onReorderBlock: (columnIndex: number, blockId: string, targetIndex: number) => void;
  onRemoveBlock: (blockId: string) => void;
}

/**
 * The row's own editor: columns, the blocks inside them, and their order.
 *
 * A nested block is edited *here*, inside the row, rather than by promoting it
 * to the page selection. Promotion would mean the row's style studios — the
 * reason the row is selected — disappeared the moment an author clicked its
 * text, and the author would have to find the row again to give it a
 * background. The sub-panel keeps the row selected and still offers the full
 * leaf editor, through the same component the page-level leaf uses.
 */
export function RowBlockEditor({
  currentBlock,
  setCurrentBlock,
  onAddColumn,
  onRemoveColumn,
  onAddBlock,
  onReorderBlock,
  onRemoveBlock,
}: RowBlockEditorProps) {
  const addBlockId = useId();
  const [editingLeafId, setEditingLeafId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const columnCount = currentBlock.columns.length;
  const canRemoveColumn = columnCount > MIN_ROW_COLUMNS;

  const updateLeaf = (blockId: string, next: ContentBlock) => {
    setCurrentBlock({
      ...currentBlock,
      columns: currentBlock.columns.map((column) => ({
        ...column,
        blocks: column.blocks.map((child) => (child.id === blockId ? next : child)),
      })),
    });
  };

  return (
    <div className="space-y-4">
      <StudioSection
        title="Row Layout"
        badge={`${columnCount} ${columnCount === 1 ? 'column' : 'columns'}`}
        description="A row lays blocks side by side. Columns hold one level of blocks; a row cannot nest inside a row."
        action={
          <div className="flex items-center gap-1">
            <span className="min-w-6 text-center font-mono text-xs font-bold text-accent-gold">
              {columnCount}
            </span>
            <button
              type="button"
              aria-label="Add column"
              title={
                columnCount < MAX_ROW_COLUMNS
                  ? 'Add a column'
                  : `A row holds at most ${MAX_ROW_COLUMNS} columns`
              }
              disabled={columnCount >= MAX_ROW_COLUMNS}
              onClick={onAddColumn}
              className="inline-flex size-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={12} />
            </button>
          </div>
        }
      >
        {/*
          Stacked, not side by side: the inspector is ~380px wide, and three
          grid cells in it are three one-word columns. The layout is shown in
          the mini preview above; the editor is where each column is read and
          filled, and the column cards are what make that legible at this width.
        */}
        <div className="space-y-2">
          {currentBlock.columns.map((column, columnIndex) => (
            <div
              key={column.id}
              data-testid={`row-column-${columnIndex}`}
              className="min-w-0 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Columns3 size={10} className="text-accent-gold" />
                  Column {columnIndex + 1}
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400">
                    {column.blocks.length} {column.blocks.length === 1 ? 'block' : 'blocks'}
                  </span>
                  {/* A row-level control could only ever remove the last column. */}
                  <button
                    type="button"
                    aria-label={
                      canRemoveColumn
                        ? `Remove column ${columnIndex + 1} of ${columnCount}`
                        : `Remove column ${columnIndex + 1} of ${columnCount} (a row needs at least one column)`
                    }
                    title={
                      !canRemoveColumn
                        ? 'A row needs at least one column'
                        : columnIndex === 0
                          ? 'Remove column 1 and move its blocks into the column on its right'
                          : `Remove column ${columnIndex + 1} and move its blocks into column ${columnIndex}`
                    }
                    disabled={!canRemoveColumn}
                    onClick={() => onRemoveColumn(columnIndex)}
                    className="inline-flex size-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-rose-500/20 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              </div>

              {column.blocks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/10 px-2 py-3 text-center text-[10px] leading-relaxed text-slate-400">
                  Empty column. Add a block below.
                </p>
              ) : (
                <ul className="m-0 list-none space-y-1 p-0">
                  {column.blocks.map((child, childIndex) => {
                    const editing = editingLeafId === child.id;
                    return (
                      <li
                        key={child.id}
                        data-testid={`row-block-${columnIndex}-${childIndex}`}
                        onDragOver={(event) => {
                          if (!draggingId || draggingId === child.id) return;
                          // Reordering is within a column. A drag into another
                          // column has no target to describe, so it is refused
                          // here rather than accepted and silently discarded.
                          if (!column.blocks.some((block) => block.id === draggingId)) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(event) => {
                          if (!draggingId || draggingId === child.id) return;
                          if (!column.blocks.some((block) => block.id === draggingId)) return;
                          event.preventDefault();
                          onReorderBlock(columnIndex, draggingId, childIndex);
                          setDraggingId(null);
                        }}
                        className={`rounded-lg border border-white/10 bg-white/[0.04] ${
                          draggingId === child.id ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1 p-1">
                          {/*
                            Mouse drag, with the arrow keys beside it as the
                            keyboard path. The handle is not a button: it has no
                            action on click, and announcing one would promise
                            keyboard support it does not have.
                          */}
                          <span
                            draggable
                            aria-hidden
                            title={`Drag ${leafLabel(child)} to reorder`}
                            onDragStart={(event) => {
                              setDraggingId(child.id);
                              event.dataTransfer.effectAllowed = 'move';
                              // Firefox will not start a native drag without
                              // data on the transfer; the id is never read on
                              // drop (the component owns the state), but its
                              // presence is what makes the gesture begin.
                              event.dataTransfer.setData('text/plain', child.id);
                            }}
                            onDragEnd={() => setDraggingId(null)}
                            className="cursor-grab p-0.5 text-slate-400 hover:text-white active:cursor-grabbing"
                          >
                            <GripVertical size={11} />
                          </span>
                          <button
                            type="button"
                            aria-expanded={editing}
                            aria-label={`Edit ${leafLabel(child)} content`}
                            onClick={() => setEditingLeafId(editing ? null : child.id)}
                            className={`min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left text-[10px] transition-colors ${
                              editing
                                ? 'text-accent-gold'
                                : 'text-slate-200 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span className="font-mono text-[8px] uppercase tracking-wide text-slate-400">
                              {TYPE_FALLBACK[child.type]}
                            </span>{' '}
                            {leafLabel(child)}
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${leafLabel(child)} up`}
                            disabled={childIndex === 0}
                            onClick={() => onReorderBlock(columnIndex, child.id, childIndex - 1)}
                            className="inline-flex size-5 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${leafLabel(child)} down`}
                            disabled={childIndex === column.blocks.length - 1}
                            onClick={() => onReorderBlock(columnIndex, child.id, childIndex + 1)}
                            className="inline-flex size-5 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronDown size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${leafLabel(child)}`}
                            onClick={() => {
                              if (editing) setEditingLeafId(null);
                              onRemoveBlock(child.id);
                            }}
                            className="inline-flex size-5 items-center justify-center rounded text-slate-400 hover:bg-rose-500/20 hover:text-rose-200"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                        {editing && (
                          <div className="border-t border-white/10 p-2">
                            <LeafContentStudio
                              currentBlock={child}
                              setCurrentBlock={(next) => {
                                // The row bound in one line: a leaf editor has no
                                // row control, so this only refuses a shape that
                                // could not have come from its controls.
                                if (next.type !== 'row') updateLeaf(child.id, next);
                              }}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <label htmlFor={`${addBlockId}-${columnIndex}`} className="sr-only">
                Add a block to column {columnIndex + 1}
              </label>
              <select
                id={`${addBlockId}-${columnIndex}`}
                aria-label={`Add a block to column ${columnIndex + 1}`}
                value=""
                onChange={(event) => {
                  const kind = event.target.value as InsertableBlockType | '';
                  if (kind) onAddBlock(columnIndex, kind);
                }}
                className="w-full cursor-pointer rounded-lg border border-white/10 bg-white/5 px-1.5 py-1 text-[10px] text-slate-200 focus:border-accent-gold/50 focus:outline-none"
              >
                <option value="">+ Add block…</option>
                {COLUMN_BLOCK_OPTIONS.map((option) => (
                  <option key={option.kind} value={option.kind}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </StudioSection>
    </div>
  );
}
