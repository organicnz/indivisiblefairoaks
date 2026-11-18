import {
  type Block,
  isStructuralBlockClass,
  readBlockShell,
  serializeBlocks,
  THEME_CLASS_TOKENS,
} from '@/lib/blocks';
import type { VisualComposerMode, VisualComposerStyles } from '@/types/unified';
import { compileBadgeHtml, compileClassNames, DEFAULT_VC_STYLES } from './composer';

/**
 * A design this panel wrote, and the mode that compiled it.
 *
 * The block model has no style field, so a design exists only as the utility
 * classes on the wrapper. Without a record of what this panel generated, every
 * reopen reads the whole applied class string back as `customClasses` — and the
 * next apply emits a second copy of every utility. Remembering the draft is
 * how the panel reverses its own compiler without guessing.
 */
export interface ComposerStyleMemory {
  mode: VisualComposerMode;
  styles: VisualComposerStyles;
}

/** A plain-data copy: memory must not alias the draft the panel keeps editing. */
export function cloneStyles(styles: VisualComposerStyles): VisualComposerStyles {
  return JSON.parse(JSON.stringify(styles)) as VisualComposerStyles;
}

/**
 * The tokens every block-mode draft already generates.
 *
 * These cannot ground a remembered design: `text-left` is on nearly every
 * wrapper, including one this panel never touched. A design is recognisable
 * only by a token that distinguishes it from the defaults.
 */
const DEFAULT_BLOCK_CLASS_TOKENS = new Set(
  compileClassNames('block', DEFAULT_VC_STYLES).split(/\s+/).filter(Boolean)
);

/**
 * The styles a block's own markup currently declares.
 *
 * The block is the source of truth only for what its HTML can carry: an anchor
 * id, hand-authored classes, inline CSS, a pinned theme, a badge. Everything
 * else starts from the editor's defaults, because the block model has no field
 * for it — the design controls are a draft that becomes markup when applied.
 *
 * A remembered design fills that gap, but only while the markup still carries
 * it: see the grounding check below.
 */
/**
 * Assembles the block's effective inline CSS styles.
 * If a background image URL is configured, adds `background-image: url(...)` to
 * ensure reliable rendering across browsers without requiring Tailwind AOT compilation.
 */
export function compileEffectiveCustomStyle(
  styles: VisualComposerStyles,
  mode: VisualComposerMode
): string {
  const parts: string[] = [];
  if (styles.customStyle?.trim()) {
    parts.push(styles.customStyle.trim());
  }
  const bgImg =
    mode === 'section' ? styles.section?.bgImage?.trim() : styles.background?.image?.trim();
  if (bgImg && !parts.some((p) => p.includes('background-image:'))) {
    const cleanUrl = bgImg.startsWith('url(')
      ? bgImg
      : `url('${bgImg.replace(/['"\s]/g, '')}')`;
    parts.push(`background-image: ${cleanUrl};`);
  }
  return parts.join(' ').trim();
}

export function readComposerStylesFromBlock(
  block: Block,
  memory?: ComposerStyleMemory
): VisualComposerStyles {
  const next: VisualComposerStyles = { ...DEFAULT_VC_STYLES };
  const shell = readBlockShell(block);

  if (shell) {
    /*
     * Every token on the root, split once. `cw-*` classes are structure, not
     * design: the block parser uses them to know a callout is a callout. They
     * are the page's to own, and the serializer re-attaches them on every write,
     * so the design panel never carries them into `customClasses` where a reset
     * would delete them.
     */
    const wrapperTokens = shell.className.split(/\s+/).filter(Boolean);

    /*
     * The tokens the remembered draft generated. Section-mode designs are not
     * replayed here: the block controls describe a block, and a row design
     * restored into them would describe something else.
     */
    const remembered = memory?.mode === 'block' ? memory : undefined;
    const generated = new Set(
      remembered
        ? compileClassNames('block', { ...remembered.styles, customClasses: '' })
            .split(/\s+/)
            .filter(Boolean)
        : []
    );
    const signature = new Set(
      [...generated].filter((token) => !DEFAULT_BLOCK_CLASS_TOKENS.has(token))
    );

    /*
     * The memory has to be grounded in the markup to be used. A design the panel
     * wrote is only still there while the wrapper carries one of the tokens that
     * distinguish that design from the defaults; an overlay undo, a revert or an
     * external rewrite removes them. Reading a remembered design out of markup
     * that no longer has it would show controls for a look the page does not
     * have, and the next apply would write that look back.
     */
    const grounded =
      remembered !== undefined &&
      (signature.size > 0
        ? wrapperTokens.some((token) => signature.has(token))
        : wrapperTokens.some((token) => generated.has(token)));

    if (grounded && remembered) {
      Object.assign(next, cloneStyles(remembered.styles));
      /*
       * Identity stays markup-owned. An anchor id identifies one element, so a
       * batch's primary anchor must not follow the memory onto every target;
       * the badge lives in the block's HTML rather than in the design fields;
       * and inline CSS is the Code tab's, not the design's.
       */
      next.anchorId = DEFAULT_VC_STYLES.anchorId;
      next.customStyle = '';
      next.customClasses = '';
      next.themeMode = DEFAULT_VC_STYLES.themeMode;
      next.badgeText = '';
      next.badgeTone = DEFAULT_VC_STYLES.badgeTone;
      next.badgePosition = DEFAULT_VC_STYLES.badgePosition;
    }

    if (shell.anchorId) next.anchorId = shell.anchorId;
    if (shell.style) next.customStyle = shell.style;

    /*
     * What is left of the root is the operator's own classes. Subtracting the
     * generated tokens is what prevents the next apply from emitting every
     * utility a second time; CSS source order, not class-attribute order, would
     * decide which copy wins. Without a grounded memory there is nothing to
     * subtract, so this is the read of the root.
     */
    const themeTokens = new Set(THEME_CLASS_TOKENS);
    next.customClasses = wrapperTokens
      .filter(
        (token) =>
          !isStructuralBlockClass(token) &&
          !themeTokens.has(token) &&
          (!grounded || !generated.has(token))
      )
      .join(' ');
    if (shell.themeMode) next.themeMode = shell.themeMode;
  }

  // Restore the decorative badge ribbon if the block carries one.
  if ('html' in block && typeof block.html === 'string') {
    const badgeMatch = block.html.match(/<span\s+data-vc-badge(?:[^>]*)>(.*?)<\/span>/i);
    if (badgeMatch) {
      const text = badgeMatch[1].trim();
      const toneMatch = badgeMatch[0].match(/data-tone=["']([^"']+)["']/);
      const posMatch = badgeMatch[0].match(/data-pos=["']([^"']+)["']/);
      next.badgeText = text;
      next.badgeTone = (toneMatch?.[1] as VisualComposerStyles['badgeTone']) || 'gold';
      next.badgePosition = (posMatch?.[1] as VisualComposerStyles['badgePosition']) || 'top-right';
    }
  }

  return next;
}

/** One undo step: both halves of the draft, because both reach the page together. */
export interface ComposerSnapshot {
  styles: VisualComposerStyles;
  block: Block | null;
}

/**
 * Return a copy of `current` with the named keys taken from `baseline`.
 *
 * `Object.assign` per key keeps the assignment typed against the real key
 * rather than launder the whole object through a cast.
 */
export function revertKeys(
  current: VisualComposerStyles,
  baseline: VisualComposerStyles,
  keys: readonly (keyof VisualComposerStyles)[]
): VisualComposerStyles {
  const next = { ...current };
  for (const key of keys) {
    Object.assign(next, { [key]: baseline[key] });
  }
  return next;
}

/**
 * The block a save will write, with the draft badge folded in.
 *
 * The live preview composes the same block before extracting its copy, so the
 * page cannot show a badge the write omits — or show the old badge after the
 * operator changed it. The regular expression is the one the save always used:
 * an existing badge is replaced, never stacked.
 */
export function composeDraftBlock(block: Block, styles: VisualComposerStyles): Block {
  const finalBlock: Block = { ...block };
  /*
   * A row has no content root a badge can live in, and folding one in would
   * turn the row into an `unsupported` block — the save would replace a layout
   * with its own raw markup. The badge controls are hidden for rows; this is
   * the second half of that contract, so a draft carried over from another
   * block cannot corrupt one either.
   */
  if (finalBlock.type === 'row') return finalBlock;
  const badgeHtml = compileBadgeHtml(styles);
  if ('html' in finalBlock && typeof finalBlock.html === 'string') {
    let content = finalBlock.html.replace(/<span\s+data-vc-badge[^>]*>.*?<\/span>/gi, '');
    if (badgeHtml) content = `${badgeHtml}${content}`;
    return { ...finalBlock, html: content };
  }
  if (!badgeHtml) return finalBlock;
  const serialized = serializeBlocks([finalBlock]);
  return { id: finalBlock.id, type: 'unsupported', html: `${badgeHtml}${serialized}` };
}

/**
 * The inside of the one element a serialized block produces.
 *
 * `null` when there is no single top-level element to read — a document of
 * nothing, or unsupported markup with several roots. Painting nothing is the
 * honest answer there; guessing would put copy on the page that the save would
 * not write in that shape. A DOM parse rather than string surgery because the
 * serializer's element may nest, and because a void element (a divider) has no
 * inside at all. The server pass skips it: the report runs in an effect.
 */
export function blockInnerHtml(serialized: string): string | null {
  if (typeof document === 'undefined') return null;
  const template = document.createElement('template');
  template.innerHTML = serialized;
  const elements = template.content.children;
  return elements.length === 1 ? elements[0].innerHTML : null;
}
