/**
 * Visual editor domain types.
 *
 * These types are specific to the visual editor's client-side state and events.
 * Shared platform types (Storage, Edge Functions, CRM) live in `src/types/unified.ts`.
 */

// Re-export PublishedSection from visual-sections
export type { PublishedSection } from '@/lib/visual-sections';
// Re-export shared platform types for backward compatibility
export type {
  AddBlockDetail as VisualSectionAddBlockDetail,
  BackendStatus as VisualBackendStatus,
  CopyRegionDefinition,
  DeleteSectionDetail as VisualSectionDeleteDetail,
  DuplicateSectionDetail as VisualSectionDuplicateDetail,
  EdgeFunctionHealth as VisualEdgeFunctionHealth,
  FocusSectionDetail as VisualSectionFocusEventDetail,
  MediaFolder as VisualMediaFolder,
  MediaItem as VisualMediaItem,
  MediaUploadResult as VisualMediaUploadResult,
  MoveSectionDetail as VisualSectionMoveEventDetail,
  ToggleSectionDetail as VisualSectionToggleEventDetail,
  VisualSaveResult,
  VisualSectionOverlayItem,
  VisualSectionsPublishedDetail,
} from './unified';

/**
 * The `content` row the visual editor is bound to.
 *
 * A structural `Pick<ContentRow>` rather than a hand-written parallel shape,
 * so a renamed column breaks the build instead of silently lying at runtime.
 * `metadata` arrives as `Json` from PostgREST; the overlay only reads the
 * string map it writes, hence the narrowed record on top of the picked row.
 */
export interface VisualContentRow
  extends Pick<
    {
      id: number;
      title: string;
      slug: string;
      excerpt: string | null;
      type: string;
      status: string;
      body: string | null;
      featured_image: string | null;
      metadata: Record<string, string> | null;
      created_at: string | null;
      published_at: string | null;
      updated_at: string | null;
    },
    | 'id'
    | 'title'
    | 'slug'
    | 'excerpt'
    | 'type'
    | 'status'
    | 'body'
    | 'featured_image'
    | 'created_at'
    | 'published_at'
    | 'updated_at'
  > {
  metadata: Record<string, string> | null;
}

/** Where a picked piece of media is going. */
export type VisualMediaTarget = 'featured' | 'section';

/** Whether the overlay has unsaved changes, and what happened last. */
export interface VisualSaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  /** Snapshot the last successful save wrote, for the dirty comparison. */
  savedSnapshot: string | null;
  error?: string;
  /** True when a save was refused because someone else wrote first. */
  conflict?: boolean;
}

/** Event names for window CustomEvents between navbar and overlay. */
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
} as const;

/** Every event the visual editor puts on the window. */
export type VisualEventName = keyof typeof VISUAL_EDIT_EVENTS;
