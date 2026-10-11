/**
 * Content Media Types
 *
 * Row types for the `content_media` table (migration 20261011000000).
 * Now sourced from the generated Supabase types — the migration has landed and
 * `bun run types:generate` has run, so the manual mirror is removed.
 */

import type { Database } from '@/types/supabase';

type ContentMediaRow = Database['public']['Tables']['content_media']['Row'];
type ContentMediaInsert = Database['public']['Tables']['content_media']['Insert'];
type ContentMediaUpdate = Database['public']['Tables']['content_media']['Update'];

/** The content_media row as stored in Supabase. */
/** Insert payload — id, created_at, updated_at are server defaults. */
/** Update payload — all optional. */
export type { ContentMediaInsert, ContentMediaRow, ContentMediaUpdate };

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
