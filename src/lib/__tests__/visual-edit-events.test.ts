import { describe, expect, it, vi } from 'vitest';
import {
  addBlockVisual,
  convertSectionVisual,
  deleteSectionVisual,
  duplicateSectionVisual,
  focusSectionVisual,
  moveSectionVisual,
  openCRMVisual,
  openMediaLibraryVisual,
  openRevisionsVisual,
  openSettingsVisual,
  readVisualEventDetail,
  selectCopyRegion,
  toggleSectionVisual,
  VISUAL_EDIT_EVENTS,
} from '@/lib/visual-edit-events';
import type {
  AddBlockDetail,
  FocusSectionDetail,
  MoveSectionDetail,
  ToggleSectionDetail,
} from '@/types/unified';

/**
 * A window that records what was dispatched, in order.
 *
 * The events module is the seam between the navbar and the overlay: a name
 * that disagrees between them is a control that fires and is never heard, and
 * nothing about that failure is visible. These tests pin the names and the
 * payload shapes at the seam itself.
 */
function recordingWindow() {
  const seen: Array<{ type: string; detail: unknown }> = [];
  const listener = (event: Event) => {
    seen.push({ type: event.type, detail: (event as CustomEvent).detail ?? null });
  };

  const original = globalThis.window;
  vi.stubGlobal(
    'window',
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === 'dispatchEvent') return (event: Event) => listener(event);
          if (prop === 'CustomEvent') return CustomEvent;
          return undefined;
        },
      }
    )
  );

  return {
    seen,
    restore: () => {
      vi.unstubAllGlobals();
      void original;
    },
  };
}

describe('VISUAL_EDIT_EVENTS', () => {
  it('names every intent the navbar and the overlay share', () => {
    // The render-side names the overlay listens on. A name changed here without
    // the listener following is the silent failure this whole module prevents.
    expect(VISUAL_EDIT_EVENTS.toggleSection).toBe('indivisible:toggle-section-visual');
    expect(VISUAL_EDIT_EVENTS.focusSection).toBe('indivisible:focus-section');
    expect(VISUAL_EDIT_EVENTS.moveSection).toBe('indivisible:move-section');
    expect(VISUAL_EDIT_EVENTS.duplicateSection).toBe('indivisible:duplicate-section');
    expect(VISUAL_EDIT_EVENTS.deleteSection).toBe('indivisible:delete-section');
    expect(VISUAL_EDIT_EVENTS.addBlock).toBe('indivisible:add-block');
    expect(VISUAL_EDIT_EVENTS.addBlockAt).toBe('indivisible:add-block-at');
    expect(VISUAL_EDIT_EVENTS.sectionsPublished).toBe('indivisible:page-sections-updated');
    expect(VISUAL_EDIT_EVENTS.selectRegion).toBe('indivisible:select-region');
    expect(VISUAL_EDIT_EVENTS.openMediaLibrary).toBe('indivisible:open-media-library');
    expect(VISUAL_EDIT_EVENTS.openRevisions).toBe('indivisible:open-revisions');
    expect(VISUAL_EDIT_EVENTS.openSettings).toBe('indivisible:open-settings');
    expect(VISUAL_EDIT_EVENTS.openCRM).toBe('indivisible:open-crm');
  });

  it('is namespaced, so nothing on the window collides', () => {
    for (const name of Object.values(VISUAL_EDIT_EVENTS)) {
      expect(name.startsWith('indivisible:')).toBe(true);
    }
  });
});

describe('emitters', () => {
  it.each([
    ['system', 'light', 'dark'],
    ['light', 'system', 'light'],
    ['dark', 'dark', 'system'],
  ])('selectCopyRegion stamps %s', (regionId) => {
    const win = recordingWindow();
    selectCopyRegion(regionId as string | null);
    expect(win.seen).toHaveLength(1);
    expect(win.seen[0].type).toBe(VISUAL_EDIT_EVENTS.selectRegion);
    const detail = win.seen[0].detail as { regionId: string | null; at: number };
    expect(detail.regionId).toBe(regionId);
    // The timestamp is what lets a repeat of the same region re-load.
    expect(typeof detail.at).toBe('number');
    win.restore();
  });

  it('toggleSectionVisual carries a block coordinate or the all flag', () => {
    const win = recordingWindow();
    toggleSectionVisual({ blockIndex: 3, enabled: true });
    toggleSectionVisual({ all: true });
    expect(win.seen[0].detail).toEqual<ToggleSectionDetail>({
      blockIndex: 3,
      enabled: true,
    });
    expect(win.seen[1].detail).toEqual<ToggleSectionDetail>({ all: true });
    win.restore();
  });

  it('focusSectionVisual passes openEdit through', () => {
    const win = recordingWindow();
    focusSectionVisual({ blockIndex: 7, openEdit: true });
    expect(win.seen[0].detail).toEqual<FocusSectionDetail>({
      blockIndex: 7,
      openEdit: true,
    });
    win.restore();
  });

  it('moveSectionVisual carries a direction', () => {
    const win = recordingWindow();
    moveSectionVisual({ blockIndex: 1, direction: 'down' });
    expect(win.seen[0].detail).toEqual<MoveSectionDetail>({
      blockIndex: 1,
      direction: 'down',
    });
    win.restore();
  });

  it('duplicate and delete carry the block index', () => {
    const win = recordingWindow();
    duplicateSectionVisual({ blockIndex: 2 });
    deleteSectionVisual({ blockIndex: 2 });
    expect(win.seen[0].detail).toEqual({ blockIndex: 2 });
    expect(win.seen[1].detail).toEqual({ blockIndex: 2 });
    expect(win.seen[0].type).toBe(VISUAL_EDIT_EVENTS.duplicateSection);
    expect(win.seen[1].type).toBe(VISUAL_EDIT_EVENTS.deleteSection);
    win.restore();
  });

  it('convertSectionVisual carries the block index and target type options', () => {
    const win = recordingWindow();
    convertSectionVisual({ blockIndex: 3, type: 'callout', calloutTone: 'warning' });
    expect(win.seen[0].type).toBe(VISUAL_EDIT_EVENTS.convertSection);
    expect(win.seen[0].detail).toEqual({
      blockIndex: 3,
      type: 'callout',
      calloutTone: 'warning',
    });
    win.restore();
  });

  /**
   * The append/insert split is the overlay's, not this module's opinion.
   *
   * A positionless add appends; `insertAfterBlockIndex` routes to the
   * insertion event so a block added while a region is active lands inside it
   * rather than at the bottom of the page. Collapsing the two would silently
   * move every region-scoped insert to the page end.
   */
  it('addBlockVisual appends without a position and inserts with one', () => {
    const win = recordingWindow();
    addBlockVisual();
    addBlockVisual({ type: 'paragraph' });
    addBlockVisual({ insertAfterBlockIndex: 5, type: 'paragraph' });

    expect(win.seen[0].type).toBe(VISUAL_EDIT_EVENTS.addBlock);
    expect(win.seen[1].type).toBe(VISUAL_EDIT_EVENTS.addBlock);
    expect(win.seen[2].type).toBe(VISUAL_EDIT_EVENTS.addBlockAt);
    expect(win.seen[2].detail).toEqual<AddBlockDetail>({
      insertAfterBlockIndex: 5,
      type: 'paragraph',
    });
    win.restore();
  });

  it('the panel openers dispatch no payload', () => {
    const win = recordingWindow();
    openMediaLibraryVisual();
    openRevisionsVisual();
    openSettingsVisual();
    openCRMVisual();
    expect(win.seen.map((s) => s.type)).toEqual([
      VISUAL_EDIT_EVENTS.openMediaLibrary,
      VISUAL_EDIT_EVENTS.openRevisions,
      VISUAL_EDIT_EVENTS.openSettings,
      VISUAL_EDIT_EVENTS.openCRM,
    ]);
    expect(win.seen.every((s) => s.detail === null)).toBe(true);
    win.restore();
  });
});

describe('readVisualEventDetail', () => {
  it('returns the detail of one of our events', () => {
    const event = new CustomEvent(VISUAL_EDIT_EVENTS.toggleSection, {
      detail: { blockIndex: 4, enabled: false },
    });
    expect(readVisualEventDetail<ToggleSectionDetail>(event)).toEqual({
      blockIndex: 4,
      enabled: false,
    });
  });

  it('returns null for an event with no detail', () => {
    expect(readVisualEventDetail(new Event('anything'))).toBeNull();
  });
});
