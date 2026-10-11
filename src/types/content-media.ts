/**
 * Content Media Types
 *
 * Row types for the `content_media` table (migration 20261011000000).
 * Mirrors the hardened schema: sort_order >= 0, updated_at trigger, published-parent RLS.
 *
 * NOTE: The `content_media` table is not yet in generated types (migration not yet applied
 * to the type-generation database). These types mirror the migration schema and will be
 * replaced by generated types after the migration lands and `bun run types:generate` runs.
 */

/** The content_media row as stored in Supabase. */
export interface ContentMediaRow {
  id: string;
  content_id: number;
  name: string;
  path: string;
  url: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  folder: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Insert payload — id, created_at, updated_at are server defaults. */
export interface ContentMediaInsert {
  content_id: number;
  name: string;
  path: string;
  url: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  folder: string;
  sort_order: number;
}

/** Update payload — all optional. */
export interface ContentMediaUpdate {
  name?: string;
  path?: string;
  url?: string;
  mime_type?: string;
  size?: number;
  width?: number | null;
  height?: number | null;
  alt_text?: string | null;
  caption?: string | null;
  folder?: string;
  sort_order?: number;
}

/** Patch for the media panel (alt/caption/name/sort_order only). */
export interface ContentMediaPatch {
  alt_text?: string | null;
  caption?: string | null;
  name?: string;
  sort_order?: number;
}

/** List result with folder breakdown (mirrors MediaListResult). */
export interface ContentMediaListResult {
  items: ContentMediaRow[];
  folders: string[];
}

/** Result envelope for media operations. */
export interface ContentMediaUploadResult<T = ContentMediaRow> {
  success: boolean;
  error?: string;
  data?: T;
}

/** Delete operation result. */
export interface ContentMediaDeleteResult {
  deleted: boolean;
  retained?: 'referenced' | 'foreign';
}

// Re-export for backward compatibility with code that imports from @/types/crm or unified
export type CRMMediaFolder = 'crm' | 'content' | 'products';
export type CRMMediaItem = {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
  folder: 'crm' | 'content' | 'products';
  width: number | null;
  height: number | null;
};
export type CRMMediaListResult = {
  items: CRMMediaItem[];
  folders: string[];
};
export type CRMMediaUploadResult = {
  success: boolean;
  error?: string;
  data?: CRMMediaItem;
};
export type CRMMediaTarget = 'featured' | 'section' | 'composer' | 'gallery';
export type MediaTarget = CRMMediaTarget;
export type MediaFolder = CRMMediaFolder;
export type MediaItem = CRMMediaItem;
export type MediaUploadResult = CRMMediaUploadResult;
export type MediaListResult = CRMMediaListResult;
