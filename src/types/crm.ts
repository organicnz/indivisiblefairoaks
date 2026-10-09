/**
 * Unified CRM Domain Types
 *
 * Single source of truth for CRM constituents, tasks, campaigns, visual
 * email composer blocks, media storage assets, and edge function payloads.
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
 * `marked_failed_at` and `marked_failed_by` are tracked for failure audit.
 */
export type CRMBroadcast = Database['public']['Tables']['crm_broadcasts']['Row'] & {
  marked_failed_at?: string | null;
  marked_failed_by?: string | null;
};
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

export interface CRMMediaItem {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
  folder: string;
  width?: number | null;
  height?: number | null;
}

export interface CRMMediaListResult {
  items: CRMMediaItem[];
  folders: string[];
}

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
export type {
  BlockType,
  ComposerBlock,
  ComposerTemplate,
} from '@/components/admin/crm/composer/types';
