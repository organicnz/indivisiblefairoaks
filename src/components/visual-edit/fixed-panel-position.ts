/**
 * Keep a fixed-position panel inside the visual viewport.
 *
 * Both the block context menu and the slash palette render at an anchor, then
 * use this measured calculation to keep the panel on screen. `maxHeight` lets
 * a panel that is taller than the remaining space scroll internally instead of
 * running off the bottom of the window.
 */
export const FIXED_PANEL_VIEWPORT_MARGIN = 8;

export interface FixedPanelPosition {
  left: number;
  top: number;
  maxHeight: number;
}

export interface FixedPanelMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
}

export function clampFixedPanelPosition({
  x,
  y,
  width,
  height,
  viewportWidth,
  viewportHeight,
  margin = FIXED_PANEL_VIEWPORT_MARGIN,
}: FixedPanelMetrics): FixedPanelPosition {
  const gutter = Math.max(0, margin);
  const panelWidth = Math.max(0, width);
  const panelHeight = Math.max(0, height);
  const maxLeft = Math.max(gutter, viewportWidth - panelWidth - gutter);
  const maxTop = Math.max(gutter, viewportHeight - panelHeight - gutter);
  const left = Math.min(Math.max(gutter, x), maxLeft);
  const top = Math.min(Math.max(gutter, y), maxTop);

  return {
    left,
    top,
    maxHeight: Math.max(0, viewportHeight - top - gutter),
  };
}
