/**
 * Visual editor domain types.
 *
 * These were the last third of `src/types/crm.ts`, which made one file the
 * source of truth for two unrelated domains and meant a reader looking for the
 * CRM's media types had to scroll past the section editor's event signatures.
 * They live here now, next to `src/lib/visual-sections.ts` which is the module
 * that actually produces most of them.
 *
 * Only what a component imports is declared. The previous version also carried
 * a parallel `VisualSection`, `VisualSectionMedia`, `VisualSectionSaveResult`
 * and five more that nothing imported — a second, subtly different model of the
 * same thing, which is worse than no model because it looks like the real one.
 */

import type { BlockType } from '@/lib/blocks';
import type { PublishedSection, VisualSection } from '@/lib/visual-sections';

export type { PublishedSection, VisualSection };

/**
 * The `content` row the visual editor is bound to.
 *
 * A structural subset rather than `ContentRow`, because the overlay reads it
 * through a server action that returns the row and the editor keeps a local
 * copy it rewrites after each save. Declaring the whole row would promise
 * columns the overlay never reads and would silently start lying the day one
 * of them was renamed.
 */
export interface VisualContentRow {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  type: string;
  status: string;
  body: string | null;
  featured_image: string | null;
  metadata: Record<string, string> | null;
  created_at?: string | null;
  published_at?: string | null;
  /**
   * The optimistic-concurrency preimage.
   *
   * Adopted from every save's response rather than from the clock, because a
   * `BEFORE UPDATE` trigger owns this column and two clocks disagree. See
   * `saveContent` in `src/lib/actions/content.ts`.
   */
  updated_at?: string | null;
}

/** Where a picked piece of media is going. */
export type CRMMediaTarget = 'featured' | 'section';

/**
 * One positioned frame drawn over the page.
 *
 * `blockIndex` is the coordinate every mutation uses; `index` is the DOM
 * ordinal the frame was measured from. Both are carried because the frame is
 * positioned from the element and the edit is applied to the block, and losing
 * either one means re-deriving it by guessing.
 */
export interface VisualSectionOverlayItem {
  index: number;
  label: string;
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
  blockIndex: number;
  blockType: BlockType;
}

/** A media folder the editor can browse, and therefore delete from. */
export type VisualMediaFolder = 'crm' | 'content' | 'products';

/** Whether the overlay has unsaved changes, and what happened last. */
export interface VisualSaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  /** Snapshot the last successful save wrote, for the dirty comparison. */
  savedSnapshot: string | null;
  error?: string;
  /** True when a save was refused because someone else wrote first. */
  conflict?: boolean;
}

// ── Event payloads ─────────────────────────────────────────────────────────
//
// The navbar and the overlay are two client components whose only common
// ancestor is the root layout, a Server Component, so they talk over window
// CustomEvents. These are the shapes.
//
// Every one of them addresses a section by `blockIndex` — the overlay's own
// coordinate, carried on the `PublishedSection` the header renders. An earlier
// revision used the DOM ordinal and had the overlay translate, which is the
// design that produced the wrong-block bug: the header's ordinal and the
// overlay's block index were only equal while the sanitizer had removed
// nothing, and the failure was silent. One coordinate, end to end, cannot
// disagree with itself.

export interface VisualSectionToggleEventDetail {
  /** Block index, or omit when `all` is set. */
  blockIndex?: number;
  enabled?: boolean;
  all?: boolean;
}

export interface VisualSectionFocusEventDetail {
  blockIndex: number;
  openEdit?: boolean;
  highlightOnly?: boolean;
}

export interface VisualSectionMoveEventDetail {
  blockIndex: number;
  direction: 'up' | 'down';
}

export interface VisualSectionAddBlockDetail {
  /** Block index to insert after; omit to append. */
  insertAfterBlockIndex?: number;
  type?: BlockType;
}

export interface VisualSectionDuplicateDetail {
  blockIndex: number;
}

export interface VisualSectionDeleteDetail {
  blockIndex: number;
}

/** The event the overlay dispatches so the navbar renders the real model. */
export interface VisualSectionsPublishedDetail {
  sections: PublishedSection[];
  pathname: string;
}
