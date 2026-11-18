'use client';

import { Columns3 } from 'lucide-react';
import type { Block, ContentBlock } from '@/lib/blocks';
import { stripTags } from '@/lib/blocks';

/** One nested block, named by its words rather than its type. */
function rowBlockSummary(block: ContentBlock): string {
  if (block.type === 'unsupported') return 'Preserved markup';
  if (block.type === 'image') return block.alt || 'Image';
  if (block.type === 'button') return block.label || 'Button';
  if (block.type === 'table') return block.head.filter(Boolean).join(' · ') || 'Table';
  if (block.type === 'code') return block.text.split('\n')[0] || 'Code';
  if (block.type === 'divider') return 'Divider';
  if (block.type === 'bulletList' || block.type === 'orderedList') {
    const items = block.items.map((item) => stripTags(item).trim()).filter(Boolean);
    return items.join(' · ') || 'Empty list';
  }
  return stripTags(block.html).trim() || 'Empty text block';
}

/**
 * A row as the content editor can honestly show it.
 *
 * This editor only edits leaves: a nested block's text, its type and its
 * design controls live in the composer. Rendering the row through the text
 * fallback made it an empty paragraph card whose type menu replaced the whole
 * layout. The card below shows the columns, names their contents, and sends the
 * author to the one surface that can change them; it deliberately offers no
 * type menu, no slash insert, and no conversion.
 */
export function RowBlockCard({
  block,
  composeHref,
}: {
  block: Extract<Block, { type: 'row' }>;
  composeHref: string | null;
}) {
  const count = block.columns.length;
  return (
    <div className="rounded-xl border border-border bg-surface-muted p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Columns3 size={13} aria-hidden="true" />
            Row · {count} {count === 1 ? 'column' : 'columns'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            A layout container. Its columns and nested blocks are edited in the visual composer.
          </p>
        </div>
        {composeHref ? (
          <a
            href={composeHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-primary-on-dark"
          >
            Edit in Composer
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">
            Save this page once to edit it in the Composer.
          </span>
        )}
      </div>
      <div
        className="mt-3 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {block.columns.map((column, columnIndex) => (
          <div
            key={column.id}
            className="min-w-0 rounded-lg border border-border bg-surface-card p-2"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Column {columnIndex + 1}
            </p>
            {column.blocks.length === 0 ? (
              <p className="mt-1 text-xs italic text-muted-foreground">Empty column</p>
            ) : (
              <ul className="mt-1 space-y-1 text-xs text-foreground">
                {column.blocks.map((child) => (
                  <li key={child.id} className="line-clamp-2 break-words">
                    {rowBlockSummary(child)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
