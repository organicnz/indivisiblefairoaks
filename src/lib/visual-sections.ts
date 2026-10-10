/**
 * The visual editor's section model — one source of truth for "which block is
 * that frame on the page?"
 *
 * The overlay draws a frame over an element in the rendered DOM, but every
 * mutation (edit, move, duplicate, delete) is an operation on the block model
 * that becomes `content.body`. Those are two different coordinate systems, and
 * reconciling them by position — `sections[i].index → blocks[i]` — is wrong the
 * moment the sanitizer removes something.
 *
 * It does remove things. `sanitizeWPContent` drops the `MIGRATED_PAGE_FURNITURE`
 * subtrees, strips active-content tags, and deletes three-or-more adjacent
 * anchors. A body of `<p>intro</p><form>x</form><h2>Mission</h2>` parses to three
 * blocks and renders to two children, so every later section is off by one and
 * clicking "edit" on *Mission* edits the `<form>` block. Nothing errors; the
 * wrong thing is quietly written to the database.
 *
 * So the block is the thing that is addressed, and the DOM element is found by
 * matching content rather than by counting. This module is pure for the same
 * reason `visual-edit-mode.ts` is: the reconciliation is the bug, and a bug in a
 * pure function is one a test can find.
 */

import { type Block, blockText, type ContentBlockType } from '@/lib/blocks';
import { collectPageSections } from '@/lib/visual-edit-mode';

/** One editable section: a block, plus the element that renders it, if any. */
export interface VisualSection {
  /**
   * Stable identity for React keys and for the set of framed sections.
   *
   * The block's own `id` cannot be used, however much it looks like the right
   * thing: `nextBlockId()` is a module-level counter, so `parseHtml` gives a
   * different id to the same document every time it runs. A key that changes
   * between parses is a key that loses the operator's "this frame is on" choice
   * on the next refresh. The position in the document is stable for as long as
   * the document is, which is exactly the lifetime this needs.
   */
  key: string;
  /** Position in the block list — the coordinate every mutation uses. */
  blockIndex: number;
  /** Position among the container's element children, or null when unrendered. */
  domIndex: number | null;
  /** What the operator reads in a list: the block's text, or its type name. */
  label: string;
  blockType: ContentBlockType;
  /** 1-based position among sections, for the "Section #3" readout. */
  ordinal: number;
}

const MAX_LABEL = 80;

/** A section's fallback name when its block carries no readable text. */
const TYPE_LABELS: Record<ContentBlockType, string> = {
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

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * A comparison key for "does this element render this block?".
 *
 * Whitespace-collapsed and lowercased, because the rendered DOM has been
 * through a sanitizer that re-serialises entities and the block has been
 * through `blockText`. An empty key is deliberately returned as `''` rather
 * than omitted: an element with no text can only ever match a block with no
 * text, and the pairing pass relies on that being a *falsy* signal it skips.
 */
function fingerprint(value: string): string {
  const text = collapse(value).toLowerCase();
  return text.length > MAX_LABEL ? text.slice(0, MAX_LABEL) : text;
}

function blockFingerprint(block: Block): string {
  return fingerprint(blockText(block));
}

function elementFingerprint(element: Element): string {
  return fingerprint(element.textContent ?? '');
}

/** Human label for one block, for lists and frames. */
export function sectionLabelForBlock(block: Block): string {
  const text = collapse(blockText(block));
  if (text) return text.slice(0, MAX_LABEL);
  // An image with no alt, a divider, a table with no cells: name the thing.
  return TYPE_LABELS[block.type] ?? 'Section';
}

/**
 * Pair each block with the element that renders it.
 *
 * Two passes, because one is not enough in either direction:
 *
 * 1. **Content.** For each element, claim the first still-unclaimed block with
 *    the same fingerprint. This is what survives a sanitizer deletion: the
 *    element that used to sit between two blocks is simply gone, so the cursor
 *    steps over the block it rendered without ever pairing it.
 * 2. **Order.** Whatever is left over is paired in document order, which is the
 *    current behaviour and the right one for elements with no distinguishing
 *    text (a bare `<hr>`, an empty placeholder).
 *
 * A block that ends up unpaired keeps `domIndex: null` — the overlay cannot
 * draw a frame around an element that is not on the page, but the section is
 * still listed and still editable, because the document, not the DOM, is what
 * gets saved.
 */
function pairBlocksToElements(blocks: Block[], elements: Element[]): (Element | null)[] {
  const paired: (Element | null)[] = Array.from({ length: blocks.length }, () => null);
  const claimedBlocks = new Set<number>();
  const claimedElements = new Set<Element>();

  for (const element of elements) {
    const key = elementFingerprint(element);
    if (!key) continue;
    for (let index = 0; index < blocks.length; index += 1) {
      if (claimedBlocks.has(index)) continue;
      if (blockFingerprint(blocks[index]) !== key) continue;
      paired[index] = element;
      claimedBlocks.add(index);
      claimedElements.add(element);
      break;
    }
  }

  let cursor = 0;
  for (const element of elements) {
    if (claimedElements.has(element)) continue;
    while (cursor < blocks.length && paired[cursor] !== null) cursor += 1;
    if (cursor >= blocks.length) break;
    paired[cursor] = element;
    claimedElements.add(element);
    cursor += 1;
  }

  return paired;
}

/**
 * Build the editable section list for a document.
 *
 * `blocks` is the authoritative model — normally `parseHtml(content.body)`, or
 * `extractBlocksFromDOM(root)` for a page with no CMS row yet. `elements` is
 * the container's element children in document order.
 */
export function buildVisualSections(blocks: Block[], elements: Element[]): VisualSection[] {
  const paired = pairBlocksToElements(blocks, elements);
  const domIndexByElement = new Map<Element, number>();
  elements.forEach((element, index) => {
    domIndexByElement.set(element, index);
  });

  const sections: VisualSection[] = [];
  blocks.forEach((block, blockIndex) => {
    const element = paired[blockIndex];
    sections.push({
      key: `b${blockIndex}`,
      blockIndex,
      domIndex: element ? (domIndexByElement.get(element) ?? null) : null,
      label: sectionLabelForBlock(block),
      blockType: block.type,
      ordinal: sections.length + 1,
    });
  });
  return sections;
}

/** The section a DOM ordinal addresses, or null when it addresses nothing. */
export function sectionForDomIndex(
  sections: VisualSection[],
  domIndex: number
): VisualSection | null {
  return sections.find((section) => section.domIndex === domIndex) ?? null;
}

/** The block a DOM ordinal addresses, or null when it addresses nothing. */
export function blockIndexForDomIndex(sections: VisualSection[], domIndex: number): number | null {
  return sectionForDomIndex(sections, domIndex)?.blockIndex ?? null;
}

/**
 * Where a section should move to, expressed in block coordinates.
 *
 * The header addresses sections by DOM ordinal, and its own discovery only
 * keeps children that announce a heading — so a header ordinal is *not* a block
 * index, and neither is the neighbour it implies. This is the one place that
 * translation happens: the section list is the document, so a move is a swap
 * with the adjacent section in that list, and the caller writes the result back
 * to the two blocks it names.
 *
 * When the overlay has published its model the section list is one entry per
 * block, so this degenerates to `blockIndex ± 1`. It is still a function rather
 * than an inline `- 1` because that equality is an invariant of the published
 * list, not of sections in general, and the header's fallback list is the proof.
 */
export function moveTargetForSection(
  sections: VisualSection[],
  blockIndex: number,
  direction: 'up' | 'down'
): number | null {
  const current = sections.find((section) => section.blockIndex === blockIndex);
  if (!current) return null;
  const neighbour =
    direction === 'up'
      ? sections.find((section) => section.ordinal === current.ordinal - 1)
      : sections.find((section) => section.ordinal === current.ordinal + 1);
  return neighbour ? neighbour.blockIndex : null;
}

/** True when a section has a neighbour in that direction to move into. */
export function canMoveSection(
  sections: VisualSection[],
  blockIndex: number,
  direction: 'up' | 'down'
): boolean {
  return moveTargetForSection(sections, blockIndex, direction) !== null;
}

/**
 * Sections the page publishes for the navbar's editorial button.
 *
 * The header can only see the DOM, and the overlay is the component that knows
 * the block model, so the overlay publishes this list and the header renders
 * it verbatim rather than deriving a second, subtly different one.
 *
 * `index` is null for a block with no element on the page — the sanitizer
 * removed it, or the block serialises to nothing. Such a section is listed and
 * editable but cannot be scrolled to or framed, and labelling it with the block
 * ordinal instead would make two sections claim the same address.
 *
 * `blockIndex` is null for a section discovered from the DOM alone, which is
 * what the header falls back to before the overlay has published. Those
 * sections can be scrolled to and framed but not edited, and the header says so
 * rather than dispatching an edit the overlay would have to guess at.
 */
export interface PublishedSection {
  index: number | null;
  label: string;
  blockIndex: number | null;
  blockType: ContentBlockType | null;
  /** Whether the overlay is drawing this section's frame. */
  enabled: boolean;
}

/**
 * The section list as the header needs it.
 *
 * `enabled` rides on the section rather than in a parallel key list, because the
 * header cannot compute the overlay's keys — they are positions in a document
 * the header never sees — and any reconstruction of them would drift.
 */
export function publishSections(
  sections: VisualSection[],
  enabledKeys: ReadonlySet<string> = new Set()
): PublishedSection[] {
  return sections.map((section) => ({
    index: section.domIndex,
    label: section.label,
    blockIndex: section.blockIndex,
    blockType: section.blockType,
    enabled: enabledKeys.has(section.key),
  }));
}

/** Sections straight from the DOM, for a page the overlay has not described. */
export function discoverPageSections(root: ParentNode | null | undefined): PublishedSection[] {
  return collectPageSections(root).map((section) => ({
    index: section.index,
    label: section.label,
    blockIndex: null,
    blockType: null,
    // The overlay has not published, so nothing is framed yet. A switch that
    // read "on" for a frame nobody drew would be a control that does nothing.
    enabled: false,
  }));
}
