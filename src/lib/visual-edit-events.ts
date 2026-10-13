/**
 * Visual-editor events — one name per intent, both ends of the wire.
 *
 * The navbar and the overlay are two client components whose only common
 * ancestor is the root layout, a Server Component, so they talk over
 * `window` CustomEvents. The names were previously written twice: once where
 * the navbar dispatches and once where the overlay listens. Two literals that
 * must match is how a control ends up addressing nothing — the event fires,
 * nobody hears it, and the page shows no error.
 *
 * So this module owns the names and the emitters, and both sides import.
 * The payload types stay in `src/types/visual-edit.ts`; this file carries the
 * names and the dispatch, because those are the parts that must agree.
 *
 * Deliberately free of React so the overlay, the navbar and the tests all
 * resolve the same string without rendering anything.
 */

import type {
  AddBlockDetail,
  ConvertSectionDetail,
  DeleteSectionDetail,
  DuplicateSectionDetail,
  FocusSectionDetail,
  MoveSectionDetail,
  ToggleSectionDetail,
} from '@/types/unified';

/** Every event the visual editor puts on the window. */
export const VISUAL_EDIT_EVENTS = {
  /** The overlay publishes the document's real section list. */
  sectionsPublished: 'indivisible:page-sections-updated',
  /** The navbar asks the overlay to load a different copy region. */
  selectRegion: 'indivisible:select-region',
  /** Frame or unframe a block — one, or all at once. */
  toggleSection: 'indivisible:toggle-section-visual',
  /** Scroll to a block, optionally opening its editor. */
  focusSection: 'indivisible:focus-section',
  /** Move a block one position up or down. */
  moveSection: 'indivisible:move-section',
  /** Duplicate a block directly after itself. */
  duplicateSection: 'indivisible:duplicate-section',
  /** Remove a block from the document and persist. */
  deleteSection: 'indivisible:delete-section',
  /** Convert a block to a different block type, preserving content. */
  convertSection: 'indivisible:convert-section',
  /** Insert a block after the active section, or append to the page. */
  addBlock: 'indivisible:add-block',
  /** Insert a block at a specific position. */
  addBlockAt: 'indivisible:add-block-at',
  /** Open the Supabase storage media library. */
  openMediaLibrary: 'indivisible:open-media-library',
  /** Open the revision history panel. */
  openRevisions: 'indivisible:open-revisions',
  /** Open the document settings panel. */
  openSettings: 'indivisible:open-settings',
  /** Open the CRM constituents panel. */
  openCRM: 'indivisible:open-crm',
} as const;

/**
 * Ask the overlay which document to load. No payload means "the whole page".
 *
 * The `at` timestamp is what lets a repeat of the same region re-load: an
 * overlay that compares by region alone treats a second click on the current
 * region as a no-op, which is right for the render and wrong for an operator
 * who wants to re-fetch after an external change.
 */
export function selectCopyRegion(regionId: string | null): void {
  window.dispatchEvent(
    new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
      detail: { regionId, at: Date.now() },
    })
  );
}

/** Frame or unframe one block, or every block when `all` is set. */
export function toggleSectionVisual(detail: ToggleSectionDetail): void {
  window.dispatchEvent(new CustomEvent(VISUAL_EDIT_EVENTS.toggleSection, { detail }));
}

/** Scroll a block into view; `openEdit` opens its inline editor too. */
export function focusSectionVisual(detail: FocusSectionDetail): void {
  window.dispatchEvent(new CustomEvent(VISUAL_EDIT_EVENTS.focusSection, { detail }));
}

export function moveSectionVisual(detail: MoveSectionDetail): void {
  window.dispatchEvent(new CustomEvent(VISUAL_EDIT_EVENTS.moveSection, { detail }));
}

export function duplicateSectionVisual(detail: DuplicateSectionDetail): void {
  window.dispatchEvent(new CustomEvent(VISUAL_EDIT_EVENTS.duplicateSection, { detail }));
}

export function deleteSectionVisual(detail: DeleteSectionDetail): void {
  window.dispatchEvent(new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail }));
}

export function convertSectionVisual(detail: ConvertSectionDetail): void {
  window.dispatchEvent(new CustomEvent(VISUAL_EDIT_EVENTS.convertSection, { detail }));
}

/** Append a block, or insert one after a position when `insertAfterBlockIndex` is set. */
export function addBlockVisual(detail: AddBlockDetail = {}): void {
  const at = detail.insertAfterBlockIndex === undefined;
  window.dispatchEvent(
    new CustomEvent(at ? VISUAL_EDIT_EVENTS.addBlock : VISUAL_EDIT_EVENTS.addBlockAt, { detail })
  );
}

export function openMediaLibraryVisual(): void {
  window.dispatchEvent(new CustomEvent(VISUAL_EDIT_EVENTS.openMediaLibrary));
}

export function openRevisionsVisual(): void {
  window.dispatchEvent(new CustomEvent(VISUAL_EDIT_EVENTS.openRevisions));
}

export function openSettingsVisual(): void {
  window.dispatchEvent(new CustomEvent(VISUAL_EDIT_EVENTS.openSettings));
}

export function openCRMVisual(): void {
  window.dispatchEvent(new CustomEvent(VISUAL_EDIT_EVENTS.openCRM));
}

/**
 * Read a detail off a window event, or null when it is not one of ours.
 *
 * The cast is where a mismatched payload would otherwise hide: both ends
 * import the same types from `src/types/visual-edit.ts`, so a field rename
 * fails the build on the side that reads it rather than reaching here.
 */
export function readVisualEventDetail<T>(event: Event): T | null {
  const detail = (event as CustomEvent<T>).detail;
  return detail ?? null;
}
