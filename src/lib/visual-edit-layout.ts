/**
 * How much room the visual editor's right rail needs.
 *
 * The sidebar is `fixed`, so the page underneath has no idea it is there. On a
 * laptop the 18rem expanded rail covered the right edge of the canvas — the
 * exact part of the page an admin was judging — and on the dedicated composer
 * route that turned "edit at the real width" into "edit a cropped page".
 *
 * The rail width is published as a CSS custom property on the document root and
 * the composer route reserves it. It is a property rather than a React context
 * because the sidebar and the route are in different trees (the sidebar is
 * mounted by the root layout, the route is a Server Component), and the width
 * is one number, not state either side needs to subscribe to.
 *
 * These strings mirror the sidebar's own `w-12` / `w-72` classes. Keeping the
 * pair beside each other is what makes a change to one notice the other; a
 * class cannot be read from CSS at runtime.
 */

export const VISUAL_EDIT_RAIL_VAR = '--visual-edit-rail-width';

/** Collapsed icon strip / expanded inspector, matching `VisualEditorSidebar`. */
export const VISUAL_EDIT_RAIL_WIDTHS = {
  collapsed: '3rem',
  expanded: '18rem',
} as const;

export function visualEditRailWidth(collapsed: boolean): string {
  return collapsed ? VISUAL_EDIT_RAIL_WIDTHS.collapsed : VISUAL_EDIT_RAIL_WIDTHS.expanded;
}

/**
 * Publish the rail width, or clear it when there is no rail.
 *
 * Clearing is a removal rather than `0px`: the composer route's `var(..., 0px)`
 * fallback then applies on the server and on any route the editor is not
 * mounted on, without leaving a zero-valued property behind for the next page.
 */
export function applyVisualEditRail(collapsed: boolean | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (collapsed === null) {
    root.style.removeProperty(VISUAL_EDIT_RAIL_VAR);
    return;
  }
  root.style.setProperty(VISUAL_EDIT_RAIL_VAR, visualEditRailWidth(collapsed));
}
