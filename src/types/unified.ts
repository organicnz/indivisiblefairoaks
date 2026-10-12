/**
 * Unified Domain Types — Visual Editor, CRM, Content, and Platform Integration
 *
 * Single source of truth for types shared across the visual editor, CRM,
 * content management, and Supabase platform integrations (Storage, Edge Functions,
 * S3 Media, and backend API surfaces).
 *
 * This file re-exports and extends types from domain-specific files to provide
 * a unified import path and ensures every backend surface (Postgres RLS,
 * Storage buckets, Edge Functions, and authorization gates) has a typed
 * contract.
 */

import type { ContentBlockType } from '@/lib/blocks';
import type { PublishedSection } from '@/lib/visual-sections';
import type { Database } from '@/types/supabase';
import type { CRMSegment, CRMStats } from './crm';

// ==========================================
// 1. Content / Visual Editor Domain
// ==========================================

export type {
  Block,
  CalloutTone,
  ContentBlockType,
  HeadingLevel,
} from '@/lib/blocks';

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

export interface VisualSectionCoords {
  blockIndex: number;
  domIndex: number | null;
  label: string;
  blockType: ContentBlockType;
}

export interface VisualSectionFrame {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export interface VisualSectionOverlayItem extends VisualSectionCoords, VisualSectionFrame {}

export interface CopyRegionDefinition {
  id: string;
  label: string;
}

export type { PublishedSection } from '@/lib/visual-sections';

// ==========================================
// 2. CRM Domain — fully unified
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
// 3. Supabase Storage & Media (S3 bucket)
// ==========================================

export type MediaFolder = 'crm' | 'content' | 'products' | 'gallery';

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
  folder: MediaFolder;
  width: number | null;
  height: number | null;
}

export interface MediaUploadResult {
  success: boolean;
  error?: string;
  data?: MediaItem;
}

export interface MediaListResult {
  items: MediaItem[];
  folders: string[];
}

export type MediaTarget = 'featured' | 'section' | 'composer' | 'gallery' | 'media';

// ==========================================
// 4. Supabase Edge Functions — typed contracts
// ==========================================

export interface EdgeFunctionHealth {
  ready: boolean;
  missing?: string[];
  endpoint: string;
  checkedAt: string;
  latencyMs?: number;
  details?: {
    database: boolean;
    storage: boolean;
    edgeFunction: boolean;
    crmReach?: boolean;
  };
}

export interface BackendStatus {
  database: boolean;
  storage: boolean;
  edgeFunction: boolean;
  edgeFunctionDetails?: EdgeFunctionHealth;
  error?: string;
}

export interface EdgeFunctionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}

export interface BroadcastDispatchResult {
  ok: boolean;
  warning?: string;
  error?: string;
  broadcastId?: string;
}

export interface ContactNotifyResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

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

// ==========================================
// 6. Visual Edit Events & Communication
// ==========================================

export interface VisualSectionsPublishedDetail {
  /**
   * The overlay's real section list — `PublishedSection[]` from
   * `src/lib/visual-sections.ts`, not a local copy. The header renders this
   * verbatim; a parallel shape here is how the header ended up offering to edit
   * a section that was really a different one.
   */
  sections: PublishedSection[];
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
// 7. Visual page context — one backend snapshot
// ==========================================

export type {
  ContentMediaDeleteResult,
  ContentMediaInsert,
  ContentMediaListResult,
  ContentMediaPatch,
  ContentMediaRow,
  ContentMediaUpdate,
  ContentMediaUploadResult,
} from './content-media';

export interface VisualCatalogCounts {
  products: number;
  galleryPhotos: number;
  events: number;
}

/**
 * The dock health panel's summary, derived from the one-gate
 * `getVisualPageContext` snapshot. Caps are reported, never silent:
 * media is the 60 most recent files, revisions the 20-cap, segments the
 * 500-cap — so each count that can be cut carries its truncation flag.
 */
export interface BackendSummary {
  crmTotal: number | null;
  segments: number;
  segmentsTruncated: boolean;
  products: number;
  gallery: number;
  events: number;
  mediaItems: number;
  mediaTruncated: boolean;
  revisionsTruncated: boolean;
}

/**
 * One backend context for the in-page visual editor: content row, revision
 * window, media window, edge health, CRM stats, segments and catalog counts.
 * Defined here (not in the server action) so the overlay, the drawer and the
 * action import one shape from one path.
 */
export interface VisualPageContext {
  content: VisualContentRow | null;
  revisions: Database['public']['Tables']['content_revisions']['Row'][];
  revisionsTruncated: boolean;
  media: MediaListResult;
  backend: BackendStatus;
  crmStats: CRMStats | null;
  segments: CRMSegment[];
  segmentsTruncated: boolean;
  catalog: VisualCatalogCounts;
}
