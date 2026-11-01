import type { VisualComposerThemeMode } from '@/types/visual-composer';

/**
 * The theme a block records in its class list.
 *
 * The compiler writes a Tailwind variant token for the theme because the class
 * attribute is the only design surface the sanitizer permits. The serializer
 * then turns that token into the real `data-theme` / `data-theme-mode`
 * attribute the page's CSS reads. One mapping, both directions, so a token the
 * compiler does not write cannot become an attribute the save does.
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

/** The attribute a saved root carries for a theme, or null for `inherit`. */
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
 * Read the theme an already-saved class list records.
 *
 * Same precedence as the writer: dark, then light, then system. A class list
 * carrying two theme tokens is malformed markup, and picking the same one in
 * both directions is what keeps a reopen from changing the theme.
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
