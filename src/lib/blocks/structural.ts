import type { Block } from './types';

/**
 * The class prefix that identifies a block's structure rather than its look.
 *
 * `cw-callout`, `cw-callout--info`, `cw-table` and friends are how the block
 * parser recognises what a wrapper is. They travel in `class` because the
 * sanitizer's allow-list permits it (and does not permit `data-*`), which puts
 * them in the same attribute as every design utility. The two must not be
 * treated alike: a design reset may replace every look on a block, and the
 * block still has to parse as the same kind of block afterwards.
 */
const STRUCTURAL_CLASS_RE = /^cw(?:-|$)/;

/** True for a `cw` or `cw-*` class token; false for `cwx`, `custom-cw`, etc. */
export function isStructuralBlockClass(token: string): boolean {
  return STRUCTURAL_CLASS_RE.test(token);
}

/**
 * The inside of a block's opening `<div …>` when the block has one.
 *
 * This is the *reader's* question: a migrated block may start with a wrapper
 * and carry other markup after it, and its attributes are still the wrapper's.
 * The save's stricter question is `isWrappedBlockHtml` — whether the whole
 * document is one div — and the two must not be collapsed: using the strict
 * predicate here would drop the structural classes the parser needs to keep.
 */
export function blockWrapperAttributes(html: string): string | null {
  const opening = html.trim().match(/^<div(?:\s+([^>]*?))?>/i);
  return opening ? (opening[1] ?? '') : null;
}

/**
 * True when a block's markup is one `<div>` and nothing else.
 *
 * This is the single definition of the save's "wrapped vs plain root" split:
 * the save replaces this wrapper, the preview paints this element, and the
 * reader reads this wrapper. A plain `<h2>` is the other shape, and the save
 * creates a new wrapper around it.
 */
export function isWrappedBlockHtml(html: string): boolean {
  const trimmed = html.trim();
  return trimmed.startsWith('<div') && trimmed.endsWith('</div>');
}

/**
 * The structural classes on a block's own wrapper, in source order.
 *
 * Empty for a block whose markup is not wrapped in a `<div>` — a plain
 * paragraph, for instance — and for a wrapper with no structural classes.
 */
export function structuralClassesOf(block: Block): string {
  if (!('html' in block) || typeof block.html !== 'string') return '';
  const attrs = blockWrapperAttributes(block.html);
  if (attrs === null) return '';
  const classMatch = attrs.match(/class=["']([^"']+)["']/i);
  if (!classMatch?.[1]) return '';
  return classMatch[1].split(/\s+/).filter(isStructuralBlockClass).join(' ');
}

/** A class list with the structural tokens removed, ready for the design field. */
export function designClassesOf(className: string): string {
  return className
    .split(/\s+/)
    .filter((token) => token && !isStructuralBlockClass(token))
    .join(' ');
}
