'use client';

import { Lock, Plus, Trash2 } from 'lucide-react';
import type { FormEvent, HTMLAttributes, KeyboardEvent } from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import {
  type Block,
  CALLOUT_TONES,
  type CalloutTone,
  type HeadingLevel,
  INSERTABLE_HEADING_LEVELS,
  stripTags,
} from '@/lib/blocks';
import { BlockTypeMenu } from './BlockTypeMenu';
import type { BlockKind } from './block-definitions';
import { ContentImageInput } from './ContentImageInput';
import { InlineToolbar } from './InlineToolbar';
import { isSafeHref } from './is-safe-href';

const HEADING_LEVEL_NAMES: Record<number, string> = {
  2: 'Section (H2)',
  3: 'Subhead (H3)',
  4: 'Minor (H4)',
};

interface BodyProps {
  block: Block;
  index: number;
  registerRef: (id: string) => (el: HTMLElement | null) => void;
  onInput: (event: FormEvent<HTMLElement>, block: Block) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, block: Block, index: number) => void;
  /** Third argument is the undo intent; see the `onChange` prop for its meaning. */
  onUpdate: (id: string, patch: Partial<Block>, intent?: string | null) => void;
  onApplyInline: (command: string, value?: string) => void;
  onOpenLinkEditor: () => void;
  onCloseLinkEditor: () => void;
  linkEditorOpen: boolean;
  restoreSelection: () => void;
  onPickBlock: (kind: BlockKind, tone: CalloutTone) => void;
}

const INLINE_CLASS =
  'min-h-[1.75rem] w-full rounded-lg px-3 py-2 text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export function BlockBody({
  block,
  index,
  registerRef,
  onInput,
  onKeyDown,
  onUpdate,
  onApplyInline,
  onOpenLinkEditor,
  onCloseLinkEditor,
  linkEditorOpen,
  restoreSelection,
  onPickBlock,
}: BodyProps) {
  const editableProps = {
    ref: registerRef(block.id),
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: true,
    className: INLINE_CLASS,
    onInput: (e: FormEvent<HTMLElement>) => onInput(e, block),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => onKeyDown(e, block, index),
    role: 'textbox',
    'aria-multiline': true,
  };

  if (block.type === 'unsupported') {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
          <Lock size={13} aria-hidden="true" />
          Unsupported markup — preserved, not editable
        </p>
        <p className="mt-1.5 text-sm text-amber-900">
          This block uses markup the editor has no control for. It is kept exactly as written so
          saving does not delete it, but you cannot edit it here.
        </p>
        <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-surface-card/70 p-2 text-xs text-amber-900">
          {block.html}
        </pre>
      </div>
    );
  }

  if (block.type === 'divider') {
    return (
      <div className="flex items-center gap-3 px-3 py-3">
        <hr className="cw-divider my-0 flex-1" />
        <BlockTypeMenu block={block} onPick={onPickBlock} />
      </div>
    );
  }

  if (block.type === 'image') {
    return (
      <div className="rounded-xl border border-border bg-surface-muted p-3">
        <BlockTypeMenu block={block} onPick={onPickBlock} />
        <div className="mb-3">
          <ContentImageInput
            label="Image"
            hint="JPEG, PNG, WebP or GIF, up to 5MB"
            value={block.src}
            onChange={(src, dimensions) => {
              /*
               * The dimensions ride along with the URL, so the block gets them in
               * the same update that sets `src` and undo treats the pair as one
               * step. They are what the serializer emits as `width` / `height`,
               * which is the browser's only way to reserve an image's box before
               * the bytes arrive — without them every content image on the site
               * shifted layout as it loaded.
               *
               * A URL typed by hand arrives with no measurement, so the existing
               * dimensions are cleared rather than left describing the previous
               * image. Stale dimensions would reserve the *old* box, which is
               * worse than reserving none.
               */
              onUpdate(
                block.id,
                {
                  src,
                  width: dimensions?.width ?? null,
                  height: dimensions?.height ?? null,
                } as Partial<Block>,
                `type:src:${block.id}`
              );
            }}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Alt text
            <input
              type="text"
              value={block.alt}
              onChange={(e) =>
                onUpdate(
                  block.id,
                  { alt: e.target.value } as Partial<Block>,
                  `type:alt:${block.id}`
                )
              }
              placeholder="Describe the image for screen readers"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Caption
            <input
              type="text"
              value={block.caption}
              onChange={(e) =>
                onUpdate(
                  block.id,
                  { caption: e.target.value } as Partial<Block>,
                  `type:caption:${block.id}`
                )
              }
              placeholder="Optional"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
        </div>
        {/*
          Alt text is not optional politeness here: the image block is the only
          way a photo reaches a page, and a missing alt attribute is announced as
          a filename by every screen reader. Nudge rather than block, because the
          serializer is shared with content the editor did not author.
        */}
        {block.src && !block.alt.trim() && (
          <p className="mt-2 text-[11px] font-medium text-accent-gold">
            Add alt text so this image is described to screen reader users.
          </p>
        )}
      </div>
    );
  }

  if (block.type === 'code') {
    return (
      <div className="rounded-xl border border-border bg-surface-muted p-3">
        <BlockTypeMenu block={block} onPick={onPickBlock} />
        <textarea
          value={block.text}
          onChange={(e) =>
            onUpdate(block.id, { text: e.target.value } as Partial<Block>, `type:text:${block.id}`)
          }
          rows={4}
          spellCheck={false}
          aria-label="Code block content"
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 font-mono text-sm text-ink-on-dark focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
    );
  }

  if (block.type === 'button') {
    return (
      <div className="rounded-xl border border-border bg-surface-muted p-3">
        <BlockTypeMenu block={block} onPick={onPickBlock} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Label
            <input
              type="text"
              value={block.label}
              onChange={(e) =>
                onUpdate(
                  block.id,
                  { label: e.target.value } as Partial<Block>,
                  `type:label:${block.id}`
                )
              }
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Destination
            <input
              type="text"
              value={block.href}
              onChange={(e) =>
                onUpdate(
                  block.id,
                  { href: e.target.value } as Partial<Block>,
                  `type:href:${block.id}`
                )
              }
              placeholder="/contact"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
        </div>
        {/*
          Links are limited to this site's own domains. `sanitizeWPContent` already
          drops untrusted hrefs, so an out-of-domain URL here would appear to work
          in the editor and then silently vanish on publish.
        */}
        {block.href && !isSafeHref(block.href) && (
          <p role="alert" className="mt-2 text-xs font-medium text-accent-red">
            This link will be removed on publish — use a path like /contact, or a link to
            indivisiblefairoaks.org.
          </p>
        )}
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="rounded-xl border border-border bg-surface-muted p-3">
        <BlockTypeMenu block={block} onPick={onPickBlock} />
        {/*
          WAI-ARIA scrollable-region pattern. An `overflow-x-auto` box is no
          longer focusable in Chrome or Firefox, so a table wider than the editor
          — which a four-column block always is — could be scrolled with a mouse
          and not at all from the keyboard.

          Suppressed per element rather than for the file. `ProductSlider` turns
          the rule off wholesale in biome.json, which is fine for a 100-line
          carousel and too broad for this component: it has thirty blocks, and a
          file-level suppression would hide a real `tabIndex` regression on any
          of them.
        */}
        <section
          className="overflow-x-auto"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA scrollable region, see AGENTS.md "Scrollable regions must be focusable"
          tabIndex={0}
          aria-label="Table block, scrollable"
        >
          <table className="cw-table">
            <thead>
              <tr>
                {/* A table cell is a fully controlled <input>: it holds no
                    internal state, so the column index is a correct and stable
                    key. The lint flags any index key, hence the suppression. */}
                {block.head.map((cell, colIndex) => (
                  /* biome-ignore lint/suspicious/noArrayIndexKey: controlled input, no internal state */
                  <th key={`h-${colIndex}`}>
                    <input
                      type="text"
                      value={stripTags(cell)}
                      aria-label={`Column ${colIndex + 1} heading`}
                      onChange={(e) => {
                        const head = [...block.head];
                        head[colIndex] = e.target.value;
                        // The intent is what makes undo coalesce. Without it
                        // `record()` treats every keystroke as a separate edit
                        // and one word in a cell costs one undo per letter.
                        // Keyed by cell, so two columns type as two steps.
                        onUpdate(
                          block.id,
                          { head } as Partial<Block>,
                          `type:head:${block.id}:${colIndex}`
                        );
                      }}
                      className="w-full min-w-24 rounded border border-border bg-surface-card px-2 py-1 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </th>
                ))}
                <th className="w-10">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate(block.id, { head: [...block.head, 'New column'] } as Partial<Block>)
                    }
                    aria-label="Add column"
                    className="rounded px-1.5 py-1 text-muted-foreground transition-colors hover:bg-surface-card hover:text-primary dark:hover:text-primary-on-dark focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Rows hold controlled inputs only — see the header above. */}
              {block.rows.map((row, rowIndex) => (
                /* biome-ignore lint/suspicious/noArrayIndexKey: controlled inputs, no internal state */
                <tr key={`r-${rowIndex}`}>
                  {block.head.map((_, colIndex) => (
                    /* biome-ignore lint/suspicious/noArrayIndexKey: controlled input, no internal state */
                    <td key={`c-${colIndex}`}>
                      <input
                        type="text"
                        value={stripTags(row[colIndex] ?? '')}
                        aria-label={`Row ${rowIndex + 1} column ${colIndex + 1}`}
                        onChange={(e) => {
                          const rows = block.rows.map((r) => [...r]);
                          while (rows[rowIndex].length < block.head.length) rows[rowIndex].push('');
                          rows[rowIndex][colIndex] = e.target.value;
                          // Keyed by cell — see the header row's note.
                          onUpdate(
                            block.id,
                            { rows } as Partial<Block>,
                            `type:cell:${block.id}:${rowIndex}:${colIndex}`
                          );
                        }}
                        className="w-full min-w-24 rounded border border-border bg-surface-card px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate(block.id, {
                          rows: [
                            ...block.rows,
                            Array.from({ length: block.head.length }, () => ''),
                          ],
                        } as Partial<Block>)
                      }
                      aria-label={`Add row ${rowIndex + 2}`}
                      className="rounded px-1.5 py-1 text-muted-foreground transition-colors hover:bg-surface-card hover:text-primary dark:hover:text-primary-on-dark focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {block.rows.length > 0 && (
          <ConfirmAction
            label="Remove last row"
            message="Delete the last row of this table?"
            confirmLabel="Delete"
            cancelLabel="Cancel"
            danger
            idleClassName="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-accent-red focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            onConfirm={() =>
              onUpdate(block.id, { rows: block.rows.slice(0, -1) } as Partial<Block>)
            }
          >
            <Trash2 size={12} aria-hidden="true" />
            <span>Remove last row</span>
          </ConfirmAction>
        )}
      </div>
    );
  }

  if (block.type === 'bulletList' || block.type === 'orderedList') {
    const ListTag = block.type === 'orderedList' ? 'ol' : 'ul';
    return (
      <div className="rounded-xl">
        <BlockTypeMenu block={block} onPick={onPickBlock} />
        <ListTag className="cw-editor-canvas cw-list" ref={registerRef(block.id) as never}>
          {/* An index is a list item's identity. These <li> hold no React
              state — the DOM is the source of truth for their content by
              design — so there is no per-item state to mis-associate. */}
          {block.items.map((_item, itemIndex) => (
            <li
              /* biome-ignore lint/suspicious/noArrayIndexKey: no React state on these items */
              key={`${block.id}-${itemIndex}`}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                const items = [...block.items];
                items[itemIndex] = e.currentTarget.innerHTML;
                // Keyed by item, so a burst of typing inside one bullet is one
                // undo step and moving to the next bullet starts a new one.
                onUpdate(
                  block.id,
                  { items } as Partial<Block>,
                  `type:item:${block.id}:${itemIndex}`
                );
              }}
              onKeyDown={(e) => onKeyDown(e, block, index)}
              className="min-h-[1.5rem] rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          ))}
        </ListTag>
      </div>
    );
  }

  // Textual blocks: paragraph, heading, quote, callout. Each is spelled out
  // rather than built with createElement, so the heading level and the callout
  // tone stay statically checked instead of cast.
  return (
    <div className="rounded-xl">
      <div className="flex flex-wrap items-center gap-2">
        <BlockTypeMenu block={block} onPick={onPickBlock} />
        {block.type === 'heading' && (
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Level
            <select
              value={String(block.level)}
              onChange={(e) =>
                onUpdate(block.id, {
                  level: Number(e.target.value) as HeadingLevel,
                } as Partial<Block>)
              }
              className="rounded-lg border border-border bg-surface-card px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-primary"
            >
              {INSERTABLE_HEADING_LEVELS.map((level) => (
                <option key={level} value={String(level)}>
                  {HEADING_LEVEL_NAMES[level]}
                </option>
              ))}
            </select>
          </label>
        )}
        {block.type === 'callout' && (
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Tone
            <select
              value={block.tone}
              onChange={(e) =>
                onUpdate(block.id, { tone: e.target.value as CalloutTone } as Partial<Block>)
              }
              className="rounded-lg border border-border bg-surface-card px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-primary"
            >
              {CALLOUT_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {tone[0].toUpperCase() + tone.slice(1)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <InlineToolbar
        onApply={onApplyInline}
        onOpenLinkEditor={onOpenLinkEditor}
        onCloseLinkEditor={onCloseLinkEditor}
        linkEditorOpen={linkEditorOpen}
        restoreSelection={restoreSelection}
      />
      {/*
        The block classes live on a wrapper so the editable element itself can
        carry only the editor's own focus/padding styling. One `.cw` class
        carries the article rhythm (`> * + *` margins), so a wrapper that also
        holds the contenteditable child would double the spacing.
      */}
      {block.type === 'paragraph' && (
        <div className="cw-editor-canvas">
          <p {...editableProps} />
        </div>
      )}
      {block.type === 'heading' && (
        <div className="cw-editor-canvas">
          <HeadingTag level={block.level} {...editableProps} />
        </div>
      )}
      {block.type === 'quote' && (
        <blockquote className="cw-quote cw-editor-canvas">
          <p {...editableProps} />
        </blockquote>
      )}
      {block.type === 'callout' && (
        <div className={`cw-callout cw-callout--${block.tone} cw-editor-canvas`}>
          <p {...editableProps} />
        </div>
      )}
    </div>
  );
}

/** `h2`/`h3`/`h4` chosen from the level, so the markup matches the model. */
function HeadingTag({ level, ...rest }: { level: HeadingLevel } & HTMLAttributes<HTMLElement>) {
  if (level === 2) return <h2 {...rest} />;
  if (level === 3) return <h3 {...rest} />;
  return <h4 {...rest} />;
}
