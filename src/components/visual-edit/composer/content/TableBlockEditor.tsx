'use client';

import type { Block } from '@/lib/blocks';
import { StudioInput } from '../ui';

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
  return (
    <div className="space-y-3">
      <StudioInput
        id={tableHeadId}
        label="Table Columns (comma-separated headers)"
        value={currentBlock.head.join(', ')}
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
        <label htmlFor={tableRowsId} className="block text-slate-300 font-bold mb-1">
          Table Data Rows (one row per line, comma-separated cells)
        </label>
        <textarea
          id={tableRowsId}
          rows={5}
          value={currentBlock.rows.map((r) => r.join(', ')).join('\n')}
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
          className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-xs"
        />
      </div>
    </div>
  );
}
