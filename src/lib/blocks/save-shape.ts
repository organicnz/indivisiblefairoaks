import { escapeHtmlAttr, serializeBlocks } from './serialize';
import {
  blockWrapperAttributes,
  designClassesOf,
  isWrappedBlockHtml,
  structuralClassesOf,
} from './structural';
import { themeAttributesFor, themeModeFromAttribute, themeModeFromClassList } from './theme';
import type { Block, BlockShell } from './types';

export interface BlockShellDesign {
  /** Compiled design utilities, without the block's structural classes. */
  customClasses?: string;
  /** The anchor id, for the single-block path; batch styling omits it. */
  anchorId?: string;
  /** Inline CSS from the Code tab. */
  customStyle?: string;
}

/**
 * The root attributes a block already carries, wherever they live.
 *
 * New saves store them on `block.shell`. A page saved by the previous composer
 * has them on a `<div>` wrapped around the block, so that is the back-compat
 * path — reading it is how the next save upgrades the page rather than losing
 * the design. A plain `<p>`/`<h2>` with no shell has none, which is the honest
 * answer.
 */
export type BlockRootShell = Required<BlockShell> & {
  /** The theme the root declares; null when it inherits the page's. */
  themeMode: ReturnType<typeof themeModeFromClassList>;
};

export function readBlockShell(block: Block): BlockRootShell | null {
  if (block.shell) {
    return {
      className: block.shell.className ?? '',
      anchorId: block.shell.anchorId ?? '',
      style: block.shell.style ?? '',
      themeMode: themeModeFromClassList(block.shell.className),
    };
  }
  if (!('html' in block) || typeof block.html !== 'string') return null;
  const attrs = blockWrapperAttributes(block.html);
  if (attrs === null) return null;
  const classMatch = attrs.match(/class=["']([^"']+)["']/i);
  const idMatch = attrs.match(/id=["']([^"']+)["']/i);
  const styleMatch = attrs.match(/style=["']([^"']+)["']/i);
  const themeMatch = attrs.match(/data-theme(?:-mode)?=["']([^"']+)["']/i);
  return {
    className: designClassesOf(classMatch?.[1] ?? ''),
    anchorId: idMatch?.[1] ?? '',
    style: styleMatch?.[1] ?? '',
    themeMode: themeModeFromAttribute(themeMatch?.[1]) ?? themeModeFromClassList(classMatch?.[1]),
  };
}

/**
 * Fold a legacy `<div>` wrapper's design onto the block it wrapped.
 *
 * The previous composer put the design on a div around a list, figure, table,
 * divider or button. That div has one block child and no authorable content of
 * its own, so on parse it is the block's root in spirit. Lifting it here is what
 * lets the next save put the same classes on the element that is actually
 * allowed to carry them.
 */
export function mergeBlockShells(
  inner: BlockShell | undefined,
  outer: BlockShell | undefined
): BlockShell | undefined {
  if (!inner) return outer;
  if (!outer) return inner;
  const tokens = [...(outer.className ?? '').split(/\s+/), ...(inner.className ?? '').split(/\s+/)]
    .filter(Boolean)
    .filter((token, index, all) => all.indexOf(token) === index);
  const merged: BlockShell = {
    ...(tokens.length > 0 ? { className: tokens.join(' ') } : {}),
    ...(outer.anchorId || inner.anchorId ? { anchorId: outer.anchorId ?? inner.anchorId } : {}),
    ...(outer.style || inner.style ? { style: outer.style ?? inner.style } : {}),
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * The `<div …>` a legacy unsupported block keeps around its verbatim markup.
 *
 * `unsupported` has no modelled root to put attributes on, so the design stays
 * on the wrapper it already had. The parser reads that wrapper back as the same
 * unsupported block, which is what keeps its round trip lossless.
 */
function legacyShellOpeningTag(block: Block, design: BlockShellDesign): string {
  const idAttr = design.anchorId ? ` id="${escapeHtmlAttr(design.anchorId)}"` : '';
  const mergedClasses = [designClassesOf(design.customClasses ?? ''), structuralClassesOf(block)]
    .filter(Boolean)
    .join(' ')
    .trim();
  const classAttr = mergedClasses ? ` class="${escapeHtmlAttr(mergedClasses)}"` : '';
  const theme = themeAttributesFor(themeModeFromClassList(design.customClasses) ?? undefined);
  const themeAttr = theme ? ` ${theme.name}="${theme.value}"` : '';
  const styleAttr = design.customStyle ? ` style="${escapeHtmlAttr(design.customStyle)}"` : '';
  return `<div${idAttr}${classAttr}${themeAttr}${styleAttr}>`;
}

/**
 * Apply a design to one block, exactly as the page stores it.
 *
 * Every block type with a modelled root gets the design on that root. The
 * element the browser renders is then the element the preview paints, and the
 * markup is valid HTML for the type — no `<div>` inside a `<p>`, no design
 * stranded on a wrapper that reads back as a different block. `unsupported`
 * keeps its wrapper because it has no root the model owns.
 */
export function applyBlockShell(block: Block, design: BlockShellDesign): Block {
  if (block.type === 'unsupported') {
    const openingTag = legacyShellOpeningTag(block, design);
    const html = block.html.trim();
    if (isWrappedBlockHtml(html)) {
      const openingEnd = html.indexOf('>');
      const inner = openingEnd === -1 ? html : html.slice(openingEnd + 1, -'</div>'.length);
      return { ...block, html: `${openingTag}${inner}</div>` };
    }
    return { ...block, html: `${openingTag}${serializeBlocks([block])}</div>` };
  }

  const className = designClassesOf(design.customClasses ?? '').trim();
  const shell: BlockShell = {
    ...(className ? { className } : {}),
    ...(design.anchorId ? { anchorId: design.anchorId } : {}),
    ...(design.customStyle ? { style: design.customStyle } : {}),
  };
  return { ...block, shell };
}
