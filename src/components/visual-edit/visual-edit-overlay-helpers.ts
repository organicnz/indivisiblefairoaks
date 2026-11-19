import type { Block } from '@/lib/blocks';

/**
 * Elements whose `innerHTML` is a block's own editable content.
 *
 * A block's root in the DOM is normally one of these: a paragraph is a `<p>`, a
 * heading an `<h2>`, a callout a `<div class="cw-callout">`. Reading such an
 * element's `innerHTML` is exactly reading the content the block model stores.
 *
 * A `<section>`, `<div>` or `<main>` *layout* wrapper is deliberately absent.
 * On a coded page a block's DOM address is the section that renders it, so
 * reading the wrapper's `innerHTML` would save every sibling block as one
 * block's `html` — inflating the body past `MAX_BODY_BYTES` and making "This
 * page is too large to save" fire on every later save.
 */
const TEXT_CONTENT_TAGS: ReadonlySet<string> = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'li',
  'dd',
  'dt',
  'figcaption',
  'td',
  'th',
]);

/**
 * Divs that are a block's own root even though the tag is generic.
 *
 * `serializeBlock` gives a callout and a button a `<div>` root carrying a `cw-`
 * structural class, so those two are content, not layout.
 */
const TEXT_CONTENT_ROOT_CLASSES = ['cw-callout', 'cw-action'] as const;

function isTextContentRoot(element: HTMLElement): boolean {
  if (TEXT_CONTENT_TAGS.has(element.tagName.toLowerCase())) return true;
  return TEXT_CONTENT_ROOT_CLASSES.some((className) => element.classList.contains(className));
}

/**
 * The element whose `innerHTML` is the content of the block being committed.
 *
 * The inline session's element is often a child of the block's rendered root —
 * a link or a `<strong>` inside a paragraph — so the block's own content is
 * read from the nearest textual ancestor rather than from the session element.
 *
 * Climbing stops at the block root, and the block root is accepted only when it
 * is itself a content root (`<p>`, `<h2>`, a `cw-callout` div, …). That bound is
 * the fix for "This page is too large to save": on a coded page the block
 * resolves to a `<section>`, and a `<section>`'s `innerHTML` is the whole
 * section, not the block.
 *
 * Returns null when no content root can be found — the caller must not persist
 * a layout wrapper's markup as a block's content.
 */
export function resolveBlockContentRoot(
  element: HTMLElement,
  blockRoot: HTMLElement | null
): HTMLElement | null {
  if (!blockRoot?.contains(element)) {
    return isTextContentRoot(element) ? element : null;
  }
  let node: HTMLElement | null = element;
  while (node && node !== blockRoot) {
    if (isTextContentRoot(node)) return node;
    node = node.parentElement;
  }
  return isTextContentRoot(blockRoot) ? blockRoot : null;
}

/**
 * Read the top-level items of a list block from the live DOM.
 *
 * An inline session can start on an `<li>`, whose `innerHTML` is only one item.
 * The block stores the whole list, so the write must walk to the owning
 * `<ul>`/`<ol>` rather than persisting the edited item as the list.
 */
export function readInlineListItems(
  blockRoot: HTMLElement | null,
  contentRoot: HTMLElement | null
): string[] | null {
  const listRoot = blockRoot?.matches('ul, ol')
    ? blockRoot
    : (contentRoot?.closest('ul, ol') ?? blockRoot?.closest('ul, ol') ?? null);
  if (!listRoot) return null;
  const items = Array.from(listRoot.children)
    .filter((child): child is HTMLLIElement => child.tagName === 'LI')
    .map((item) => item.innerHTML);
  return items.length > 0 ? items : null;
}

/** Block types whose text an inline session can represent in the saved model. */
export const INLINE_EDITABLE_BLOCK_TYPES: ReadonlySet<Block['type']> = new Set([
  'heading',
  'paragraph',
  'quote',
  'callout',
  'button',
  'bulletList',
  'orderedList',
  'code',
]);

export function wrapSelectionWithTag(tagName: string, className?: string) {
  if (typeof window === 'undefined') return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (tagName === 'hr') {
    const hr = document.createElement('hr');
    if (className) hr.className = className;
    range.deleteContents();
    range.insertNode(hr);
    return;
  }
  const el = document.createElement(tagName);
  if (className) el.className = className;
  try {
    el.appendChild(range.extractContents());
    range.insertNode(el);
  } catch {
    document.execCommand('formatBlock', false, tagName);
  }
}

/**
 * The shape of an `id` attribute, shared by both anchor checks.
 *
 * `(?:^|\s)`, not `\b`: a word boundary also matches the `id` inside
 * `data-id`, which would report a collision that is not one. The composer's
 * save guard and its live warning both build from this string, so the two
 * cannot disagree about what counts as an anchor.
 */
const ANCHOR_ATTRIBUTE_PREFIX = String.raw`(?:^|\s)id=["']`;

/** Every id a block carries, or every id on the page but one block's. */
export function collectAnchorIds(blocks: Block[], exceptIndex: number | null = null): string[] {
  const ids: string[] = [];
  blocks.forEach((block, index) => {
    if (index === exceptIndex) return;
    // A shell block's root id is no longer inside its `html`; the model owns it.
    if (block.shell?.anchorId) ids.push(block.shell.anchorId);
    if (!('html' in block) || typeof block.html !== 'string') return;
    const pattern = new RegExp(`${ANCHOR_ATTRIBUTE_PREFIX}([^"']+)["']`, 'gi');
    for (const match of block.html.matchAll(pattern)) {
      if (match[1]) ids.push(match[1]);
    }
  });
  return ids;
}

/**
 * The index of another block that already owns `anchorId`, or `null` if free.
 *
 * An `id` identifies exactly one element. Two blocks carrying the same one
 * produces invalid HTML, breaks every in-page link that meant the first of
 * them, and fails the composer's own accessibility audit — so the write is
 * refused with a message naming the conflict, rather than silently minting a
 * duplicate or silently renaming what the operator typed.
 */
export function findAnchorOwner(
  blocks: Block[],
  blockIndex: number,
  anchorId: string
): number | null {
  const escaped = anchorId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${ANCHOR_ATTRIBUTE_PREFIX}${escaped}["']`, 'i');
  const wanted = anchorId.toLowerCase();
  for (let i = 0; i < blocks.length; i += 1) {
    if (i === blockIndex) continue;
    const block = blocks[i];
    if (block.shell?.anchorId?.toLowerCase() === wanted) return i;
    if ('html' in block && typeof block.html === 'string' && pattern.test(block.html)) {
      return i;
    }
  }
  return null;
}

/**
 * Give a refreshed document the ids of the blocks the panel is still editing.
 *
 * A reload parses `content.body` again, and `parseHtml` mints fresh ids; the
 * composer keys an editing session by id. Without this carry-over a page-side
 * refresh reads as "a different block" even though it is the same paragraph in
 * the same place, and the inspector rebuilds the draft from markup — silently
 * discarding whatever the operator had not applied yet.
 *
 * Only the blocks that are part of the live session are mapped: the block the
 * panel has open, the multi-selection, and the batch target snapshot. A block
 * nobody is holding keeps its fresh id, so a refresh cannot make two unrelated
 * blocks look like one. Mapping is positional on purpose — the same index is
 * the same place on the page, and a block that has moved is still the block the
 * operator is looking at.
 */
export function carrySessionBlockIds(
  next: readonly Block[],
  previous: readonly Block[],
  session: {
    openIndex: number | null;
    selectedIds: readonly string[];
    batchIds: readonly string[];
  }
): Block[] {
  const idByIndex = new Map<number, string>();
  const bind = (index: number, id: string | undefined) => {
    if (!id || index < 0 || index >= next.length) return;
    idByIndex.set(index, id);
  };

  bind(
    session.openIndex ?? -1,
    session.openIndex !== null ? previous[session.openIndex]?.id : undefined
  );
  for (const id of new Set([...session.selectedIds, ...session.batchIds])) {
    bind(
      previous.findIndex((block) => block.id === id),
      id
    );
  }

  if (idByIndex.size === 0) return [...next];
  return next.map((block, index) => {
    const id = idByIndex.get(index);
    return id ? { ...block, id } : block;
  });
}

/**
 * The full address a document at `pathname` belongs to.
 *
 * React supplies the pathname; the search string and hash live only in the
 * browser. Preserving them matters because `?region=` is part of the document
 * address: restoring only `/about` would silently reopen the whole page instead
 * of the copy region the operator was editing.
 */
export function routeForPathname(pathname: string): string {
  if (typeof window === 'undefined') return pathname;
  return `${pathname}${window.location.search}${window.location.hash}`;
}
