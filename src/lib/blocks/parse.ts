import { mergeBlockShells } from './save-shape';
import { isBlockEmpty, isCalloutTone, stripTags } from './serialize';
import { isStructuralBlockClass } from './structural';
import {
  BLOCK_CLASS,
  type Block,
  type BlockShell,
  BUTTON_CLASS,
  BUTTON_WRAPPER_CLASS,
  CALLOUT_CLASS,
  CALLOUT_TONES,
  type CalloutTone,
  CODE_CLASS,
  type ContentBlock,
  DIVIDER_CLASS,
  FIGURE_CLASS,
  type HeadingLevel,
  LIST_CLASS,
  nextBlockId,
  QUOTE_CLASS,
  ROW_CLASS,
  ROW_COLUMN_CLASS,
  type RowColumn,
} from './types';

/**
 * `content.body` holds HTML that a human edited in some other tool, and for
 * this project specifically a Google Sites export. The parser therefore has two
 * jobs that pull in opposite directions: recognise the editor's own vocabulary so
 * a round trip is lossless, and degrade gracefully for everything it does not
 * recognise so that opening and saving a migrated page never destroys it.
 *
 * Everything the parser does not recognise becomes an `unsupported` block that
 * holds its original HTML verbatim.
 */

const HEADING_RE = /^h([1-6])$/;
const HEADING_CLASS_RE = new RegExp(`^${BLOCK_CLASS}--h([1-6])$`);
const CALLOUT_TONE_RE = new RegExp(`^${CALLOUT_CLASS}--([a-z]+)$`);

function hasClass(el: Element, name: string): boolean {
  return el.classList.contains(name);
}

function classTokens(el: Element): string[] {
  return [...el.classList];
}

/** Inline content of an element, as HTML. */
function innerHtml(el: Element): string {
  return el.innerHTML;
}

/**
 * The design a live element carries, in the shape the model stores.
 *
 * Structural `cw-*` classes are excluded: they are how the parser recognises
 * the type, and the serializer re-emits them from the type. Everything else on
 * the root — design utilities, the compiler's theme tokens, an anchor id and
 * inline CSS — belongs to the block, on the element the browser actually
 * renders. This is the reader half of the own-the-root rule.
 */
function readElementShell(el: Element): BlockShell | undefined {
  const className = classTokens(el)
    .filter((token) => !isStructuralBlockClass(token))
    .join(' ');
  const anchorId = el.id || undefined;
  const style = el.getAttribute('style') || undefined;
  if (!className && !anchorId && !style) return undefined;
  return {
    ...(className ? { className } : {}),
    ...(anchorId ? { anchorId } : {}),
    ...(style ? { style } : {}),
  };
}

/** Attach a root's design to a parsed block, without inventing an empty shell. */
function withElementShell<T extends Block>(block: T, el: Element): T {
  const shell = readElementShell(el);
  return shell ? ({ ...block, shell } as T) : block;
}

/**
 * True for nodes that carry no layout meaning between blocks: whitespace and
 * comments. Google Sites exports are full of blank lines and `<!-- -->`.
 */
function isIgnorableNode(node: Node): boolean {
  if (node.nodeType === Node.COMMENT_NODE) return true;
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').trim() === '';
  return false;
}

function parseHeading(el: Element, level: HeadingLevel, html: string): Block {
  // An explicit class wins over the tag so a level can be changed without
  // changing the tag; a bare legacy <h2> with no class just takes its tag level.
  let resolved = level;
  for (const token of classTokens(el)) {
    const m = HEADING_CLASS_RE.exec(token);
    if (m) {
      resolved = Number(m[1]) as HeadingLevel;
      break;
    }
  }
  const shell = readElementShell(el);
  return {
    id: nextBlockId(),
    type: 'heading',
    level: resolved,
    html,
    ...(shell ? { shell } : {}),
  };
}

function parseList(el: Element, ordered: boolean): Block {
  // Not trimmed: trailing whitespace is real content, and dropping it here would
  // mean a load/save cycle silently rewrites the author's markup. It is invisible
  // either way, because whitespace collapses when a list item renders.
  const items = [...el.children]
    .filter((child) => child.tagName.toLowerCase() === 'li')
    .map((li) => li.innerHTML);
  return withElementShell(
    {
      id: nextBlockId(),
      type: ordered ? 'orderedList' : 'bulletList',
      items: items.length ? items : [''],
    },
    el
  );
}

/**
 * The serializer wraps a lone run of inline content in a `<p>` when it builds a
 * quote or callout. Undo that on the way back in, so editing a callout does not
 * accumulate another nested paragraph on every save.
 */
function unwrapLoneParagraph(el: Element): string {
  const single = el.children.length === 1 ? el.children[0] : null;
  if (single && single.tagName.toLowerCase() === 'p') return single.innerHTML;
  return innerHtml(el);
}

function parseCallout(el: Element): Block {
  let tone: CalloutTone = 'info';
  for (const token of classTokens(el)) {
    const m = CALLOUT_TONE_RE.exec(token);
    if (m && isCalloutTone(m[1])) {
      tone = m[1];
      break;
    }
  }
  const shell = readElementShell(el);
  return {
    id: nextBlockId(),
    type: 'callout',
    tone,
    html: unwrapLoneParagraph(el),
    ...(shell ? { shell } : {}),
  };
}

function parseQuote(el: Element): Block {
  const shell = readElementShell(el);
  return {
    id: nextBlockId(),
    type: 'quote',
    html: unwrapLoneParagraph(el),
    ...(shell ? { shell } : {}),
  };
}

function parseCode(el: Element): Block {
  const code = el.querySelector('code');
  // textContent, not innerHTML: code content is literal text, and re-reading it
  // as markup would decode entities a second time on every round trip.
  return withElementShell(
    {
      id: nextBlockId(),
      type: 'code',
      text: (code ?? el).textContent ?? '',
    },
    el
  );
}

function parseFigure(el: Element): Block {
  const img = el.querySelector('img');
  const figcaption = el.querySelector('figcaption');
  if (!img) return { id: nextBlockId(), type: 'unsupported', html: el.outerHTML };
  const widthAttr = img.getAttribute('width');
  const heightAttr = img.getAttribute('height');
  return withElementShell(
    {
      id: nextBlockId(),
      type: 'image',
      src: img.getAttribute('src') ?? '',
      alt: img.getAttribute('alt') ?? '',
      caption: figcaption ? (figcaption.textContent ?? '') : '',
      width: widthAttr ? Number(widthAttr) || null : null,
      height: heightAttr ? Number(heightAttr) || null : null,
    },
    el
  );
}

function parseTable(el: Element): Block {
  // Cell content is taken verbatim — see the note in parseList.
  const headCells = [...el.querySelectorAll('thead th')].map((th) => th.innerHTML);
  const firstRowIsHeader =
    headCells.length > 0 ||
    el.querySelector('thead tr th') !== null ||
    el.querySelector('tr th') !== null;
  const head = firstRowIsHeader ? headCells : [];
  const bodyRows = [...el.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td, th')].map((cell) => cell.innerHTML)
  );
  // A table with no thead: the first row is the header, per the HTML default.
  if (head.length === 0 && bodyRows.length > 0) {
    head.push(...(bodyRows.shift() as string[]));
  }
  return withElementShell(
    {
      id: nextBlockId(),
      type: 'table',
      head,
      rows: bodyRows,
    },
    el
  );
}

/**
 * A row and its columns.
 *
 * The column count is read from the columns that exist, not from `cw-row--N`:
 * markup that disagrees with itself has one honest answer, and it is the cells.
 * A `.cw-row` with no `.cw-column` children is malformed rather than empty;
 * preserving it as `unsupported` is how the editor refuses to delete a layout
 * it does not understand.
 *
 * Columns parse with `allowRows: false`. A nested row is real content, so it is
 * preserved verbatim as `unsupported` — visible, editable as raw HTML, and free
 * of a second level the model cannot represent.
 */
function parseRow(el: Element): Block {
  const columnElements = [...el.children].filter((child) => hasClass(child, ROW_COLUMN_CLASS));
  if (columnElements.length === 0) {
    return { id: nextBlockId(), type: 'unsupported', html: el.outerHTML };
  }

  const columns: RowColumn[] = columnElements.map((columnEl) => {
    const blocks: Block[] = [];
    parseFragment(columnEl, blocks, { allowRows: false });
    // `allowRows: false` replaces any row with an unsupported block, so this is
    // the one place the runtime invariant is stronger than the local type.
    return { id: nextBlockId(), blocks: blocks as ContentBlock[] };
  });

  const shell = readElementShell(el);
  return {
    id: nextBlockId(),
    type: 'row',
    columns,
    ...(shell ? { shell } : {}),
  };
}

function parseButton(el: Element): Block | null {
  const link = el.tagName.toLowerCase() === 'a' ? el : el.querySelector('a');
  if (!link) return null;
  // Trimmed only to decide whether there is a label at all — the stored label
  // keeps its own spacing so a load/save cycle is lossless.
  const label = link.textContent ?? '';
  if (!label.trim()) return null;
  return withElementShell(
    {
      id: nextBlockId(),
      type: 'button',
      label,
      href: link.getAttribute('href') ?? '',
    },
    el
  );
}

function parseElement(el: Element): Block | Block[] | null {
  const tag = el.tagName.toLowerCase();

  if (hasClass(el, ROW_CLASS)) return parseRow(el);

  if (hasClass(el, DIVIDER_CLASS) || tag === 'hr') {
    return withElementShell({ id: nextBlockId(), type: 'divider' }, el);
  }

  if (hasClass(el, CALLOUT_CLASS)) return parseCallout(el);

  if (hasClass(el, CODE_CLASS) || tag === 'pre') return parseCode(el);

  if (hasClass(el, FIGURE_CLASS) || tag === 'figure') return parseFigure(el);

  if (hasClass(el, QUOTE_CLASS) || tag === 'blockquote') return parseQuote(el);

  if (tag === 'table') return parseTable(el);

  if (tag === 'ul' || tag === 'ol') {
    // A wrapper class marks a list, but an unwrapped <ul> is still a list.
    if (hasClass(el, LIST_CLASS) || tag === 'ul' || tag === 'ol') {
      return parseList(el, tag === 'ol');
    }
  }

  if (hasClass(el, BUTTON_WRAPPER_CLASS) || hasClass(el, BUTTON_CLASS)) {
    const button = parseButton(el);
    if (button) return button;
  }

  if (tag === 'a') {
    const button = parseButton(el);
    if (button) return button;
  }

  const heading = HEADING_RE.exec(tag);
  if (heading) return parseHeading(el, Number(heading[1]) as HeadingLevel, innerHtml(el));

  if (tag === 'p') {
    return withElementShell({ id: nextBlockId(), type: 'paragraph', html: innerHtml(el) }, el);
  }

  if (tag === 'div') {
    // A div holding a single block-level child is a wrapper, not a block. If the
    // wrapper carries a design — the previous composer's shape for a list,
    // figure, table, divider or button — lift it onto the block's own root. That
    // is the migration: the div's classes are the block's classes, and the next
    // save writes them on an element that is allowed to carry them.
    const childElements = [...el.children];
    if (childElements.length === 1) {
      const only = childElements[0];
      const parsed = parseElement(only);
      if (parsed && !Array.isArray(parsed) && parsed.type !== 'unsupported') {
        const outer = readElementShell(el);
        return outer ? { ...parsed, shell: mergeBlockShells(parsed.shell, outer) } : parsed;
      }
    }
    return { id: nextBlockId(), type: 'unsupported', html: el.outerHTML };
  }

  // Anything else: preserve verbatim rather than guess.
  return { id: nextBlockId(), type: 'unsupported', html: el.outerHTML };
}

function parseFragment(
  root: ParentNode,
  out: Block[],
  options: { allowRows?: boolean } = {}
): void {
  const allowRows = options.allowRows ?? true;
  for (const node of Array.from(root.childNodes)) {
    if (isIgnorableNode(node)) continue;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      // Bare text at block level — a plain paragraph from a text-only migration.
      const text = (node.textContent ?? '').trim();
      if (text) out.push({ id: nextBlockId(), type: 'paragraph', html: escapeText(text) });
      continue;
    }
    const parsed = parseElement(node as Element);
    if (!parsed) continue;
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!allowRows && item.type === 'row') {
        // Keep the nested row's exact source, not a re-serialised copy: the
        // point of preserving it is that a save writes back what was there.
        out.push({
          id: nextBlockId(),
          type: 'unsupported',
          html: (node as Element).outerHTML,
        });
      } else {
        out.push(item);
      }
    }
  }
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Parse stored HTML into the editor's block model.
 *
 * The input is expected to have been through `sanitizeWPContent` already (the
 * editor always saves sanitized markup), but the parser is defensive about
 * unknown elements regardless, so it is safe to point at raw migrated content.
 */
export function parseHtml(html: string): Block[] {
  if (!html?.trim()) return [emptyParagraph()];

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const blocks: Block[] = [];
  parseFragment(doc.body, blocks);

  // The sanitizer deletes empty paragraphs, so a document can legitimately
  // arrive with none. The editor still needs one block to type into, but it is
  // not part of the document, which is why `isTransient` marks it — saving
  // before anything is typed must not create a page out of nothing.
  if (blocks.length === 0) return [emptyParagraph()];
  return blocks;
}

function emptyParagraph(): Block {
  return { id: nextBlockId(), type: 'paragraph', html: '' };
}

/** A block that should be dropped on save because nothing has been written yet. */
export function isTransient(block: Block): boolean {
  return block.type === 'paragraph' && stripTags(block.html).trim() === '';
}

export function blockText(block: Block): string {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
    case 'quote':
    case 'callout':
      return stripTags(block.html);
    case 'bulletList':
    case 'orderedList':
      return block.items.map(stripTags).join(' ');
    case 'code':
      return block.text;
    case 'image':
      return [block.alt, block.caption].filter(Boolean).join(' ');
    case 'table':
      return [...block.head, ...block.rows.flat()].map(stripTags).join(' ');
    case 'button':
      return block.label;
    case 'row':
      return block.columns
        .flatMap((column) => column.blocks.map(blockText))
        .filter(Boolean)
        .join(' ');
    case 'divider':
      return '';
    case 'unsupported':
      return stripTags(block.html);
  }
}

/** Narrows to the blocks whose content is a run of inline HTML. */
export type TextualBlock = Extract<Block, { html: string }>;

export function isTextualBlock(block: Block): block is TextualBlock {
  return (
    block.type === 'paragraph' ||
    block.type === 'heading' ||
    block.type === 'quote' ||
    block.type === 'callout'
  );
}

export { CALLOUT_TONES, isBlockEmpty };
