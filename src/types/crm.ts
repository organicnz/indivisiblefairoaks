/**
 * Unified CRM Domain Types
 *
 * Single source of truth for CRM constituents, tasks, campaigns, the visual
 * email composer blocks, media storage assets and edge function payloads.
 *
 * The *page* visual editor's own types live in `src/types/visual-edit.ts`. They
 * were here once, which made this file the source of truth for two domains and
 * left a second, unused model of the section editor beside the one the overlay
 * actually uses.
 */

import type { Database } from '@/types/supabase';

// ==========================================
// 1. Core Supabase Database Entities
// ==========================================

export type CRMContact = Database['public']['Tables']['crm_contacts']['Row'];
export type CRMContactInsert = Database['public']['Tables']['crm_contacts']['Insert'];
export type CRMContactUpdate = Database['public']['Tables']['crm_contacts']['Update'];

export type CRMActivity = Database['public']['Tables']['crm_activities']['Row'];
export type CRMActivityInsert = Database['public']['Tables']['crm_activities']['Insert'];

/**
 * A broadcast campaign row.
 *
 * Plain `Row` — `marked_failed_at` / `marked_failed_by` already exist on the
 * generated row as `string | null` (see `src/types/supabase.ts`), so the
 * previous `Row & { marked_failed_at?: … }` intersection only diverged
 * optional-vs-required and is removed.
 */
export type CRMBroadcast = Database['public']['Tables']['crm_broadcasts']['Row'];
export type CRMBroadcastInsert = Database['public']['Tables']['crm_broadcasts']['Insert'];
export type CRMBroadcastUpdate = Database['public']['Tables']['crm_broadcasts']['Update'];

export type CRMTask = Database['public']['Tables']['crm_tasks']['Row'];
export type CRMTaskInsert = Database['public']['Tables']['crm_tasks']['Insert'];
export type CRMTaskUpdate = Database['public']['Tables']['crm_tasks']['Update'];

export type CRMSegment = Database['public']['Tables']['crm_segments']['Row'];
export type CRMSegmentInsert = Database['public']['Tables']['crm_segments']['Insert'];
export type CRMSegmentUpdate = Database['public']['Tables']['crm_segments']['Update'];

// ==========================================
// 2. Statuses, Enums & Extended Views
// ==========================================

export type ConsentDecision = 'opted_out' | 'opted_in' | 'unasked';

/** A consent decision plus the "no filter" state used by directory URLs. */
export type ConsentFilter = 'all' | ConsentDecision;

export type CRMContactStatus =
  | 'active_volunteer'
  | 'supporter'
  | 'donor'
  | 'choir'
  | 'organizer'
  | 'inactive';

export type CRMTaskStatus = 'open' | 'done';

export interface CRMTagCount {
  tag: string;
  count: number;
}

export type CRMTaskWithContact = CRMTask & {
  contact: Pick<CRMContact, 'id' | 'first_name' | 'last_name' | 'email'> | null;
};

export interface CRMStats {
  totalContacts: number;
  activeVolunteers: number;
  localDistrict: number;
  totalDonors: number;
  totalDonationsCents: number;
  openTasks: number;
}

/**
 * One resolved audience member.
 *
 * Single source for the shape the Next resolver returns AND the shape the
 * `crm-broadcast-send` Edge Function consumes. Deno cannot import from `src/`,
 * so the function keeps a local `interface Recipient` — and
 * `crm-broadcast-parity.test.ts` asserts the two declare the same fields, the
 * same way it pins the template functions. A field added on one side and not
 * the other is how an unsubscribe token silently stops reaching the sender.
 */
export interface BroadcastRecipient {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribe_token: string;
}

export interface BroadcastTarget {
  targetTags?: string[];
  targetStatus?: string[];
  targetDistricts?: string[];
}

export interface BroadcastProgress {
  id: string;
  subject: string | null;
  status: 'draft' | 'queued' | 'sending' | 'sent' | 'failed';
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
  createdAt: string;
  /**
   * Client-side only: the composer stopped polling. The row is still in flight
   * server-side, so this is not a claim about the send — it says that what the
   * operator is looking at has stopped updating and the view is behind.
   */
  stillWatching?: boolean;
}

/**
 * One Resend delivery event for a broadcast, with the recipient resolved.
 *
 * Rows are written by the Resend webhook (`POST /api/webhooks/resend`), never
 * by an admin action — this is the read half. `contactEmail` is resolved by
 * the read in one batched query, not per event, so the panel never N+1s the
 * directory for a 5,000-recipient campaign's bounce list.
 */
export interface CRMBroadcastEmailEvent {
  id: string;
  eventType: string;
  contactId: string;
  contactEmail: string | null;
  occurredAt: string;
  providerId: string | null;
}

// ==========================================
// 3. Supabase S3 Storage & Media Assets
// ==========================================

/**
 * The folders inside the single public `media` bucket.
 *
 * Declared here because it is the join key between three modules: the upload
 * picks one, the list is scoped by one, and `deleteCRMMedia` chooses the
 * reference check — which table can still be pointing at the file — from it.
 * When it lived inline in `actions/crm.ts` the listing's `folder: string` could
 * not agree with the uploader's union, and "what folder was this file in" had
 * two answers.
 */
export type MediaFolder = 'crm' | 'content' | 'products';

/**
 * One file in the `media` bucket — listing, picking and uploading all return
 * this, deliberately.
 *
 * `folder` is the union, not `string`: `getCRMMediaFiles` already produced the
 * union and `uploadCRMMedia` re-declared the same six fields with
 * `folder: MediaFolder` spelled inline, so the two copies of "what an uploaded
 * file is" could drift — and a drift there is a file landing in the wrong
 * namespace, where `deleteCRMMedia` runs the wrong reference check.
 */
export interface CRMMediaItem {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
  folder: MediaFolder;
  /**
   * Measured from the file's bytes on upload. `null` rather than optional so a
   * picked file and an uploaded one have the same shape — Storage's `list()`
   * does not report dimensions, and `null` says "not measured" where an absent
   * key says "this type has no such field", which is what made the two copies
   * diverge.
   */
  width: number | null;
  height: number | null;
}

export interface CRMMediaListResult {
  items: CRMMediaItem[];
  folders: string[];
}

/**
 * Upload outcome: the item that was written, or the reason it was not.
 *
 * The envelope is reused rather than restated so a caller cannot be handed a
 * shape the uploader does not actually return.
 */
export interface CRMMediaUploadResult {
  success: boolean;
  error?: string;
  data?: CRMMediaItem;
}

// ==========================================
// 4. Supabase Edge Functions & API Integration
// ==========================================

export interface CRMEdgeFunctionHealth {
  ready: boolean;
  missing?: string[];
  endpoint: string;
  checkedAt: string;
  latencyMs?: number;
}

export interface CRMBackendStatus {
  database: boolean;
  storage: boolean;
  edgeFunction: boolean;
  edgeFunctionDetails?: CRMEdgeFunctionHealth;
  error?: string;
}

export interface CRMBroadcastDispatchResult {
  ok: boolean;
  warning?: string;
  error?: string;
  broadcastId?: string;
}

// ==========================================
// 5. Visual Composer Types Integration
// ==========================================

// `composer/types.ts` is the definition site (the visual editor's domain);
// this is the canonical import path, so no consumer imports the same symbol
// from two places and drifts when one of them moves.
/** Deprecated alias — use `EmailBlockType` (disjoint from page `ContentBlockType`). */
export type {
  BlockType,
  ComposerBlock,
  ComposerTemplate,
  EmailBlockType,
} from '@/components/admin/crm/composer/types';
