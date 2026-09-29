import { isBlockEmpty, isCalloutTone, stripTags } from './serialize';
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
  type HeadingLevel,
  LIST_CLASS,
  nextBlockId,
  QUOTE_CLASS,
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
  for (const token of classTokens(el)) {
    const m = HEADING_CLASS_RE.exec(token);
    if (m) return { id: nextBlockId(), type: 'heading', level: Number(m[1]) as HeadingLevel, html };
  }
  return { id: nextBlockId(), type: 'heading', level, html };
}

function parseList(el: Element, ordered: boolean): Block {
  // Not trimmed: trailing whitespace is real content, and dropping it here would
  // mean a load/save cycle silently rewrites the author's markup. It is invisible
  // either way, because whitespace collapses when a list item renders.
  const items = [...el.children]
    .filter((child) => child.tagName.toLowerCase() === 'li')
    .map((li) => li.innerHTML);
  return {
    id: nextBlockId(),
    type: ordered ? 'orderedList' : 'bulletList',
    items: items.length ? items : [''],
  };
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
  return { id: nextBlockId(), type: 'callout', tone, html: unwrapLoneParagraph(el) };
}

function parseQuote(el: Element): Block {
  return { id: nextBlockId(), type: 'quote', html: unwrapLoneParagraph(el) };
}

function parseCode(el: Element): Block {
  const code = el.querySelector('code');
  // textContent, not innerHTML: code content is literal text, and re-reading it
  // as markup would decode entities a second time on every round trip.
  return { id: nextBlockId(), type: 'code', text: (code ?? el).textContent ?? '' };
}

function parseFigure(el: Element): Block {
  const img = el.querySelector('img');
  const figcaption = el.querySelector('figcaption');
  if (!img) return { id: nextBlockId(), type: 'unsupported', html: el.outerHTML };
  const widthAttr = img.getAttribute('width');
  const heightAttr = img.getAttribute('height');
  return {
    id: nextBlockId(),
    type: 'image',
    src: img.getAttribute('src') ?? '',
    alt: img.getAttribute('alt') ?? '',
    caption: figcaption ? (figcaption.textContent ?? '') : '',
    width: widthAttr ? Number(widthAttr) || null : null,
    height: heightAttr ? Number(heightAttr) || null : null,
  };
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
  return { id: nextBlockId(), type: 'table', head, rows: bodyRows };
}

function parseButton(el: Element): Block | null {
  const link = el.tagName.toLowerCase() === 'a' ? el : el.querySelector('a');
  if (!link) return null;
  // Trimmed only to decide whether there is a label at all — the stored label
  // keeps its own spacing so a load/save cycle is lossless.
  const label = link.textContent ?? '';
  if (!label.trim()) return null;
  return { id: nextBlockId(), type: 'button', label, href: link.getAttribute('href') ?? '' };
}

function parseElement(el: Element): Block | Block[] | null {
  const tag = el.tagName.toLowerCase();

  if (hasClass(el, DIVIDER_CLASS) || tag === 'hr') {
    return { id: nextBlockId(), type: 'divider' };
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

  if (tag === 'p') return { id: nextBlockId(), type: 'paragraph', html: innerHtml(el) };

  if (tag === 'div') {
    // A div holding a single block-level child is a wrapper, not a block.
    const childElements = [...el.children];
    if (childElements.length === 1) {
      const only = childElements[0];
      const onlyTag = only.tagName.toLowerCase();
      const isBlock =
        HEADING_RE.test(onlyTag) ||
        ['p', 'ul', 'ol', 'blockquote', 'pre', 'figure', 'table', 'hr'].includes(onlyTag) ||
        hasClass(only, CALLOUT_CLASS);
      if (isBlock) {
        const parsed = parseElement(only);
        return parsed ?? null;
      }
    }
    return { id: nextBlockId(), type: 'unsupported', html: el.outerHTML };
  }

  // Anything else: preserve verbatim rather than guess.
  return { id: nextBlockId(), type: 'unsupported', html: el.outerHTML };
}

function parseFragment(root: ParentNode, out: Block[]): void {
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
    if (Array.isArray(parsed)) out.push(...parsed);
    else out.push(parsed);
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
