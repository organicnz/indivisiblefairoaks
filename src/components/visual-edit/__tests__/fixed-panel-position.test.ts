// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  clampFixedPanelPosition,
  FIXED_PANEL_VIEWPORT_MARGIN,
} from '@/components/visual-edit/fixed-panel-position';

const viewport = { viewportWidth: 1024, viewportHeight: 768 };
const panel = { width: 220, height: 300 };

describe('clampFixedPanelPosition', () => {
  it('leaves a panel that fits at the pointer', () => {
    expect(
      clampFixedPanelPosition({
        ...viewport,
        ...panel,
        x: 100,
        y: 150,
      })
    ).toEqual({ left: 100, top: 150, maxHeight: 610 });
  });

  it('pulls a panel back from the right and bottom edges', () => {
    expect(
      clampFixedPanelPosition({
        ...viewport,
        ...panel,
        x: 1022,
        y: 760,
      })
    ).toEqual({ left: 796, top: 460, maxHeight: 300 });
  });

  it('uses the gutter for negative pointer coordinates', () => {
    expect(
      clampFixedPanelPosition({
        ...viewport,
        ...panel,
        x: -40,
        y: -10,
      })
    ).toEqual({
      left: FIXED_PANEL_VIEWPORT_MARGIN,
      top: FIXED_PANEL_VIEWPORT_MARGIN,
      maxHeight: 752,
    });
  });

  it('pins a panel larger than the viewport to the top-left gutter', () => {
    expect(
      clampFixedPanelPosition({
        ...viewport,
        width: 1200,
        height: 900,
        x: 500,
        y: 500,
      })
    ).toEqual({
      left: FIXED_PANEL_VIEWPORT_MARGIN,
      top: FIXED_PANEL_VIEWPORT_MARGIN,
      maxHeight: 752,
    });
  });

  it('honors a custom viewport margin', () => {
    expect(
      clampFixedPanelPosition({
        ...viewport,
        ...panel,
        x: 1022,
        y: 760,
        margin: 12,
      })
    ).toEqual({ left: 792, top: 456, maxHeight: 300 });
  });
});
