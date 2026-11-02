'use client';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  Grid,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import type { Block } from '@/lib/blocks';
import { StudioInput, StudioSection } from '../ui';

export interface TableBlockEditorProps {
  currentBlock: Extract<Block, { type: 'table' }>;
  setCurrentBlock: (block: Block) => void;
  tableHeadId?: string;
  tableRowsId?: string;
}

export function TableBlockEditor({
  currentBlock,
  setCurrentBlock,
  tableHeadId,
  tableRowsId,
}: TableBlockEditorProps) {
  const [editorMode, setEditorMode] = useState<'visual' | 'raw'>('visual');
  const [draggingRowIndex, setDraggingRowIndex] = useState<number | null>(null);
  const [draggingColIndex, setDraggingColIndex] = useState<number | null>(null);

  const head = currentBlock.head ?? [];
  const rows = currentBlock.rows ?? [];

  // --- Atomic Column Operations ---
  const handleAddColumn = () => {
    const nextHead = [...head, `Column ${head.length + 1}`];
    const nextRows = rows.map((r) => [...r, '']);
    setCurrentBlock({
      ...currentBlock,
      head: nextHead,
      rows: nextRows,
    });
  };

  const handleUpdateColumnHeader = (colIndex: number, text: string) => {
    const nextHead = head.map((h, i) => (i === colIndex ? text : h));
    setCurrentBlock({
      ...currentBlock,
      head: nextHead,
    });
  };

  const handleDeleteColumn = (colIndex: number) => {
    if (head.length <= 1) return;
    const nextHead = head.filter((_, i) => i !== colIndex);
    const nextRows = rows.map((r) => r.filter((_, i) => i !== colIndex));
    setCurrentBlock({
      ...currentBlock,
      head: nextHead,
      rows: nextRows,
    });
  };

  const handleMoveColumn = (fromIndex: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (targetIndex < 0 || targetIndex >= head.length) return;
    handleReorderColumn(fromIndex, targetIndex);
  };

  const handleReorderColumn = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= head.length || toIndex >= head.length) return;
    const nextHead = [...head];
    const [movedCol] = nextHead.splice(fromIndex, 1);
    if (!movedCol) return;
    nextHead.splice(toIndex, 0, movedCol);

    const nextRows = rows.map((r) => {
      const nextR = [...r];
      while (nextR.length < head.length) nextR.push('');
      const [movedCell] = nextR.splice(fromIndex, 1);
      nextR.splice(toIndex, 0, movedCell ?? '');
      return nextR;
    });

    setCurrentBlock({
      ...currentBlock,
      head: nextHead,
      rows: nextRows,
    });
  };

  // --- Atomic Row Operations ---
  const handleAddRow = () => {
    const newRow = Array.from({ length: Math.max(1, head.length) }, () => '');
    setCurrentBlock({
      ...currentBlock,
      rows: [...rows, newRow],
    });
  };

  const handleUpdateCell = (rowIndex: number, colIndex: number, value: string) => {
    const nextRows = rows.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;
      const nextRow = [...row];
      while (nextRow.length <= colIndex) nextRow.push('');
      nextRow[colIndex] = value;
      return nextRow;
    });
    setCurrentBlock({
      ...currentBlock,
      rows: nextRows,
    });
  };

  const handleDeleteRow = (rowIndex: number) => {
    const nextRows = rows.filter((_, i) => i !== rowIndex);
    setCurrentBlock({
      ...currentBlock,
      rows: nextRows,
    });
  };

  const handleMoveRow = (fromIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    const nextRows = [...rows];
    const temp = nextRows[fromIndex];
    nextRows[fromIndex] = nextRows[targetIndex];
    nextRows[targetIndex] = temp;
    setCurrentBlock({
      ...currentBlock,
      rows: nextRows,
    });
  };

  const handleReorderRow = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length || toIndex >= rows.length) return;
    const nextRows = [...rows];
    const [moved] = nextRows.splice(fromIndex, 1);
    if (!moved) return;
    nextRows.splice(toIndex, 0, moved);
    setCurrentBlock({
      ...currentBlock,
      rows: nextRows,
    });
  };

  const columnItems = head.map((colName, colIdx) => ({
    key: `col-head-pos-${colIdx}`,
    colName,
    colIdx,
  }));

  const rowItems = rows.map((row, rowIdx) => ({
    key: `table-row-pos-${rowIdx}`,
    row,
    rowIdx,
    cellFields: head.map((colHeader, colIdx) => ({
      key: `table-cell-pos-${rowIdx}-${colIdx}`,
      colHeader,
      colIdx,
      value: row[colIdx] ?? '',
    })),
  }));

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          Table Data Studio
        </span>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setEditorMode('visual')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer ${
              editorMode === 'visual'
                ? 'bg-accent-gold text-ink-strong shadow-xs font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Grid size={11} />
            <span>Visual Elements</span>
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('raw')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer ${
              editorMode === 'raw'
                ? 'bg-accent-gold text-ink-strong shadow-xs font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText size={11} />
            <span>Raw CSV</span>
          </button>
        </div>
      </div>

      {editorMode === 'visual' ? (
        <div className="space-y-4">
          {/* Columns Section */}
          <StudioSection
            title="Table Columns"
            badge={`${head.length} ${head.length === 1 ? 'col' : 'cols'}`}
            description="Manage headers. Deleting a column removes it and aligns all row data atomically."
            action={
              <button
                type="button"
                onClick={handleAddColumn}
                aria-label="Add table column"
                title="Add a column"
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <Plus size={11} />
                <span>Add Column</span>
              </button>
            }
          >
            <div className="space-y-2">
              {columnItems.map((col) => (
                <section
                  key={col.key}
                  aria-label={`Column ${col.colIdx + 1}`}
                  data-testid={`table-col-${col.colIdx}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer) {
                      e.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const raw = e.dataTransfer?.getData('text/plain');
                    const parsed = raw ? parseInt(raw, 10) : Number.NaN;
                    const from = !Number.isNaN(parsed) ? parsed : draggingColIndex;
                    if (from !== null && from !== col.colIdx) {
                      handleReorderColumn(from, col.colIdx);
                    }
                    setDraggingColIndex(null);
                  }}
                  className={`flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-1.5 transition-[border-color,background-color,box-shadow] duration-150 ${
                    draggingColIndex === col.colIdx
                      ? 'border-accent-gold/80 bg-accent-gold/5 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : ''
                  }`}
                >
                  <span
                    draggable={head.length > 1}
                    aria-hidden="true"
                    title={`Drag Column #${col.colIdx + 1} to reorder`}
                    onDragStart={(e) => {
                      setDraggingColIndex(col.colIdx);
                      if (e.dataTransfer) {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(col.colIdx));
                      }
                    }}
                    onDragEnd={() => setDraggingColIndex(null)}
                    className="cursor-grab p-0.5 text-slate-400 hover:text-white active:cursor-grabbing touch-manipulation"
                  >
                    <GripVertical size={11} />
                  </span>
                  <span className="min-w-6 text-center font-mono text-[10px] text-accent-gold font-bold">
                    C{col.colIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={col.colName}
                    onChange={(e) => handleUpdateColumnHeader(col.colIdx, e.target.value)}
                    placeholder={`Column ${col.colIdx + 1}`}
                    aria-label={`Column ${col.colIdx + 1} header`}
                    className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/30 focus:border-accent-gold/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold font-medium"
                  />
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveColumn(col.colIdx, 'left')}
                      disabled={col.colIdx === 0}
                      aria-label={`Move column ${col.colIdx + 1} left`}
                      className="inline-flex size-5 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveColumn(col.colIdx, 'right')}
                      disabled={col.colIdx === head.length - 1}
                      aria-label={`Move column ${col.colIdx + 1} right`}
                      className="inline-flex size-5 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight size={11} />
                    </button>
                    <ConfirmAction
                      label={`Delete column ${col.colIdx + 1}`}
                      message={`Delete "${col.colName || `Column ${col.colIdx + 1}`}" and its data across all rows?`}
                      confirmLabel="Delete"
                      cancelLabel="Cancel"
                      danger
                      disabled={head.length <= 1}
                      idleClassName="inline-flex size-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-rose-500/20 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-30 transition-colors cursor-pointer"
                      onConfirm={() => handleDeleteColumn(col.colIdx)}
                    >
                      <Trash2 size={11} />
                    </ConfirmAction>
                  </div>
                </section>
              ))}
            </div>
          </StudioSection>

          {/* Rows Section */}
          <StudioSection
            title="Table Data Rows"
            badge={`${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`}
            description="Manage rows and table cells. Drag rows to reorder, or delete with confirmation."
            action={
              <button
                type="button"
                onClick={handleAddRow}
                aria-label="Add table row"
                title="Add a row"
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <Plus size={11} />
                <span>Add Row</span>
              </button>
            }
          >
            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-400">
                No data rows yet. Click &quot;Add Row&quot; to begin.
              </p>
            ) : (
              <ol className="space-y-2 max-h-[360px] overflow-y-auto pr-1 list-none m-0 p-0">
                {rowItems.map((rowItem) => (
                  <li
                    key={rowItem.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer) {
                        e.dataTransfer.dropEffect = 'move';
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const raw = e.dataTransfer?.getData('text/plain');
                      const parsed = raw ? parseInt(raw, 10) : Number.NaN;
                      const from = !Number.isNaN(parsed) ? parsed : draggingRowIndex;
                      if (from !== null && from !== rowItem.rowIdx) {
                        handleReorderRow(from, rowItem.rowIdx);
                      }
                      setDraggingRowIndex(null);
                    }}
                    className={`space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2 transition-opacity ${
                      draggingRowIndex === rowItem.rowIdx ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-1">
                      <div className="flex items-center gap-1">
                        <span
                          draggable
                          aria-hidden="true"
                          title={`Drag Row #${rowItem.rowIdx + 1} to reorder`}
                          onDragStart={(e) => {
                            setDraggingRowIndex(rowItem.rowIdx);
                            if (e.dataTransfer) {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', String(rowItem.rowIdx));
                            }
                          }}
                          onDragEnd={() => setDraggingRowIndex(null)}
                          className="cursor-grab p-0.5 text-slate-400 hover:text-white active:cursor-grabbing touch-manipulation"
                        >
                          <GripVertical size={11} />
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          Row #{rowItem.rowIdx + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveRow(rowItem.rowIdx, 'up')}
                          disabled={rowItem.rowIdx === 0}
                          aria-label={`Move row ${rowItem.rowIdx + 1} up`}
                          className="inline-flex size-5 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveRow(rowItem.rowIdx, 'down')}
                          disabled={rowItem.rowIdx === rows.length - 1}
                          aria-label={`Move row ${rowItem.rowIdx + 1} down`}
                          className="inline-flex size-5 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronDown size={12} />
                        </button>
                        <ConfirmAction
                          label={`Delete row ${rowItem.rowIdx + 1}`}
                          message={`Delete Row #${rowItem.rowIdx + 1}?`}
                          confirmLabel="Delete"
                          cancelLabel="Cancel"
                          danger
                          idleClassName="inline-flex size-5 items-center justify-center rounded text-slate-400 hover:bg-rose-500/20 hover:text-rose-200 transition-colors cursor-pointer"
                          onConfirm={() => handleDeleteRow(rowItem.rowIdx)}
                        >
                          <Trash2 size={12} />
                        </ConfirmAction>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {rowItem.cellFields.map((cell) => (
                        <div key={cell.key} className="flex items-center gap-1.5">
                          <span
                            className="w-20 truncate text-[9px] font-medium text-slate-400"
                            title={cell.colHeader}
                          >
                            {cell.colHeader}:
                          </span>
                          <input
                            type="text"
                            value={cell.value}
                            onChange={(e) =>
                              handleUpdateCell(rowItem.rowIdx, cell.colIdx, e.target.value)
                            }
                            placeholder={cell.colHeader}
                            aria-label={`Row ${rowItem.rowIdx + 1} ${cell.colHeader}`}
                            className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/20 focus:border-accent-gold/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold"
                          />
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </StudioSection>
        </div>
      ) : (
        /* Raw CSV/TSV Mode */
        <div className="space-y-3">
          <StudioInput
            id={tableHeadId}
            label="Table Columns (comma-separated headers)"
            value={head.join(', ')}
            onChange={(val) =>
              setCurrentBlock({
                ...currentBlock,
                head: val
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Date, Action, Organizer"
          />
          <div>
            <label htmlFor={tableRowsId} className="block text-slate-300 font-bold mb-1 text-xs">
              Table Data Rows (one row per line, comma-separated cells)
            </label>
            <textarea
              id={tableRowsId}
              rows={6}
              value={rows.map((r) => r.join(', ')).join('\n')}
              onChange={(e) =>
                setCurrentBlock({
                  ...currentBlock,
                  rows: e.target.value
                    .split('\n')
                    .filter((line) => line.trim())
                    .map((line) => line.split(',').map((s) => s.trim())),
                })
              }
              placeholder="Nov 5, General Election, Fair Oaks\nDec 12, Organizing Rally, Carmichael"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-xs leading-relaxed"
            />
          </div>
        </div>
      )}
    </div>
  );
}
