/**
 * Unified CRM Domain Types
 *
 * Single source of truth for CRM constituents, tasks, campaigns and the visual
 * email composer blocks.
 *
 * Shared platform types (Storage, Edge Functions, Media) live in
 * `src/types/unified.ts` and are imported from there directly — no CRM-prefixed
 * alias is kept, because two names for one shape is how a field added to one
 * side silently stops reaching the other. The page visual editor's own types
 * live in `src/types/unified.ts` too.
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
// 3. Visual Composer Types Integration
// ==========================================

// `composer/types.ts` is the definition site (the visual editor's domain);
// this is the canonical import path, so no consumer imports the same symbol
// from two places and drifts when one of them moves.
//
// `BlockType` is deliberately NOT re-exported: the definition site deprecates
// it in favour of `EmailBlockType`, and re-exporting it here would keep the
// deprecated name alive on a second path.
export type {
  ComposerBlock,
  ComposerTemplate,
  EmailBlockType,
} from '@/components/admin/crm/composer/types';
