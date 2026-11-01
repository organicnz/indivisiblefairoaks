import { isStructuralBlockClass, structuralClassesForBlock } from './structural';
import { themeAttributesFor, themeModeFromClassList } from './theme';
import {
  BLOCK_CLASS,
  type Block,
  BUTTON_CLASS,
  BUTTON_WRAPPER_CLASS,
  CALLOUT_CLASS,
  CALLOUT_TONES,
  type CalloutTone,
  ROW_COLUMN_CLASS,
} from './types';

/**
 * Escape for HTML text content. `&`, `<`, `>` only — escaping quotes here would
 * double-escape them once the value lands in a text node.
 */
export function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escape for a double-quoted attribute value. */
export function escapeHtmlAttr(value: string): string {
  return escapeHtmlText(value).replace(/"/g, '&quot;');
}

/**
 * The presentation a block's own root carries.
 *
 * This is the single writer for design, identity and theme. `rootAttributes`
 * turns it into the save's markup, and the composer's live preview paints the
 * same value onto the page — so "preview equals save" is a property of one
 * function rather than a convention two code paths have to remember.
 *
 * Structural `cw-*` classes are appended here, after the design list, because
 * they belong to the block's type rather than to the design. The theme
 * attribute is derived from the theme token the compiler put in the design
 * list — the same mapping in both directions.
 */
export interface BlockRootPresentation {
  /** The complete class list, design utilities then structural classes. */
  className: string;
  /** The anchor id, or null when the block has none. */
  anchorId: string | null;
  /** The theme attribute, or null when the block inherits the page's. */
  theme: { name: 'data-theme' | 'data-theme-mode'; value: 'dark' | 'light' | 'system' } | null;
  /** Inline CSS from the Code tab, or null. */
  style: string | null;
}

export function blockRootPresentation(
  block: Block,
  structural = structuralClassesForBlock(block)
): BlockRootPresentation {
  const shell = block.shell;
  // A shell can arrive from pasted JSON as well as from the parser. Structural
  // classes are the type's, never the design's: letting one through would let a
  // pasted paragraph's shell turn it into a callout on the next parse.
  const design = (shell?.className ?? '')
    .split(/\s+/)
    .filter((token) => token && !isStructuralBlockClass(token))
    .join(' ');
  return {
    className: [design, structural].filter(Boolean).join(' ').trim(),
    anchorId: shell?.anchorId ?? null,
    theme: themeAttributesFor(themeModeFromClassList(design) ?? 'inherit'),
    style: shell?.style ?? null,
  };
}

/** The attributes the block's own root carries, escaped for markup. */
function rootAttributes(block: Block, structural = structuralClassesForBlock(block)): string {
  const root = blockRootPresentation(block, structural);
  const idAttr = root.anchorId ? ` id="${escapeHtmlAttr(root.anchorId)}"` : '';
  const classAttr = root.className ? ` class="${escapeHtmlAttr(root.className)}"` : '';
  const themeAttr = root.theme ? ` ${root.theme.name}="${root.theme.value}"` : '';
  const styleAttr = root.style ? ` style="${escapeHtmlAttr(root.style)}"` : '';
  return `${idAttr}${classAttr}${themeAttr}${styleAttr}`;
}

function toneClass(tone: CalloutTone): string {
  return `${CALLOUT_CLASS}--${tone}`;
}

/**
 * Wrap inline HTML in a paragraph unless it already contains block-level markup.
 * Used by the containers whose inner content is authored as inline HTML but
 * which read better (and survive sanitization more predictably) with a real
 * paragraph inside.
 */
function maybeWrapInline(html: string): string {
  if (/<(?:p|div|ul|ol|blockquote|pre|table|figure|h[1-6])\b/i.test(html)) return html;
  return `<p>${html}</p>`;
}

function serializeList(items: string[], ordered: boolean, attrs: string): string {
  const tag = ordered ? 'ol' : 'ul';
  const body = items.map((item) => `<li>${item}</li>`).join('');
  return `<${tag}${attrs}>${body}</${tag}>`;
}

function serializeTable(head: string[], rows: string[][], attrs: string): string {
  // Column count is driven by the widest row, not by the header. Sizing rows
  // from `head.length` silently dropped every cell past the header width, which
  // is unrecoverable — the editor would quietly shorten the author's table on
  // the first save.
  const columns = Math.max(head.length, ...rows.map((row) => row.length), 0);
  const headRow = Array.from({ length: columns }, (_, i) => `<th>${head[i] ?? ''}</th>`).join('');
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${Array.from({ length: columns }, (_, i) => `<td>${row[i] ?? ''}</td>`).join('')}</tr>`
    )
    .join('');
  const thead = columns > 0 ? `<thead><tr>${headRow}</tr></thead>` : '';
  const tbody = bodyRows ? `<tbody>${bodyRows}</tbody>` : '';
  // Empty cells are emitted empty rather than padded with `&nbsp;`: sanitize-html
  // decodes entities and re-encodes them, so a literal `&nbsp;` does not survive
  // the round trip byte-for-byte. The CSS gives cells a minimum width instead.
  return `<table${attrs}>${thead}${tbody}</table>`;
}

/**
 * The inside of a row: its columns, and whatever each column holds.
 *
 * Columns are structural, so their class is written here and never stored in
 * the row's design shell. A column cannot hold a row (`ContentBlock` has no row
 * member), which is the one-level bound made unrepresentable.
 */
function serializeRowContent(row: Extract<Block, { type: 'row' }>): string {
  return row.columns
    .map(
      (column) =>
        `<div class="${ROW_COLUMN_CLASS}">${column.blocks.map(serializeBlock).join('')}</div>`
    )
    .join('');
}

function serializeBlock(block: Block): string {
  switch (block.type) {
    case 'paragraph':
      return `<p${rootAttributes(block)}>${block.html}</p>`;
    case 'heading':
      return `<h${block.level}${rootAttributes(block, `${BLOCK_CLASS} ${BLOCK_CLASS}--h${block.level}`)}>${block.html}</h${block.level}>`;
    case 'bulletList':
      return serializeList(block.items, false, rootAttributes(block));
    case 'orderedList':
      return serializeList(block.items, true, rootAttributes(block));
    case 'quote':
      return `<blockquote${rootAttributes(block)}>${maybeWrapInline(block.html)}</blockquote>`;
    case 'callout':
      return `<div${rootAttributes(block, `${CALLOUT_CLASS} ${toneClass(block.tone)}`)}>${maybeWrapInline(block.html)}</div>`;
    case 'code':
      return `<pre${rootAttributes(block)}><code>${escapeHtmlText(block.text)}</code></pre>`;
    case 'image': {
      const dimensions = [
        block.width ? ` width="${block.width}"` : '',
        block.height ? ` height="${block.height}"` : '',
      ].join('');
      const figcaption = block.caption
        ? `<figcaption class="${BLOCK_CLASS}-caption">${escapeHtmlText(block.caption)}</figcaption>`
        : '';
      return `<figure${rootAttributes(block)}><img src="${escapeHtmlAttr(block.src)}" alt="${escapeHtmlAttr(block.alt)}"${dimensions} loading="lazy" />${figcaption}</figure>`;
    }
    case 'divider':
      return `<hr${rootAttributes(block)} />`;
    case 'table':
      return serializeTable(block.head, block.rows, rootAttributes(block));
    case 'button':
      return `<div${rootAttributes(block, BUTTON_WRAPPER_CLASS)}><a class="${BUTTON_CLASS}" href="${escapeHtmlAttr(block.href)}">${escapeHtmlText(block.label)}</a></div>`;
    case 'row':
      return `<div${rootAttributes(block)}>${serializeRowContent(block)}</div>`;
    case 'unsupported':
      return block.html;
  }
}

/**
 * Render a block list to the HTML stored in `content.body`.
 *
 * Empty text blocks are dropped rather than emitted: `sanitizeWPContent` removes
 * bare `<p></p>` (step 8), so persisting one would produce markup that reads back
 * with a block missing — the editor would silently shift under the author. A
 * document of nothing but empty paragraphs is emitted as a single empty `<p>` so
 * the page renders and the editor has somewhere to put the cursor.
 */
/**
 * Whether a block has anything a reader would see.
 *
 * Recursive for rows because an empty row is dropped exactly as an empty
 * paragraph is: it is scaffolding until a column holds something. An empty
 * *column* inside a row with content is still emitted, so a deliberate blank
 * column keeps its place in the grid instead of collapsing the layout.
 */
function hasMeaningfulContent(block: Block): boolean {
  if (block.type === 'divider') return true;
  if (block.type === 'row') {
    return block.columns.some((column) => column.blocks.some(hasMeaningfulContent));
  }
  if (block.type === 'unsupported') return block.html.trim().length > 0;
  if (block.type === 'image') return Boolean(block.src);
  if (block.type === 'button') return Boolean(block.href) && Boolean(block.label);
  if (block.type === 'code') return block.text.length > 0;
  if (block.type === 'table') return block.head.length > 0 || block.rows.length > 0;
  if (block.type === 'bulletList' || block.type === 'orderedList') {
    return block.items.some((item) => stripTags(item).trim().length > 0);
  }
  return stripTags(block.html).trim().length > 0;
}

export function serializeBlocks(blocks: Block[]): string {
  const meaningful = blocks.filter(hasMeaningfulContent);

  if (meaningful.length === 0) return '<p></p>';
  return meaningful.map(serializeBlock).join('');
}

/**
 * True when a block carries no authorable content.
 *
 * The design shell is deliberately ignored: an empty paragraph with a nice
 * border is still empty, and the save drops it. Testing the serialized markup
 * with the shell removed is what keeps this answer the same as the save's.
 */
export function isBlockEmpty(block: Block): boolean {
  return serializeBlocks([{ ...block, shell: undefined }]) === '<p></p>';
}

export function isCalloutTone(value: string): value is CalloutTone {
  return (CALLOUT_TONES as readonly string[]).includes(value);
}

/**
 * Flatten inline HTML to text. Used for emptiness checks and for the
 * word-count/reading-time readouts, so it must mirror what a reader sees.
 */
export function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}
