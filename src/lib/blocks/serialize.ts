import {
  BLOCK_CLASS,
  type Block,
  BUTTON_CLASS,
  BUTTON_WRAPPER_CLASS,
  CALLOUT_CLASS,
  CALLOUT_TONES,
  type CalloutTone,
  CODE_CLASS,
  DIVIDER_CLASS,
  FIGURE_CLASS,
  LIST_CLASS,
  QUOTE_CLASS,
  TABLE_CLASS,
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

function classAttr(...names: string[]): string {
  return ` class="${names.join(' ')}"`;
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

function serializeList(items: string[], ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul';
  const variant = ordered ? 'ordered' : 'bullet';
  const body = items.map((item) => `<li>${item}</li>`).join('');
  return `<${tag}${classAttr(LIST_CLASS, `${LIST_CLASS}--${variant}`)}>${body}</${tag}>`;
}

function serializeTable(head: string[], rows: string[][]): string {
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
  return `<table${classAttr(TABLE_CLASS)}>${thead}${tbody}</table>`;
}

function serializeBlock(block: Block): string {
  switch (block.type) {
    case 'paragraph':
      return `<p>${block.html}</p>`;
    case 'heading':
      return `<h${block.level}${classAttr(BLOCK_CLASS, `${BLOCK_CLASS}--h${block.level}`)}>${block.html}</h${block.level}>`;
    case 'bulletList':
      return serializeList(block.items, false);
    case 'orderedList':
      return serializeList(block.items, true);
    case 'quote':
      return `<blockquote${classAttr(QUOTE_CLASS)}>${maybeWrapInline(block.html)}</blockquote>`;
    case 'callout':
      return `<div${classAttr(CALLOUT_CLASS, toneClass(block.tone))}>${maybeWrapInline(block.html)}</div>`;
    case 'code':
      return `<pre${classAttr(CODE_CLASS)}><code>${escapeHtmlText(block.text)}</code></pre>`;
    case 'image': {
      const dimensions = [
        block.width ? ` width="${block.width}"` : '',
        block.height ? ` height="${block.height}"` : '',
      ].join('');
      const figcaption = block.caption
        ? `<figcaption class="${BLOCK_CLASS}-caption">${escapeHtmlText(block.caption)}</figcaption>`
        : '';
      return `<figure${classAttr(FIGURE_CLASS)}><img src="${escapeHtmlAttr(block.src)}" alt="${escapeHtmlAttr(block.alt)}"${dimensions} loading="lazy" />${figcaption}</figure>`;
    }
    case 'divider':
      return `<hr${classAttr(DIVIDER_CLASS)} />`;
    case 'table':
      return serializeTable(block.head, block.rows);
    case 'button':
      return `<div${classAttr(BUTTON_WRAPPER_CLASS)}><a${classAttr(BUTTON_CLASS)} href="${escapeHtmlAttr(block.href)}">${escapeHtmlText(block.label)}</a></div>`;
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
export function serializeBlocks(blocks: Block[]): string {
  const meaningful = blocks.filter((block) => {
    if (block.type === 'divider') return true;
    if (block.type === 'unsupported') return block.html.trim().length > 0;
    if (block.type === 'image') return Boolean(block.src);
    if (block.type === 'button') return Boolean(block.href) && Boolean(block.label);
    if (block.type === 'code') return block.text.length > 0;
    if (block.type === 'table') return block.head.length > 0 || block.rows.length > 0;
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      return block.items.some((item) => stripTags(item).trim().length > 0);
    }
    return stripTags(block.html).trim().length > 0;
  });

  if (meaningful.length === 0) return '<p></p>';
  return meaningful.map(serializeBlock).join('');
}

/** True when a block carries no authorable content. */
export function isBlockEmpty(block: Block): boolean {
  return serializeBlocks([block]) === '<p></p>';
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
