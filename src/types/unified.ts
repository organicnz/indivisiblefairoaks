/**
 * Unified Domain Types — Visual Editor, CRM, Content, and Platform Integration
 *
 * Single source of truth for types shared across the visual editor, CRM,
 * content management, and Supabase platform integrations (Storage, Edge Functions).
 *
 * This file re-exports and extends types from domain-specific files to provide
 * a unified import path for components that need cross-domain types.
 */

import type { ComposerBlock } from '@/components/admin/crm/composer/types';
import type { ContentBlockType } from '@/lib/blocks';
import type { Database } from '@/types/supabase';

// ==========================================
// 1. Content / Visual Editor Domain
// ==========================================

/** Re-export core block types for unified imports. */
export type {
  Block,
  CalloutTone,
  ContentBlockType,
  HeadingLevel,
} from '@/lib/blocks';

/** The `content` row as used by the visual editor. */
export interface VisualContentRow
  extends Pick<
    Database['public']['Tables']['content']['Row'],
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

/** Section coordinates for visual editing (block index + DOM position). */
export interface VisualSectionCoords {
  /** Block index in the serialized blocks array — the canonical coordinate for mutations. */
  blockIndex: number;
  /** DOM ordinal when the frame was measured (may differ after sanitizer removals). */
  domIndex: number;
  /** @deprecated Use `domIndex` instead. Kept for backward compatibility with overlay code. */
  index: number;
  /** Human-readable label for the section. */
  label: string;
  /** Block type for quick identification. */
  blockType: ContentBlockType;
}

/** Frame rectangle for drawing section overlays. */
export interface VisualSectionFrame {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

/** Complete section overlay item combining coords and frame. */
export interface VisualSectionOverlayItem extends VisualSectionCoords, VisualSectionFrame {}

/** Copy region definition for coded pages. */
export interface CopyRegionDefinition {
  id: string;
  label: string;
}

/** Result of a visual editor save operation. */
export interface VisualSaveResult {
  success: boolean;
  error?: string;
  row?: VisualContentRow;
  conflict?: boolean;
}

// ==========================================
// 2. CRM Domain (re-exported for unified imports)
// ==========================================

export type {
  BroadcastProgress,
  BroadcastRecipient,
  BroadcastTarget,
  ConsentDecision,
  ConsentFilter,
  CRMActivity,
  CRMActivityInsert,
  CRMBroadcast,
  CRMBroadcastEmailEvent,
  CRMBroadcastInsert,
  CRMBroadcastUpdate,
  CRMContact,
  CRMContactInsert,
  CRMContactStatus,
  CRMContactUpdate,
  CRMSegment,
  CRMSegmentInsert,
  CRMSegmentUpdate,
  CRMStats,
  CRMTagCount,
  CRMTask,
  CRMTaskInsert,
  CRMTaskStatus,
  CRMTaskUpdate,
  CRMTaskWithContact,
} from './crm';

// ==========================================
// 3. Supabase Storage & Media (Unified)
// ==========================================

/** Folders inside the single public `media` bucket. */
export type MediaFolder = 'crm' | 'content' | 'products';

/** One file in the `media` bucket — listing, picking and uploading all return this. */
export interface MediaItem {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
  folder: MediaFolder;
  /** Measured from the file's bytes on upload. `null` = not measured. */
  width: number | null;
  height: number | null;
}

/** Upload outcome envelope. */
export interface MediaUploadResult {
  success: boolean;
  error?: string;
  data?: MediaItem;
}

/** List result with folder breakdown. */
export interface MediaListResult {
  items: MediaItem[];
  folders: string[];
}

/** Target context for media operations. */
export type MediaTarget = 'featured' | 'section' | 'composer' | 'gallery';

/** @deprecated Use `MediaTarget` from `@/types/unified` */
export type CRMMediaTarget = MediaTarget;

/** Media library filter options. */
export interface MediaLibraryFilters {
  folder?: MediaFolder;
  mimePrefix?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ==========================================
// 4. Supabase Edge Functions (Unified)
// ==========================================

/** Health check response for any edge function. */
export interface EdgeFunctionHealth {
  ready: boolean;
  missing?: string[];
  endpoint: string;
  checkedAt: string;
  latencyMs?: number;
}

/** Backend status for admin dashboards. */
export interface BackendStatus {
  database: boolean;
  storage: boolean;
  edgeFunction: boolean;
  edgeFunctionDetails?: EdgeFunctionHealth;
  error?: string;
}

/** Generic edge function response envelope. */
export interface EdgeFunctionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}

/** CRM broadcast dispatch result. */
export interface BroadcastDispatchResult {
  ok: boolean;
  warning?: string;
  error?: string;
  broadcastId?: string;
}

/** Contact form notification result. */
export interface ContactNotifyResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

/** Search function response. */
export interface SearchResult {
  products: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    price: number;
    image: string | null;
  }>;
  content: Array<{
    id: number;
    slug: string;
    title: string;
    excerpt: string;
    type: string;
  }>;
  total: number;
}

// ==========================================
// 5. Visual Email Composer (CRM)
// ==========================================

export type {
  ComposerBlock,
  ComposerTemplate,
  EmailBlockType,
} from '@/components/admin/crm/composer/types';

/** Composer block types (disjoint from page ContentBlockType). */
export type ComposerBlockType =
  | 'header'
  | 'text'
  | 'callout'
  | 'button'
  | 'event'
  | 'divider'
  | 'signoff'
  | 'image'
  | 'quote'
  | 'stat'
  | 'list'
  | 'social';

/** Complete email compose state. */
export interface ComposeState {
  subject: string;
  preheader: string;
  blocks: ComposerBlock[];
  selectedBlockId: string | null;
  template: string | null;
}

// ==========================================
// 6. Content Editor Shared Types
// ==========================================

export type ContentStatus = 'publish' | 'draft';

export type ContentType = 'page' | 'post' | 'landing' | 'copy-region';

export interface ContentMetadata {
  meta_title?: string;
  meta_description?: string;
  og_image?: string;
  og_type?: string;
  noindex?: boolean;
  nofollow?: boolean;
  canonical_url?: string;
}

export interface ContentEditorFields {
  title: string;
  slug: string;
  excerpt: string;
  type: ContentType;
  status: ContentStatus;
  featuredImage: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
}

export interface ContentRevision {
  id: number;
  content_id: number;
  body: string;
  featured_image: string | null;
  metadata: ContentMetadata | null;
  created_at: string;
  created_by: string | null;
}

// ==========================================
// 7. Visual Edit Events & Communication
// ==========================================

export const VISUAL_EDIT_EVENTS = {
  sectionsPublished: 'indivisible:page-sections-updated',
  selectRegion: 'indivisible:select-region',
  toggleSection: 'indivisible:toggle-section-visual',
  focusSection: 'indivisible:focus-section',
  moveSection: 'indivisible:move-section',
  duplicateSection: 'indivisible:duplicate-section',
  deleteSection: 'indivisible:delete-section',
  addBlock: 'indivisible:add-block',
  addBlockAt: 'indivisible:add-block-at',
  openMediaLibrary: 'indivisible:open-media-library',
  openRevisions: 'indivisible:open-revisions',
  openSettings: 'indivisible:open-settings',
} as const;

export type VisualEventName = keyof typeof VISUAL_EDIT_EVENTS;

export interface VisualSectionsPublishedDetail {
  sections: Array<VisualSectionOverlayItem & { enabled: boolean }>;
  pathname: string;
  regionId: string | null;
}

export interface ToggleSectionDetail {
  blockIndex?: number;
  enabled?: boolean;
  all?: boolean;
}

export interface FocusSectionDetail {
  blockIndex: number;
  openEdit?: boolean;
  highlightOnly?: boolean;
}

export interface MoveSectionDetail {
  blockIndex: number;
  direction: 'up' | 'down';
}

export interface AddBlockDetail {
  insertAfterBlockIndex?: number;
  type?: ContentBlockType;
}

export interface DuplicateSectionDetail {
  blockIndex: number;
}

export interface DeleteSectionDetail {
  blockIndex: number;
}

// ==========================================
// 8. Admin & Permissions
// ==========================================

export type AdminRole = 'super_admin' | 'editor' | 'moderator';

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  mfaEnrolled: boolean;
  mfaVerified: boolean;
}

/** Permission flags for admin actions. */
export interface AdminPermissions {
  canEditContent: boolean;
  canManageCRM: boolean;
  canManageBroadcasts: boolean;
  canManageUsers: boolean;
  canAccessSettings: boolean;
  canViewAnalytics: boolean;
}

// ==========================================
// 9. Theme & Appearance
// ==========================================

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeState {
  mode: ThemeMode;
  effective: 'light' | 'dark';
  resolvedAt: number;
}

// ==========================================
// 10. Utility Types
// ==========================================

/** Make all properties optional recursively. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Make specific keys required. */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Make specific keys optional. */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Extract non-null type. */
export type NonNullable<T> = T extends null | undefined ? never : T;

/** Function that returns a promise. */
export type AsyncFn<TArgs extends unknown[], TReturn> = (...args: TArgs) => Promise<TReturn>;

/** Event handler type. */
export type EventHandler<TEvent extends Event = Event> = (event: TEvent) => void;

/** Result type for operations that can fail. */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// ==========================================
// 11. API & Server Action Patterns
// ==========================================

/** Standard server action response. */
export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/** Paginated list response. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Optimistic concurrency control. */
export interface OptimisticLock {
  expectedUpdatedAt: string | null;
}

/** File upload progress. */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}
