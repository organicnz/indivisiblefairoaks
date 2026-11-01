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
 * The structural classes on a block's own wrapper, in source order.
 *
 * Empty for a block whose markup is not wrapped in a `<div>` — a plain
 * paragraph, for instance — and for a wrapper with no structural classes.
 */
export function structuralClassesOf(block: Block): string {
  if (!('html' in block) || typeof block.html !== 'string') return '';
  const opening = block.html.trim().match(/^<div\s+([^>]*?)>/i);
  if (!opening) return '';
  const classMatch = opening[1]?.match(/class=["']([^"']+)["']/i);
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
