// @vitest-environment jsdom-same-realm
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyVisualEditRail,
  VISUAL_EDIT_RAIL_VAR,
  VISUAL_EDIT_RAIL_WIDTHS,
  visualEditRailWidth,
} from '@/lib/visual-edit-layout';

/**
 * The composer route reserves the sidebar's width. The width has to come from
 * one place: the sidebar's `w-12` / `w-72` / `w-[28rem]` classes and the route's
 * `var(--visual-edit-rail-width)` are otherwise three numbers that can drift
 * without either side failing.
 */
describe('visual edit rail', () => {
  afterEach(() => {
    applyVisualEditRail(null);
  });

  it('maps every sidebar mode to the width the sidebar renders', () => {
    expect(visualEditRailWidth('expanded')).toBe('18rem');
    expect(visualEditRailWidth('wide')).toBe('28rem');
    expect(visualEditRailWidth('collapsed')).toBe('3rem');
    expect(visualEditRailWidth('expanded')).toBe(VISUAL_EDIT_RAIL_WIDTHS.expanded);
  });

  it('publishes the current width on the document root', () => {
    applyVisualEditRail('expanded');
    expect(document.documentElement.style.getPropertyValue(VISUAL_EDIT_RAIL_VAR)).toBe('18rem');

    applyVisualEditRail('wide');
    expect(document.documentElement.style.getPropertyValue(VISUAL_EDIT_RAIL_VAR)).toBe('28rem');

    applyVisualEditRail('collapsed');
    expect(document.documentElement.style.getPropertyValue(VISUAL_EDIT_RAIL_VAR)).toBe('3rem');
  });

  it('clears the property so the route fallback applies', () => {
    applyVisualEditRail('expanded');
    applyVisualEditRail(null);

    // Removed, not set to 0px: the composer's `var(..., 0px)` fallback is what
    // makes every other route ignore the rail, including the server render.
    expect(document.documentElement.style.getPropertyValue(VISUAL_EDIT_RAIL_VAR)).toBe('');
  });
});
