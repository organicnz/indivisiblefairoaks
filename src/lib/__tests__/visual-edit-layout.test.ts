// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyVisualEditRail,
  VISUAL_EDIT_RAIL_VAR,
  VISUAL_EDIT_RAIL_WIDTHS,
  visualEditRailWidth,
} from '@/lib/visual-edit-layout';

/**
 * The composer route reserves the sidebar's width. The width has to come from
 * one place: the sidebar's `w-12` / `w-72` classes and the route's
 * `var(--visual-edit-rail-width)` are otherwise two numbers that can drift
 * without either side failing.
 */
describe('visual edit rail', () => {
  afterEach(() => {
    applyVisualEditRail(null);
  });

  it('maps the expanded and collapsed states to the sidebar widths', () => {
    expect(visualEditRailWidth(false)).toBe('18rem');
    expect(visualEditRailWidth(true)).toBe('3rem');
    expect(visualEditRailWidth(false)).toBe(VISUAL_EDIT_RAIL_WIDTHS.expanded);
  });

  it('publishes the current width on the document root', () => {
    applyVisualEditRail(false);
    expect(document.documentElement.style.getPropertyValue(VISUAL_EDIT_RAIL_VAR)).toBe('18rem');

    applyVisualEditRail(true);
    expect(document.documentElement.style.getPropertyValue(VISUAL_EDIT_RAIL_VAR)).toBe('3rem');
  });

  it('clears the property so the route fallback applies', () => {
    applyVisualEditRail(false);
    applyVisualEditRail(null);

    // Removed, not set to 0px: the composer's `var(..., 0px)` fallback is what
    // makes every other route ignore the rail, including the server render.
    expect(document.documentElement.style.getPropertyValue(VISUAL_EDIT_RAIL_VAR)).toBe('');
  });
});
