import type { VisualComposerThemeMode } from '@/types/visual-composer';
import { serializeBlocks } from './serialize';
import { isWrappedBlockHtml, structuralClassesOf } from './structural';
import type { Block } from './types';

/**
 * The shape a saved block's design takes.
 *
 * `replace` is a block whose markup already owns a `<div>`: the save rewrites
 * that wrapper's attributes. `wrap` is a plain `<h2>`, `<p>` or serialized
 * non-HTML block: the save leaves the element and adds a wrapper around it.
 *
 * The live preview, both save paths and the design reader all used to derive
 * this split, and the theme mapping that rides on it, independently. The
 * guarantee that makes the preview honest — "it paints what the save writes" —
 * therefore had four copies and nothing enforcing it. They live here now.
 */
export type BlockShell = 'replace' | 'wrap';

/**
 * The theme a wrapper records in its class list.
 *
 * The compiler writes a Tailwind variant token for the theme because the class
 * attribute is the only design surface the sanitizer permits. The save then
 * turns that token into the real `data-theme` / `data-theme-mode` attribute the
 * page's CSS reads. One mapping, both directions, so a token the compiler does
 * not write cannot become an attribute the save does.
 */
const THEME_CLASS_TOKENS_BY_MODE = {
  dark: '[data-theme=dark] [color-scheme:dark]',
  light: '[data-theme=light] [color-scheme:light]',
  system: '[data-theme-mode=system]',
} as const satisfies Record<Exclude<VisualComposerThemeMode, 'inherit'>, string>;

/** Every theme token, for a reset that must remove all of them. */
export const THEME_CLASS_TOKENS: readonly string[] = Object.values(
  THEME_CLASS_TOKENS_BY_MODE
).flatMap((tokens) => tokens.split(' '));

/** The class tokens the compiler appends for a theme, or an empty string. */
export function themeClassTokens(mode?: VisualComposerThemeMode): string {
  return mode === 'dark' || mode === 'light' || mode === 'system'
    ? THEME_CLASS_TOKENS_BY_MODE[mode]
    : '';
}

/** The attribute a saved wrapper carries for a theme, or null for `inherit`. */
export function themeAttributesFor(
  mode: VisualComposerThemeMode | undefined
): { name: 'data-theme' | 'data-theme-mode'; value: 'dark' | 'light' | 'system' } | null {
  if (mode === 'dark' || mode === 'light') return { name: 'data-theme', value: mode };
  if (mode === 'system') return { name: 'data-theme-mode', value: 'system' };
  return null;
}

/** Read a theme mode out of a `data-theme` / `data-theme-mode` value. */
export function themeModeFromAttribute(
  value: string | null | undefined
): VisualComposerThemeMode | null {
  return value === 'dark' || value === 'light' || value === 'system' ? value : null;
}

/**
 * Read the theme an already-saved wrapper records in its class list.
 *
 * Same precedence as the save's writer: dark, then light, then system. A class
 * list carrying two theme tokens is malformed markup, and picking the same one
 * in both directions is what keeps a reopen from changing the theme.
 */
export function themeModeFromClassList(
  className: string | null | undefined
): VisualComposerThemeMode | null {
  if (!className) return null;
  if (className.includes('[data-theme=dark]')) return 'dark';
  if (className.includes('[data-theme=light]')) return 'light';
  if (className.includes('[data-theme-mode=system]')) return 'system';
  return null;
}

export interface BlockShellDesign {
  /** Compiled design utilities, without the block's structural classes. */
  customClasses?: string;
  /** The anchor id, for the single-block path; batch styling omits it. */
  anchorId?: string;
  /** Inline CSS from the Code tab. */
  customStyle?: string;
}

/** The `<div …>` the save writes around a block, attributes in save order. */
function shellOpeningTag(block: Block, design: BlockShellDesign): string {
  const idAttr = design.anchorId ? ` id="${design.anchorId}"` : '';
  const mergedClasses = [design.customClasses, structuralClassesOf(block)]
    .filter(Boolean)
    .join(' ')
    .trim();
  const classAttr = mergedClasses ? ` class="${mergedClasses}"` : '';
  const theme = themeAttributesFor(themeModeFromClassList(design.customClasses) ?? 'inherit');
  const themeAttr = theme ? ` ${theme.name}="${theme.value}"` : '';
  const styleAttr = design.customStyle ? ` style="${design.customStyle}"` : '';
  return `<div${idAttr}${classAttr}${themeAttr}${styleAttr}>`;
}

/**
 * Apply a design to one block, exactly as the page stores it.
 *
 * Both save paths call this. A block with its own wrapper has that wrapper's
 * attributes replaced, keeping the inner markup; a plain block is wrapped
 * whole; a block with no authorable HTML is serialized and wrapped as an
 * `unsupported` block. Those are the three shapes the overlay used to spell
 * out in two places.
 */
export function applyBlockShell(block: Block, design: BlockShellDesign): Block {
  const openingTag = shellOpeningTag(block, design);

  if ('html' in block && typeof block.html === 'string') {
    const html = block.html.trim();
    if (isWrappedBlockHtml(html)) {
      const openingEnd = html.indexOf('>');
      const inner = openingEnd === -1 ? html : html.slice(openingEnd + 1, -'</div>'.length);
      return { ...block, html: `${openingTag}${inner}</div>` };
    }
    return { ...block, html: `${openingTag}${html}</div>` };
  }

  return {
    id: block.id,
    type: 'unsupported',
    html: `${openingTag}${serializeBlocks([block])}</div>`,
  };
}

/**
 * The shell the *preview* paints for a block.
 *
 * For markup blocks this is the save's shape: replace the existing wrapper, or
 * add the design tokens to the element rather than moving it into a new div.
 * A block with no authorable HTML — a figure, a list — is painted as its own
 * element even though its save will include a wrapper: moving a live node into
 * a new div takes it out from under the section pairing, and the preview's job
 * is to show the design without changing the page's addressability.
 */
export function previewShellForBlock(block: Block | undefined): BlockShell {
  if (!block || !('html' in block) || typeof block.html !== 'string') return 'replace';
  return isWrappedBlockHtml(block.html) ? 'replace' : 'wrap';
}
