'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import {
  BROADCAST_RECIPIENT_CEILING,
  broadcastSubject,
  buildBroadcastEmail,
} from '@/lib/crm-broadcast';
import {
  type CRMImportError,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_CONTACT,
  normalizeTags,
  parseCRMImportCsv,
  TAG_PATTERN,
  toCsvRow,
} from '@/lib/crm-import';
import { isE2EMode } from '@/lib/e2e-mode';
import { brandShell, escapeHtml, LOGO_URL, safeSubject, sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import type { Database } from '@/types/supabase';

export type CRMContact = Database['public']['Tables']['crm_contacts']['Row'];
export type CRMContactInsert = Database['public']['Tables']['crm_contacts']['Insert'];
export type CRMContactUpdate = Database['public']['Tables']['crm_contacts']['Update'];
export type CRMActivity = Database['public']['Tables']['crm_activities']['Row'];
export type CRMBroadcast = Database['public']['Tables']['crm_broadcasts']['Row'];
export type CRMTask = Database['public']['Tables']['crm_tasks']['Row'];
export type CRMSegment = Database['public']['Tables']['crm_segments']['Row'];

/**
 * Tag shape is enforced identically on both write paths. The CSV importer already
 * normalised to lowercase and capped at 20 (see `splitTags` in crm-import.ts); without
 * the matching cap here, a hand-entered contact could carry 500 tags, which then
 * renders 500 options in the directory filter and floods the broadcast chip list.
 */
const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TAG_LENGTH)
  .regex(TAG_PATTERN, 'Tags may not contain <, >, or commas');

const contactSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().trim().toLowerCase().email(),
  first_name: z.string().max(100).nullable().optional(),
  last_name: z.string().max(100).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  zip_code: z.string().max(20).nullable().optional(),
  district: z.string().max(20).default('CA-06'),
  status: z
    .enum(['active_volunteer', 'supporter', 'donor', 'choir', 'organizer', 'inactive'])
    .default('supporter'),
  tags: z
    .array(tagSchema)
    .max(MAX_TAGS_PER_CONTACT, `A contact may carry at most ${MAX_TAGS_PER_CONTACT} tags`)
    .transform(normalizeTags)
    .default([]),
  notes: z.string().nullable().optional(),
});

const taskSchema = z.object({
  // Optional: a follow-up can belong to the chapter rather than to a person
  // ("call the county clerk", "confirm the venue"). `crm_tasks.contact_id`
  // allows NULL for exactly this, and the board is where those live.
  contactId: z
    .string()
    .uuid('Select a constituent, or leave this blank for a chapter-wide task')
    .nullable()
    .optional(),
  title: z.string().trim().min(1, 'Give the follow-up a title').max(200),
  details: z.string().trim().max(2000).nullable().optional(),
  dueAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD')
    .nullable()
    .optional(),
});

const segmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  query: z.string().trim().max(100).default(''),
  statuses: z.array(z.string()).max(10).default([]),
  districts: z.array(z.string()).max(10).default([]),
  tags: z
    .array(tagSchema)
    .max(MAX_TAGS_PER_CONTACT, `A segment may filter on at most ${MAX_TAGS_PER_CONTACT} tags`)
    .transform(normalizeTags)
    .default([]),
});

export interface CRMStats {
  totalContacts: number;
  activeVolunteers: number;
  localDistrict: number;
  totalDonors: number;
  totalDonationsCents: number;
  openTasks: number;
}

function unsubscribeUrl(token: string): string {
  return `${env.NEXT_PUBLIC_SITE_URL}/api/crm/unsubscribe?token=${token}`;
}

function listUnsubscribeHeaders(token: string | null | undefined): Record<string, string> {
  const mailto = env.ADMIN_ORDER_EMAIL || 'contact@indivisiblefairoaks.org';
  const parts = [`<mailto:${mailto}?subject=${encodeURIComponent('Unsubscribe')}>`];
  if (token) {
    parts.unshift(`<${unsubscribeUrl(token)}>`);
  }
  return {
    'List-Unsubscribe': parts.join(', '),
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * PostgREST `.or()` filters are comma-separated `column.op.value` tuples and
 * use parentheses for grouping. Characters that appear inside those structural
 * positions must be stripped from the user value or the whole filter string
 * fails to parse (HTTP 400).
 */
function escapeIlikeOrValue(value: string): string {
  return escapeIlike(value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim());
}

function splitList(v: string | undefined | null): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Every CRM mutation invalidates the same set of reads: the KPI cards on the directory,
 * the directory itself, the follow-up board, and the contact 360 that owns the row.
 * Hand-listing these per action is how they drifted — toggling a task on the 360 page
 * revalidated the board but not the 360, so the tab it was toggled in stayed stale.
 */
/**
 * Per-admin send budget, enforced in addition to the database-level flood guard.
 *
 * The CRM send paths were the only ones in the app with no limiter at all — the
 * contact form runs 3/10min/IP and error reports 5/10min. A double-click on the
 * broadcast confirm dialog, or a compromised admin session, could otherwise drain
 * the Resend quota. Keyed on the admin's user id rather than an IP, because the
 * thing at risk is the *account's* sending authority, and every legitimate send
 * comes from the same office IP.
 */
const SEND_LIMIT = { limit: 30, windowMs: 60_000 } as const;
const BROADCAST_LIMIT = { limit: 5, windowMs: 60_000 } as const;

function sendRateLimited(
  adminUserId: string,
  scope: { limit: number; windowMs: number }
): string | null {
  const { ok, retryAfterSec } = rateLimit(
    `crm-send:${scope.limit}:${adminUserId}`,
    scope.limit,
    scope.windowMs
  );
  if (ok) return null;
  return `Too many emails sent. Wait ${retryAfterSec}s before sending again.`;
}

interface BroadcastRecipient {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribe_token: string;
}

/**
 * Resolve the audience for a broadcast. Consent is applied here and nowhere
 * else, so there is exactly one place an opted-out contact can be excluded —
 * the previous inline filter was easy to reorder past.
 *
 * The return carries `exhausted`, and it is not incidental. Paging with
 * `offset < CEILING` cannot distinguish "the audience is this big" from "the
 * audience is at least this big", and the caller previously guessed by counting
 * what came back — which caps at exactly the ceiling, so the guess was always
 * "big enough" and the refusal never ran. `exhausted: true` means the query
 * itself ran dry, which is the only evidence the list is complete.
 */
async function resolveBroadcastRecipients(
  adminClient: AdminClient,
  target: BroadcastTarget
): Promise<{ recipients: BroadcastRecipient[]; exhausted: boolean }> {
  const targetTags = normalizeTags(target.targetTags ?? []);
  const targetStatus = target.targetStatus ?? [];
  const targetDistricts = target.targetDistricts ?? [];
  const PAGE = 1000;
  const recipients: BroadcastRecipient[] = [];
  let exhausted = false;

  // `<=` plus the over-the-line break, so an audience of exactly the ceiling is
  // not refused as "larger than the limit" — the previous `<` stopped one page
  // short of the boundary and could not tell the two apart. Ordered by the
  // primary key, because `.range()` is offset paging and is only coherent
  // against a stable total order; without it a row that appears or disappears
  // between pages duplicates one recipient and skips another. See the identical
  // fix in `crm-broadcast-send/index.ts`.
  for (let offset = 0; offset <= BROADCAST_RECIPIENT_CEILING; offset += PAGE) {
    let qb = adminClient
      .from('crm_contacts')
      .select('id, email, first_name, last_name, unsubscribe_token')
      .eq('do_not_email', false)
      .order('id', { ascending: true });

    if (targetStatus.length > 0) qb = qb.in('status', targetStatus);
    if (targetDistricts.length > 0) qb = qb.in('district', targetDistricts);
    if (targetTags.length > 0) {
      for (const tag of targetTags) qb = qb.contains('tags', [tag]);
    }

    const { data, error } = await qb.range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Failed to resolve recipients: ${error.message}`);
    if (!data || data.length === 0) {
      exhausted = true;
      break;
    }
    recipients.push(...(data as BroadcastRecipient[]));
    // Past the ceiling: stop collecting and leave `exhausted` false, so the
    // caller refuses rather than sending a silently shortened audience.
    if (recipients.length > BROADCAST_RECIPIENT_CEILING) break;
    // A short page is the only evidence there is nothing after it.
    if (data.length < PAGE) {
      exhausted = true;
      break;
    }
  }
  return { recipients, exhausted };
}

function revalidateCRMRoutes(contactId?: string | null): void {
  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/tasks');
  revalidatePath('/admin/crm/broadcasts');
  if (contactId) revalidatePath(`/admin/crm/${contactId}`);
}

/**
 * KPI cards for the directory header.
 *
 * Aggregated in the database by `crm_stats()` (see migration
 * 20260929120000). The previous version selected every donor row and summed
 * `total_donated_cents` in JavaScript, which put an unbounded result set on the
 * wire on every dashboard load. The RPC is a single pass over the table and
 * returns one object.
 */
export async function getCRMStats(): Promise<CRMStats> {
  const { adminClient } = await requireAdmin();

  const { data, error } = await adminClient.rpc('crm_stats');
  if (error) {
    // The RPC is additive: on a database that has not had the migration
    // applied yet, fall back to the old per-query counts so the dashboard
    // still renders rather than 500ing during a staged rollout.
    return legacyCRMStats(adminClient);
  }

  const row = (data ?? {}) as Record<string, number>;
  return {
    totalContacts: row.total_contacts ?? 0,
    activeVolunteers: row.active_volunteers ?? 0,
    localDistrict: row.local_district ?? 0,
    totalDonors: row.total_donors ?? 0,
    totalDonationsCents: row.total_donations_cents ?? 0,
    openTasks: row.open_tasks ?? 0,
  };
}

async function legacyCRMStats(adminClient: AdminClient): Promise<CRMStats> {
  const [total, volunteers, local, tasks] = await Promise.all([
    adminClient.from('crm_contacts').select('*', { count: 'exact', head: true }),
    adminClient
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active_volunteer', 'choir', 'organizer']),
    adminClient
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })
      .in('district', ['CA-03', 'CA-06']),
    adminClient.from('crm_tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
  ]);
  return {
    totalContacts: total.count ?? 0,
    activeVolunteers: volunteers.count ?? 0,
    localDistrict: local.count ?? 0,
    totalDonors: 0,
    totalDonationsCents: 0,
    openTasks: tasks.count ?? 0,
  };
}

export interface GetCRMContactsParams {
  query?: string;
  status?: string;
  district?: string;
  tag?: string;
  /** Comma-separated multi-value filters — take precedence over the single-value fields. */
  statusList?: string[];
  districtList?: string[];
  tagList?: string[];
  page?: number;
  pageSize?: number;
}

type ContactFilterState = {
  statuses: string[];
  districts: string[];
  tags: string[];
  q: string;
};

type AdminClient = Awaited<ReturnType<typeof requireAdmin>>['adminClient'];

function contactSelect(adminClient: AdminClient) {
  return adminClient.from('crm_contacts').select('*', { count: 'exact' });
}

function resolveFilters({
  query = '',
  status = '',
  district = '',
  tag = '',
  statusList,
  districtList,
  tagList,
}: GetCRMContactsParams): ContactFilterState {
  const statuses = statusList?.length ? statusList : splitList(status).filter((s) => s !== 'all');
  const districts = districtList?.length
    ? districtList
    : splitList(district).filter((d) => d !== 'all');
  const tags = normalizeTags(tagList?.length ? tagList : splitList(tag).filter((t) => t !== 'all'));
  return { statuses, districts, tags, q: query.trim().slice(0, 100) };
}

function applyContactFilters(qb: ReturnType<typeof contactSelect>, filters: ContactFilterState) {
  let out = qb;
  if (filters.statuses.length === 1) {
    out = out.eq('status', filters.statuses[0]);
  } else if (filters.statuses.length > 1) {
    out = out.in('status', filters.statuses);
  }
  if (filters.districts.length === 1) {
    out = out.eq('district', filters.districts[0]);
  } else if (filters.districts.length > 1) {
    out = out.in('district', filters.districts);
  }
  if (filters.tags.length > 0) {
    out = out.contains('tags', filters.tags);
  }
  if (filters.q) {
    const escaped = escapeIlikeOrValue(filters.q);
    if (escaped) {
      out = out.or(
        `email.ilike.%${escaped}%,first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,city.ilike.%${escaped}%,notes.ilike.%${escaped}%`
      );
    }
  }
  return out;
}

async function fetchContactPage(
  adminClient: AdminClient,
  filters: ContactFilterState,
  page: number,
  pageSize: number
): Promise<{ contacts: CRMContact[]; totalCount: number; error?: string }> {
  // Primary path: FTS over search_vector (added in crm_completion migration).
  let qb = applyContactFilters(contactSelect(adminClient), { ...filters, q: '' });
  if (filters.q) {
    qb = qb.textSearch('search_vector', filters.q, { type: 'websearch', config: 'simple' });
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let result = await qb.order('created_at', { ascending: false }).range(from, to);

  // Fallback: migration not applied yet, or FTS tokenization missed a partial match.
  if (filters.q && (result.error || !result.data?.length)) {
    qb = applyContactFilters(contactSelect(adminClient), filters);
    result = await qb.order('created_at', { ascending: false }).range(from, to);
  }

  if (result.error) {
    return { contacts: [], totalCount: 0, error: result.error.message };
  }
  return { contacts: (result.data as CRMContact[]) || [], totalCount: result.count || 0 };
}

export async function getCRMContacts(params: GetCRMContactsParams = {}): Promise<{
  contacts: CRMContact[];
  totalCount: number;
}> {
  const { adminClient } = await requireAdmin();
  // Clamped, because both values come from URL search params and reach PostgREST
  // as a range. `page: 0` produced `range(-50, -1)`, which is a 416 rather than
  // a read, and an unclamped `pageSize` let any caller ask for the whole
  // directory. `getContentList` has clamped its pair since it was written; this
  // one had not, so the same request was safe on the content side and not here.
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(params.pageSize) || 50)));
  const filters = resolveFilters(params);
  const result = await fetchContactPage(adminClient, filters, page, pageSize);
  if (result.error) {
    throw new Error(`Failed to load CRM contacts: ${result.error}`);
  }
  return { contacts: result.contacts, totalCount: result.totalCount };
}

export async function exportCRMContacts(
  params: GetCRMContactsParams = {}
): Promise<{ csv: string; count: number; error?: string }> {
  const { adminClient } = await requireAdmin();
  const filters = resolveFilters(params);
  // Full filtered export (not just the visible page), hard-capped.
  const result = await fetchContactPage(adminClient, filters, 1, 10000);
  if (result.error) {
    return { csv: '', count: 0, error: result.error };
  }

  const header = toCsvRow([
    'ID',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Address',
    'District',
    'City',
    'Zip Code',
    'Status',
    'Tags',
    'Notes',
    'Do Not Email',
    'Lifetime Giving (cents)',
    'Source',
    'Created At',
  ]);
  const lines = result.contacts.map((c) =>
    toCsvRow([
      c.id,
      c.first_name || '',
      c.last_name || '',
      c.email,
      c.phone || '',
      // `address` and `notes` were both missing here while the importer read
      // `notes` and the editor modal edited both. A file that could be exported
      // and re-imported is the chapter's only off-platform backup, and this one
      // quietly dropped every street address and every free-text note on the way
      // out — the failure surfaces weeks later, on the day it is needed.
      c.address || '',
      c.district || '',
      c.city || '',
      c.zip_code || '',
      c.status,
      (c.tags || []).join('; '),
      c.notes || '',
      c.do_not_email ? 'yes' : 'no',
      c.total_donated_cents,
      c.source || '',
      c.created_at,
    ])
  );
  return { csv: [header, ...lines].join('\r\n'), count: result.contacts.length };
}

export interface CRMTaskWithContact extends CRMTask {
  contact: Pick<CRMContact, 'id' | 'first_name' | 'last_name' | 'email'> | null;
}

export type TaskScope = 'open' | 'overdue' | 'upcoming' | 'done' | 'all';

export async function getCRMTasks({
  scope = 'open',
  page = 1,
  pageSize = 50,
}: {
  scope?: TaskScope;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ tasks: CRMTaskWithContact[]; totalCount: number }> {
  const { adminClient } = await requireAdmin();
  const today = new Date().toISOString().slice(0, 10);

  let qb = adminClient
    .from('crm_tasks')
    .select('*, contact:crm_contacts(id, first_name, last_name, email)', { count: 'exact' });

  if (scope === 'open') {
    qb = qb.eq('status', 'open');
  } else if (scope === 'done') {
    qb = qb.eq('status', 'done');
  } else if (scope === 'overdue') {
    qb = qb.eq('status', 'open').lt('due_at', today);
  } else if (scope === 'upcoming') {
    qb = qb.eq('status', 'open').or(`due_at.gte.${today},due_at.is.null`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await qb
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to load tasks: ${error.message}`);
  }
  return { tasks: (data as CRMTaskWithContact[]) || [], totalCount: count || 0 };
}

export async function getCRMTasksForContact(contactId: string): Promise<CRMTask[]> {
  const { adminClient } = await requireAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await adminClient
    .from('crm_tasks')
    .select('*')
    .eq('contact_id', contactId)
    .or(`status.eq.done,and(status.eq.open,due_at.gte.${today})`)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to load contact tasks: ${error.message}`);
  }
  return data || [];
}

export async function addCRMTask(
  rawInput: z.input<typeof taskSchema>
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  const { adminClient, adminUserId } = await requireAdmin();
  const parsed = taskSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { contactId, title, details, dueAt } = parsed.data;
  const { data, error } = await adminClient
    .from('crm_tasks')
    .insert({
      contact_id: contactId || null,
      title,
      details: details || null,
      due_at: dueAt || null,
      created_by: adminUserId,
    })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  revalidateCRMRoutes(contactId);
  return { success: true, taskId: data.id };
}

export async function setCRMTaskStatus({
  id,
  status,
}: {
  id: string;
  status: 'open' | 'done';
}): Promise<{ success: boolean; error?: string }> {
  const { adminClient } = await requireAdmin();
  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from('crm_tasks')
    .update({
      status,
      completed_at: status === 'done' ? now : null,
      updated_at: now,
    })
    .eq('id', id)
    .select('contact_id')
    .single();

  if (error) return { success: false, error: error.message };
  revalidateCRMRoutes(data?.contact_id);
  return { success: true };
}

export async function deleteCRMTask(id: string): Promise<{ success: boolean; error?: string }> {
  const { adminClient } = await requireAdmin();
  const { data, error } = await adminClient
    .from('crm_tasks')
    .delete()
    .eq('id', id)
    .select('contact_id')
    .single();

  if (error) return { success: false, error: error.message };
  revalidateCRMRoutes(data?.contact_id);
  return { success: true };
}

export async function getCRMSegments(): Promise<CRMSegment[]> {
  const { adminClient } = await requireAdmin();
  const { data, error } = await adminClient
    .from('crm_segments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(`Failed to load segments: ${error.message}`);
  return data || [];
}

export async function saveCRMSegment(
  rawInput: z.input<typeof segmentSchema>
): Promise<{ success: boolean; segmentId?: string; error?: string }> {
  const { adminClient } = await requireAdmin();
  const parsed = segmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { id, name, query, statuses, districts, tags } = parsed.data;
  const row = {
    name: name.trim(),
    query,
    statuses,
    districts,
    tags,
  };

  if (id) {
    const { data, error } = await adminClient
      .from('crm_segments')
      .update(row)
      .eq('id', id)
      .select('id')
      .single();
    if (error) return { success: false, error: error.message };
    revalidateCRMRoutes();
    return { success: true, segmentId: data.id };
  }

  const { data, error } = await adminClient.from('crm_segments').insert(row).select('id').single();
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A segment with that name already exists' };
    }
    return { success: false, error: error.message };
  }
  revalidateCRMRoutes();
  return { success: true, segmentId: data.id };
}

export async function deleteCRMSegment(id: string): Promise<{ success: boolean; error?: string }> {
  const { adminClient } = await requireAdmin();
  const { error } = await adminClient.from('crm_segments').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidateCRMRoutes();
  return { success: true };
}

export async function getCRMContactDetail(
  id: string
): Promise<{ contact: CRMContact; activities: CRMActivity[]; tasks: CRMTask[] }> {
  const { adminClient } = await requireAdmin();

  const [
    { data: contact, error: contactError },
    { data: activities, error: actError },
    { data: tasks, error: taskError },
  ] = await Promise.all([
    adminClient.from('crm_contacts').select('*').eq('id', id).single(),
    adminClient
      .from('crm_activities')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false }),
    adminClient
      .from('crm_tasks')
      .select('*')
      .eq('contact_id', id)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
  ]);

  if (contactError || !contact) {
    throw new Error('Contact not found');
  }

  if (actError) {
    throw new Error(`Failed to load contact activities: ${actError.message}`);
  }
  if (taskError) {
    throw new Error(`Failed to load contact tasks: ${taskError.message}`);
  }

  return {
    contact,
    activities: activities || [],
    tasks: tasks || [],
  };
}

export async function saveCRMContact(
  rawInput: z.input<typeof contactSchema>
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  const { adminClient, adminUserId } = await requireAdmin();

  const parsed = contactSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { id, ...data } = parsed.data;
  const normalizedEmail = data.email.trim().toLowerCase();

  if (id) {
    const { data: previous, error: previousError } = await adminClient
      .from('crm_contacts')
      .select('status, email, tags, notes')
      .eq('id', id)
      .single();

    // A volunteer has this form open on a contact a colleague deleted, merged
    // away, or that the historical sync re-keyed. Two failures used to follow
    // from that and both were unhelpful: the read's error was discarded, so the
    // code went on to UPDATE a row that matches nothing, got `data: null` back,
    // and threw on `updated.id` — an unhandled TypeError, which is a 500 and an
    // error boundary, not a sentence. `saveContent` refuses the same situation
    // with "That page no longer exists", and this is the same page.
    if (previousError || !previous) {
      return { success: false, error: 'That contact no longer exists' };
    }

    const statusChanged = previous.status !== data.status;

    const { data: updated, error } = await adminClient
      .from('crm_contacts')
      .update({
        ...data,
        email: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    // Belt and braces: a concurrent delete between the read and the write
    // matches no row and still returns no error.
    if (!updated) return { success: false, error: 'That contact no longer exists' };

    await adminClient.from('crm_activities').insert({
      contact_id: id,
      type: 'status_change',
      title: statusChanged ? 'Status Changed' : 'Constituent Profile Updated',
      description: statusChanged
        ? `Status moved from "${previous.status}" to "${data.status}"`
        : `Updated details and status (${data.status})`,
      metadata: statusChanged ? { from: previous.status, to: data.status } : {},
      created_by: adminUserId,
    });

    revalidateCRMRoutes(id);
    return { success: true, contactId: updated.id };
  }

  // Insert new contact
  const { data: created, error } = await adminClient
    .from('crm_contacts')
    .insert({
      ...data,
      email: normalizedEmail,
      source: 'manual',
    })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  await adminClient.from('crm_activities').insert({
    contact_id: created.id,
    type: 'note',
    title: 'Constituent Created',
    description: 'Manually added to CRM directory',
    created_by: adminUserId,
  });

  revalidateCRMRoutes(created.id);
  return { success: true, contactId: created.id };
}

export async function deleteCRMContact(id: string): Promise<{ success: boolean; error?: string }> {
  const { adminClient } = await requireAdmin();

  const { error } = await adminClient.from('crm_contacts').delete().eq('id', id);
  if (error) return { success: false, error: error.message };

  revalidateCRMRoutes();
  return { success: true };
}

export async function addCRMNote({
  contactId,
  title,
  description,
}: {
  contactId: string;
  title: string;
  description: string;
}): Promise<{ success: boolean; error?: string }> {
  const { adminClient, adminUserId } = await requireAdmin();

  if (!title.trim()) return { success: false, error: 'Title is required' };

  const { error } = await adminClient.from('crm_activities').insert({
    contact_id: contactId,
    type: 'note',
    title: title.trim(),
    description: description.trim() || null,
    created_by: adminUserId,
  });

  if (error) return { success: false, error: error.message };

  revalidateCRMRoutes(contactId);
  return { success: true };
}

export async function setCRMEmailConsent({
  contactId,
  doNotEmail,
}: {
  contactId: string;
  doNotEmail: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { adminClient, adminUserId } = await requireAdmin();
  const now = new Date().toISOString();

  const { error } = await adminClient
    .from('crm_contacts')
    .update({
      do_not_email: doNotEmail,
      unsubscribed_at: doNotEmail ? now : null,
      updated_at: now,
    })
    .eq('id', contactId);

  if (error) return { success: false, error: error.message };

  await adminClient.from('crm_activities').insert({
    contact_id: contactId,
    type: 'note',
    title: doNotEmail ? 'Email Consent Revoked' : 'Email Consent Restored',
    description: doNotEmail
      ? 'Marked do-not-email — excluded from all broadcasts.'
      : 'Re-subscribed for chapter email broadcasts.',
    created_by: adminUserId,
  });

  revalidateCRMRoutes(contactId);
  return { success: true };
}

export async function importCRMContacts({ csv }: { csv: string }): Promise<{
  success: boolean;
  imported?: number;
  skipped?: number;
  /** Rows the parser could not turn into a contact at all — distinct from
   *  `skipped`, which counts valid rows already in the directory. `skipped +
   *  invalidRows + imported + (rows that failed at insert) === rows parsed`,
   *  so the volunteer can reconcile the four numbers against their file. */
  invalidRows?: number;
  errors?: CRMImportError[];
  error?: string;
}> {
  const { adminClient, adminUserId } = await requireAdmin();

  if (!csv.trim()) {
    return { success: false, error: 'CSV content is required' };
  }
  if (csv.length > 500_000) {
    return { success: false, error: 'CSV too large (max 500KB)' };
  }

  const { rows, errors } = parseCRMImportCsv(csv);
  if (rows.length === 0) {
    return { success: false, errors, error: 'No valid rows found in CSV' };
  }
  if (rows.length > 2000) {
    return { success: false, error: 'Import capped at 2000 rows per upload' };
  }

  // Case-insensitive existing-email pre-check. PostgREST `.in('email', …)` is
  // case-sensitive, but order/contact-form syncs write `lower(email)` while
  // older rows may retain mixed case — a miss lets UNIQUE violations poison
  // an entire insert chunk (all-or-nothing per 100-row batch).
  const emails = rows.map((r) => r.email);
  const existingSet = new Set<string>();
  const LOOKUP_CHUNK = 50;
  for (let i = 0; i < emails.length; i += LOOKUP_CHUNK) {
    const slice = emails.slice(i, i + LOOKUP_CHUNK);
    const orFilter = slice.map((e) => `email.ilike.${escapeIlike(e)}`).join(',');
    const { data: existing, error: lookupError } = await adminClient
      .from('crm_contacts')
      .select('email')
      .or(orFilter);
    if (lookupError) {
      return {
        success: false,
        error: `Existing-email lookup failed: ${lookupError.message}`,
        errors,
      };
    }
    for (const row of existing || []) {
      existingSet.add(row.email.toLowerCase());
    }
  }

  const toInsert = rows
    .filter((r) => !existingSet.has(r.email.toLowerCase()))
    .map((r) => ({
      email: r.email,
      first_name: r.first_name,
      last_name: r.last_name,
      phone: r.phone,
      // `address` was missing from this mapping as well as from the parser, so
      // adding the column to the import was necessary but not sufficient: the
      // row parsed it and the insert dropped it on the floor. Both halves of a
      // round trip, or neither.
      address: r.address,
      city: r.city,
      zip_code: r.zip_code,
      district: r.district,
      status: r.status,
      tags: r.tags,
      notes: r.notes,
      // The exporter writes this column and the importer used to drop it — so a
      // backup round-trip silently re-subscribed everyone who had opted out, and
      // the next broadcast mailed them anyway. Carry it through.
      do_not_email: r.do_not_email,
      source: 'import',
    }));

  const skipped = rows.length - toInsert.length;
  let imported = 0;
  const insertErrors: CRMImportError[] = [...errors];

  // Chunked inserts (PostgREST default max array params).
  const CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { data: created, error } = await adminClient
      .from('crm_contacts')
      .insert(chunk)
      .select('id');

    if (error) {
      insertErrors.push({
        line: 0,
        message:
          `Insert failed for a batch of ${chunk.length} rows ` +
          `(rows ${i + 1}–${i + chunk.length} of ${toInsert.length} new contacts): ${error.message}`,
      });
      continue;
    }
    const ids = (created || []).map((c) => c.id);
    imported += ids.length;

    if (ids.length > 0) {
      await adminClient.from('crm_activities').insert(
        ids.map((contactId) => ({
          contact_id: contactId,
          type: 'import',
          title: 'Imported from CSV',
          description: `Batch import of ${toInsert.length} contacts`,
          created_by: adminUserId,
        }))
      );
    }
  }

  // Only report success when work actually landed. A green toast on
  // "Imported 0, skipped N" (e.g. every insert failed) is a false positive.
  const insertFailed = insertErrors.some((e) => e.message.startsWith('Insert failed'));
  const success = imported > 0 || (skipped > 0 && !insertFailed);

  revalidateCRMRoutes();
  return {
    success,
    imported,
    skipped,
    invalidRows: errors.length,
    errors: insertErrors.slice(0, 50),
    error: success
      ? undefined
      : insertFailed
        ? 'All inserts failed — no contacts were imported'
        : undefined,
  };
}

export async function mergeCRMContacts({
  keepId,
  removeId,
}: {
  keepId: string;
  removeId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { adminClient, adminUserId } = await requireAdmin();

  if (keepId === removeId) {
    return { success: false, error: 'Cannot merge a contact into itself' };
  }

  const [{ data: keep }, { data: remove }] = await Promise.all([
    adminClient.from('crm_contacts').select('*').eq('id', keepId).single(),
    adminClient.from('crm_contacts').select('*').eq('id', removeId).single(),
  ]);

  if (!keep || !remove) {
    return { success: false, error: 'Both contacts must exist to merge' };
  }

  const unionTags = normalizeTags([...(keep.tags || []), ...(remove.tags || [])]);
  const mergedNotes = [keep.notes, remove.notes].filter(Boolean).join('\n\n---\n\n') || null;
  const lastContacted =
    keep.last_contacted_at && remove.last_contacted_at
      ? keep.last_contacted_at > remove.last_contacted_at
        ? keep.last_contacted_at
        : remove.last_contacted_at
      : keep.last_contacted_at || remove.last_contacted_at;

  // Move timeline + open tasks onto the survivor, then delete the duplicate.
  const [{ error: actErr }, { error: taskErr }] = await Promise.all([
    adminClient.from('crm_activities').update({ contact_id: keepId }).eq('contact_id', removeId),
    adminClient.from('crm_tasks').update({ contact_id: keepId }).eq('contact_id', removeId),
  ]);
  if (actErr) return { success: false, error: `Failed to move activities: ${actErr.message}` };
  if (taskErr) return { success: false, error: `Failed to move tasks: ${taskErr.message}` };

  const { error: updErr } = await adminClient
    .from('crm_contacts')
    .update({
      tags: unionTags,
      notes: mergedNotes,
      total_donated_cents: (keep.total_donated_cents || 0) + (remove.total_donated_cents || 0),
      last_contacted_at: lastContacted,
      do_not_email: keep.do_not_email || remove.do_not_email,
      unsubscribed_at: keep.unsubscribed_at || remove.unsubscribed_at || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', keepId);
  if (updErr) return { success: false, error: updErr.message };

  const { error: delErr } = await adminClient.from('crm_contacts').delete().eq('id', removeId);
  if (delErr) return { success: false, error: delErr.message };

  await adminClient.from('crm_activities').insert({
    contact_id: keepId,
    type: 'merge',
    title: 'Merged Duplicate Contact',
    description: `Consolidated ${remove.email} into ${keep.email}`,
    metadata: { removed_id: removeId, removed_email: remove.email },
    created_by: adminUserId,
  });

  revalidateCRMRoutes(keepId);
  return { success: true };
}

export async function sendCRMDirectEmail({
  contactId,
  subject,
  message,
}: {
  contactId: string;
  subject: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  const blocked = sendBlockedInE2E();
  if (blocked) return blocked;

  const { adminClient, adminUserId } = await requireAdmin();

  if (!subject.trim() || !message.trim()) {
    return { success: false, error: 'Subject and message are required' };
  }

  const limited = sendRateLimited(adminUserId, SEND_LIMIT);
  if (limited) return { success: false, error: limited };

  const { data: contact, error: fetchError } = await adminClient
    .from('crm_contacts')
    .select('id, email, first_name, last_name, do_not_email, unsubscribe_token')
    .eq('id', contactId)
    .single();

  if (fetchError || !contact) {
    return { success: false, error: 'Contact not found' };
  }

  if (contact.do_not_email) {
    return { success: false, error: 'Contact has unsubscribed — email sending is blocked' };
  }

  const cleanSubject = safeSubject(subject.trim());
  const recipientName =
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Supporter';
  const escapedMessage = escapeHtml(message.trim()).replace(/\n/g, '<br />');
  const unsubHref = unsubscribeUrl(contact.unsubscribe_token);

  const html = brandShell({
    eyebrow: 'Community Update',
    body: `
      <p style="margin:0 0 16px;color:#F1F5F9;font-size:16px;">Dear ${escapeHtml(recipientName)},</p>
      <div style="margin:0 0 20px;padding:20px;background:#0F172A;border-radius:12px;border-left:3px solid #2563EB;color:#F1F5F9;font-size:14px;line-height:1.7;">
        ${escapedMessage}
      </div>
      <p style="margin:24px 0 0;color:#94A3B8;font-size:13px;line-height:1.5;">
        In solidarity,<br />
        <strong style="color:#FFFFFF;">Indivisible Fair Oaks-Carmichael Organizing Team</strong>
      </p>
      <p style="margin:16px 0 0;font-size:12px;">
        <a href="${unsubHref}" style="color:#60A5FA;">Unsubscribe from chapter email</a>
      </p>
    `.trim(),
    footer: 'You received this direct civic update from Indivisible Fair Oaks-Carmichael.',
  });

  const sendResult = await sendEmail({
    to: contact.email,
    subject: cleanSubject,
    html,
    // The site origin comes from the same env var the HTML footer and the
    // unsubscribe link do. It used to be a literal here, so a staging build
    // mailed a text body pointing at the apex — which 302s to Google Sites
    // until the cutover — while the HTML in the same email pointed at staging.
    // Two different hosts in one message, and the one a screen reader reads
    // first was the wrong one. `unsubscribeUrl` is the existing derivation.
    text: [
      message.trim(),
      '',
      '--',
      'Indivisible Fair Oaks-Carmichael',
      env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, ''),
      '',
      `Unsubscribe: ${unsubHref}`,
    ].join('\n'),
    replyTo: env.ADMIN_ORDER_EMAIL || 'contact@indivisiblefairoaks.org',
    tags: [{ name: 'type', value: 'crm-direct' }],
    headers: listUnsubscribeHeaders(contact.unsubscribe_token),
  });

  if (!sendResult.ok) {
    return { success: false, error: `Email dispatch failed: ${sendResult.error}` };
  }

  const now = new Date().toISOString();

  await Promise.all([
    adminClient.from('crm_contacts').update({ last_contacted_at: now }).eq('id', contactId),
    adminClient.from('crm_activities').insert({
      contact_id: contactId,
      type: 'email_sent',
      title: `Sent Email: ${cleanSubject}`,
      description: message.trim(),
      metadata: { resend_id: sendResult.id, subject: cleanSubject },
      created_by: adminUserId,
    }),
  ]);

  revalidateCRMRoutes(contactId);
  return { success: true };
}

/**
 * Refuse to send from a test build.
 *
 * The contact form does not need this: its notifier is redirected to a local
 * mock in e2e, so the call is harmless. These paths are not like that. They
 * dispatch to a live Edge Function that talks to Resend, and the audience is a
 * real list of real constituents. If e2e ever gains a seeded admin session — the
 * obvious next step for testing the CRM — a single click in a spec would mail
 * the chapter.
 *
 * Refusing here rather than trusting the harness means the guarantee travels
 * with the code. A future test author does not need to know this rule exists, and
 * a misconfigured environment cannot quietly undo it.
 */
function sendBlockedInE2E(): { success: false; error: string } | null {
  return isE2EMode() ? { success: false, error: 'Sending is disabled in test builds.' } : null;
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
 * Render the broadcast a recipient would receive.
 *
 * The composer calls this to show a preview and the sender calls the same
 * builder to deliver, so the two cannot diverge. The previous "Sensory
 * Preview" was a different document: no logo, no greeting, no brand shell, no
 * unsubscribe footer, and a body rendered with `whitespace-pre-line` where the
 * server substituted `<br />`. An author previewing a broadcast saw an email no
 * recipient would ever receive — the AGENTS.md "no fake controls" failure in a
 * new place.
 */
export async function previewCRMBroadcast({
  subject,
  body,
  recipientName = 'Neighbor',
}: {
  subject: string;
  body: string;
  recipientName?: string;
}): Promise<{ html: string; text: string; subject: string }> {
  await requireAdmin();
  return {
    ...buildBroadcastEmail({
      recipientName,
      body,
      unsubscribeUrl: unsubscribeUrl('00000000-0000-0000-0000-000000000000'),
      logoUrl: LOGO_URL,
    }),
    subject: broadcastSubject(subject),
  };
}

/**
 * Save a broadcast without sending it.
 *
 * `crm_broadcasts.status` has carried a 'draft' value since the table was
 * created and nothing ever wrote one, so half the state machine was dead and a
 * half-written campaign could only be held in the browser. Drafts persist the
 * audience alongside the copy, so returning to one restores what it would send.
 *
 * `broadcastId` makes this an upsert. It used to insert unconditionally, so
 * pressing "Save draft" twice left two rows and the composer's handle — the only
 * record of which one it meant — lived in component state, so a reload orphaned
 * it and the draft became unremovable. Updating in place is what makes a draft
 * a document rather than a log entry.
 */
export async function saveCRMBroadcastDraft({
  broadcastId,
  subject,
  body,
  targetTags = [],
  targetStatus = [],
  targetDistricts = [],
}: BroadcastTarget & { broadcastId?: string | null; subject: string; body: string }): Promise<{
  success: boolean;
  broadcastId?: string;
  error?: string;
}> {
  const { adminClient, adminUserId } = await requireAdmin();
  const cleanSubject = broadcastSubject(subject);
  if (!cleanSubject) return { success: false, error: 'Subject is required' };
  if (!body.trim()) return { success: false, error: 'Message body is required' };

  targetTags = normalizeTags(targetTags);
  const row = {
    subject: cleanSubject,
    body: body.trim(),
    target_tags: targetTags,
    target_status: targetStatus,
    target_districts: targetDistricts,
  };

  if (broadcastId) {
    // Scoped to `status = 'draft'` in the WHERE clause rather than checked in
    // JS: a draft that has since been sent must not be rewritten, and a
    // conditional update is the only way to make that hold under concurrency.
    const { data, error } = await adminClient
      .from('crm_broadcasts')
      .update(row)
      .eq('id', broadcastId)
      .eq('status', 'draft')
      .select('id')
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) {
      return {
        success: false,
        error: 'That draft is no longer a draft — it was sent or removed. Save it as a new draft.',
      };
    }
    revalidateCRMRoutes();
    return { success: true, broadcastId: data.id };
  }

  const { data, error } = await adminClient
    .from('crm_broadcasts')
    .insert({
      ...row,
      recipient_count: 0,
      status: 'draft',
      created_by: adminUserId,
    })
    .select('id')
    .single();
  if (error) return { success: false, error: error.message };

  revalidateCRMRoutes();
  return { success: true, broadcastId: data.id };
}

export async function deleteCRMBroadcastDraft(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { adminClient } = await requireAdmin();
  const { data: existing } = await adminClient
    .from('crm_broadcasts')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  // Only drafts are removable. Deleting a sent broadcast would orphan every
  // `email_sent` activity referencing it — that log is the audit trail.
  if (!existing) return { success: false, error: 'That broadcast no longer exists' };
  if (existing.status !== 'draft') {
    return { success: false, error: 'Only unsent drafts can be deleted' };
  }
  const { error } = await adminClient.from('crm_broadcasts').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidateCRMRoutes();
  return { success: true };
}

/**
 * Queue a broadcast and hand delivery to a background function.
 *
 * The send used to run entirely inside this server action: five recipients per
 * sequential round-trip, inside one request. Past roughly a thousand recipients
 * the platform killed the request, and because the row was written as `sending`
 * before the loop began it stayed that way permanently — the composer rendered
 * it as a benign amber pill with no way to retry or recover.
 *
 * Now the action does only what must be transactional: resolve the audience,
 * write the log row, dispatch. Progress lives on the row and the composer polls
 * `getBroadcastProgress()`, so a send outlives the request that started it.
 */
export async function sendCRMBroadcast({
  subject,
  body,
  targetTags = [],
  targetStatus = [],
  targetDistricts = [],
}: BroadcastTarget & { subject: string; body: string }): Promise<{
  success: boolean;
  recipientCount?: number;
  broadcastId?: string;
  /** Present when the sender reports the delivery finished but its bookkeeping
   *  did not; carries the sender's own warning, not an error. */
  warning?: string;
  error?: string;
}> {
  const blocked = sendBlockedInE2E();
  if (blocked) return blocked;

  const { adminClient, adminUserId } = await requireAdmin();

  const cleanSubject = broadcastSubject(subject);
  if (!cleanSubject) return { success: false, error: 'Subject is required' };
  if (!body.trim()) return { success: false, error: 'Message body is required' };

  const limited = sendRateLimited(adminUserId, BROADCAST_LIMIT);
  if (limited) return { success: false, error: limited };

  targetTags = normalizeTags(targetTags);
  let audience: { recipients: BroadcastRecipient[]; exhausted: boolean };
  try {
    audience = await resolveBroadcastRecipients(adminClient, {
      targetTags,
      targetStatus,
      targetDistricts,
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to resolve recipients',
    };
  }
  const { recipients } = audience;

  if (recipients.length === 0) {
    return { success: false, error: 'No contacts match this audience' };
  }
  // Refuse rather than truncate. A silently shortened broadcast is worse than a
  // refused one: the author would believe four thousand people heard from them.
  //
  // This comparison could never fire. `resolveBroadcastRecipients` pages with
  // `offset < BROADCAST_RECIPIENT_CEILING`, so it returned at most exactly
  // `CEILING` rows and `> CEILING` was false — the branch was dead, and an
  // audience of twelve thousand was quietly cut to five thousand and sent as a
  // healthy campaign. The resolver now reports whether it read the audience to
  // exhaustion, and *that* is what this refuses on: a loop that stopped because
  // it hit the ceiling is an audience we have not finished counting.
  if (!audience.exhausted) {
    return {
      success: false,
      error:
        `This audience is larger than the ` +
        `${BROADCAST_RECIPIENT_CEILING.toLocaleString()} limit for one broadcast. ` +
        'Narrow the audience and try again — nothing was sent.',
    };
  }

  const { data: broadcast, error: bcError } = await adminClient
    .from('crm_broadcasts')
    .insert({
      subject: cleanSubject,
      body: body.trim(),
      target_tags: targetTags,
      target_status: targetStatus,
      target_districts: targetDistricts,
      recipient_count: recipients.length,
      status: 'queued',
      // The column was added in 20260929140000 precisely so a blast had an
      // attributable author, and all three inserts omitted it. `adminUserId` is
      // already in scope from `requireAdmin()`.
      created_by: adminUserId,
    })
    .select('id')
    .single();

  if (bcError || !broadcast) {
    return { success: false, error: 'Failed to create broadcast log' };
  }

  const dispatched = await dispatchBroadcastSender(broadcast.id);
  if (!dispatched.ok) {
    // Mark it failed rather than leaving it queued forever: the admin needs to
    // see that it did not go out, and be able to try again.
    await adminClient
      .from('crm_broadcasts')
      .update({ status: 'failed', sent_at: new Date().toISOString() })
      .eq('id', broadcast.id);
    return {
      success: false,
      recipientCount: recipients.length,
      broadcastId: broadcast.id,
      error: `Broadcast could not be started: ${dispatched.error}`,
    };
  }

  revalidateCRMRoutes();
  return {
    success: true,
    recipientCount: recipients.length,
    broadcastId: broadcast.id,
    warning: dispatched.warning,
  };
}

/**
 * Send a preview of this broadcast to the signed-in admin, and only to them.
 *
 * Authors need to see the rendered email before committing an audience to it,
 * and the risk in offering that is obvious: a "send a test" button that accepts
 * a recipient is one typo away from mailing the whole chapter, and there is no
 * undo. So the recipient is never input — it is read from the server-side
 * session, which means this function has no way to express "send this to
 * someone else". A real audience still has to go through `sendCRMBroadcast`,
 * with its rate limit and its recipient ceiling.
 *
 * Delivery itself is unchanged: the row is written with `test_recipient` set and
 * handed to the same Edge Function. The function treats that column as the
 * complete audience and ignores `target_*` entirely, so the narrowing happens
 * where recipients are resolved rather than being trusted from here.
 */
export async function sendCRMBroadcastSelfTest({
  subject,
  body,
}: {
  subject: string;
  body: string;
}): Promise<{ success: boolean; recipient?: string; error?: string }> {
  const blocked = sendBlockedInE2E();
  if (blocked) return blocked;

  const { adminClient, adminUserId, adminEmail } = await requireAdmin();

  const cleanSubject = broadcastSubject(subject);
  if (!cleanSubject) return { success: false, error: 'Subject is required' };
  if (!body.trim()) return { success: false, error: 'Message body is required' };
  if (!adminEmail) {
    return { success: false, error: 'Your account has no email address to send the test to' };
  }

  const limited = sendRateLimited(adminUserId, BROADCAST_LIMIT);
  if (limited) return { success: false, error: limited };

  // The subject is marked because this lands in a real inbox, and an unmarked
  // "Meeting tomorrow" from the chapter is indistinguishable from the real
  // thing. Someone who finds one in production must know at a glance that no
  // one else received it.
  const markedSubject = `[TEST — not sent to the list] ${cleanSubject}`;

  const { data, error } = await adminClient
    .from('crm_broadcasts')
    .insert({
      subject: markedSubject,
      body: body.trim(),
      recipient_count: 1,
      test_recipient: adminEmail,
      test_only: true,
      status: 'queued',
      created_by: adminUserId,
    })
    .select('id')
    .single();

  if (error || !data) return { success: false, error: error?.message || 'Failed to log the test' };

  const dispatched = await dispatchBroadcastSender(data.id);
  if (!dispatched.ok) {
    await adminClient
      .from('crm_broadcasts')
      .update({ status: 'failed', sent_at: new Date().toISOString() })
      .eq('id', data.id);
    return { success: false, error: `Test could not be sent: ${dispatched.error}` };
  }

  revalidateCRMRoutes();
  return { success: true, recipient: adminEmail };
}

/**
 * Hand the send to the `crm-broadcast-send` Edge Function.
 *
 * The function is deliberately synchronous: the response carries the delivery
 * outcome of the whole campaign, and the `sent_count`/`failed_count` it writes to
 * the row first are the same numbers in the response. A fire-and-forget request
 * would report "queued" and never the truth of what happened,
 * and the function has no way to say it ran unless someone reads what it said.
 * On the client both ends wait — the composer reports progress through its
 * own polling of the row after this resolves.
 */
async function dispatchBroadcastSender(
  broadcastId: string
): Promise<{ ok: true; warning?: string } | { ok: false; error: string }> {
  const functionUrl = env.CRM_BROADCAST_FUNCTION_URL;
  if (!functionUrl) {
    return { ok: false, error: 'the broadcast sender is not configured on this deployment' };
  }
  const key = env.SUPABASE_SECRET_KEY;
  if (!key) {
    return { ok: false, error: 'the service key is unavailable' };
  }
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // service_role is the only role permitted to enqueue a send. This call
        // originates from an action that already passed requireAdmin().
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ broadcast_id: broadcastId }),
    });
    if (!response.ok) return { ok: false, error: `sender responded ${response.status}` };
    // The dispatcher used to check only `response.ok` and return, which threw away
    // the body — and with it the one thing the function was careful to compute:
    // *when the mail went out but its record did not*, in the form of
    // `activityWriteFailures`/`activityRowsLost` and a plain-language warning. A
    // broadcast can therefore ship green and leave every contact without a
    // timeline entry, and no one would ever be told. The warning rides the
    // result out to the admin from here.
    try {
      const payload = (await response.json()) as {
        skipped?: boolean;
        reason?: string;
        warning?: string;
      };
      return {
        ok: true,
        warning: typeof payload.warning === 'string' ? payload.warning : undefined,
      };
    } catch {
      // The function answered 200 with a non-JSON body; treat as a bare success,
      // same as before.
      return { ok: true };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'sender unreachable' };
  }
}

/** Poll target for the composer's progress readout. */
export async function getBroadcastProgress(broadcastId: string): Promise<BroadcastProgress | null> {
  const { adminClient } = await requireAdmin();
  const { data, error } = await adminClient
    .from('crm_broadcasts')
    .select('id, subject, status, recipient_count, sent_count, failed_count, sent_at, created_at')
    .eq('id', broadcastId)
    .maybeSingle();
  if (error) throw new Error(`Failed to read broadcast progress: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    subject: data.subject,
    status: (data.status ?? 'draft') as BroadcastProgress['status'],
    recipientCount: data.recipient_count ?? 0,
    sentCount: data.sent_count ?? 0,
    failedCount: data.failed_count ?? 0,
    sentAt: data.sent_at,
    createdAt: data.created_at ?? new Date().toISOString(),
  };
}

/**
 * Backfill contacts from contact-form submissions, profiles and completed
 * orders. Idempotent: re-running it unions tags and only applies a donation
 * total the first time each order is seen.
 */
export async function triggerHistoricalCRMSync(): Promise<{
  success: boolean;
  syncedCount?: number;
  error?: string;
}> {
  const { adminClient } = await requireAdmin();

  const { data, error } = await adminClient.rpc('crm_sync_historical_records');
  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as { contacts_synced?: number; activities_created?: number } | null;

  revalidateCRMRoutes();
  return {
    success: true,
    syncedCount: result?.contacts_synced ?? 0,
  };
}

/**
 * Past campaigns: what has actually been sent, and what failed.
 *
 * Drafts are excluded, and the exclusion is in the query rather than filtered in
 * JavaScript for two reasons. It is what the partial index
 * `crm_broadcasts_recent_idx ... WHERE status <> 'draft'` was created for, and a
 * query that does not state the predicate cannot use it — so the index was dead
 * and this read degraded to a scan of every row the chapter has ever composed.
 * And a draft is not history: an unsent draft in the campaign log tells an
 * organizer that people were contacted when nobody was, which is the reading the
 * row's own `draft` pill is least able to prevent.
 *
 * `getCRMBroadcastDrafts()` is the other half — resuming a draft is a real
 * workflow, and it needs its own read rather than a filter over this one.
 */
export async function getCRMBroadcasts(): Promise<CRMBroadcast[]> {
  const { adminClient } = await requireAdmin();
  const { data, error } = await adminClient
    .from('crm_broadcasts')
    .select('*')
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to fetch broadcasts: ${error.message}`);
  }

  return data || [];
}

/** Unsent work in progress, newest first. Resumable, and removable. */
export async function getCRMBroadcastDrafts(): Promise<CRMBroadcast[]> {
  const { adminClient } = await requireAdmin();
  const { data, error } = await adminClient
    .from('crm_broadcasts')
    .select('*')
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to fetch broadcast drafts: ${error.message}`);
  }

  return data || [];
}

/** Distinct tags across the directory — powers filter + broadcast chips. */
export async function getCRMExistingTags(): Promise<string[]> {
  const { adminClient } = await requireAdmin();
  const tags = new Set<string>();
  const PAGE = 1000;

  for (let offset = 0; offset < 20_000; offset += PAGE) {
    const { data, error } = await adminClient
      .from('crm_contacts')
      .select('tags')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) {
      throw new Error(`Failed to load tags: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      for (const t of row.tags || []) {
        if (t) tags.add(t);
      }
    }
    if (data.length < PAGE) break;
  }

  return [...tags].sort((a, b) => a.localeCompare(b));
}

export async function getBroadcastRecipientCount({
  targetTags = [],
  targetStatus = [],
  targetDistricts = [],
}: {
  targetTags?: string[];
  targetStatus?: string[];
  targetDistricts?: string[];
}): Promise<number> {
  const { adminClient } = await requireAdmin();

  targetTags = normalizeTags(targetTags);

  let qb = adminClient
    .from('crm_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('do_not_email', false);

  if (targetStatus.length > 0) {
    qb = qb.in('status', targetStatus);
  }

  if (targetDistricts.length > 0) {
    qb = qb.in('district', targetDistricts);
  }

  if (targetTags.length > 0) {
    qb = qb.contains('tags', targetTags);
  }

  const { count, error } = await qb;
  if (error) {
    throw new Error(`Failed to count broadcast recipients: ${error.message}`);
  }

  return count ?? 0;
}
