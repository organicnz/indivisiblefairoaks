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
  contactId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
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
  tags: z.array(z.string()).max(20).default([]),
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
 */
async function resolveBroadcastRecipients(
  adminClient: AdminClient,
  target: BroadcastTarget
): Promise<BroadcastRecipient[]> {
  const targetTags = target.targetTags ?? [];
  const targetStatus = target.targetStatus ?? [];
  const targetDistricts = target.targetDistricts ?? [];
  const PAGE = 1000;
  const recipients: BroadcastRecipient[] = [];

  for (let offset = 0; offset < BROADCAST_RECIPIENT_CEILING; offset += PAGE) {
    let qb = adminClient
      .from('crm_contacts')
      .select('id, email, first_name, last_name, unsubscribe_token')
      .eq('do_not_email', false);

    if (targetStatus.length > 0) qb = qb.in('status', targetStatus);
    if (targetDistricts.length > 0) qb = qb.in('district', targetDistricts);
    if (targetTags.length > 0) {
      for (const tag of targetTags) qb = qb.contains('tags', [tag]);
    }

    const { data, error } = await qb.range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Failed to resolve recipients: ${error.message}`);
    if (!data || data.length === 0) break;
    recipients.push(...(data as BroadcastRecipient[]));
    if (data.length < PAGE) break;
  }
  return recipients;
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
  const tags = tagList?.length ? tagList : splitList(tag).filter((t) => t !== 'all');
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
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
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
    'District',
    'City',
    'Zip Code',
    'Status',
    'Tags',
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
      c.district || '',
      c.city || '',
      c.zip_code || '',
      c.status,
      (c.tags || []).join('; '),
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
      contact_id: contactId,
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
    const { data: previous } = await adminClient
      .from('crm_contacts')
      .select('status, email, tags, notes')
      .eq('id', id)
      .single();

    const statusChanged = previous != null && previous.status !== data.status;

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
      city: r.city,
      zip_code: r.zip_code,
      district: r.district,
      status: r.status,
      tags: r.tags,
      notes: r.notes,
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
      insertErrors.push({ line: 0, message: `Insert failed: ${error.message}` });
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

  const unionTags = [...new Set([...(keep.tags || []), ...(remove.tags || [])])];
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
    text: `${message.trim()}\n\n--\nIndivisible Fair Oaks-Carmichael\nhttps://indivisiblefairoaks.org\n\nUnsubscribe: ${unsubHref}`,
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
 */
export async function saveCRMBroadcastDraft({
  subject,
  body,
  targetTags = [],
  targetStatus = [],
  targetDistricts = [],
}: BroadcastTarget & { subject: string; body: string }): Promise<{
  success: boolean;
  broadcastId?: string;
  error?: string;
}> {
  const { adminClient } = await requireAdmin();
  const cleanSubject = broadcastSubject(subject);
  if (!cleanSubject) return { success: false, error: 'Subject is required' };
  if (!body.trim()) return { success: false, error: 'Message body is required' };

  const { data, error } = await adminClient
    .from('crm_broadcasts')
    .insert({
      subject: cleanSubject,
      body: body.trim(),
      target_tags: targetTags,
      target_status: targetStatus,
      target_districts: targetDistricts,
      recipient_count: 0,
      status: 'draft',
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
  error?: string;
}> {
  const { adminClient, adminUserId } = await requireAdmin();

  const cleanSubject = broadcastSubject(subject);
  if (!cleanSubject) return { success: false, error: 'Subject is required' };
  if (!body.trim()) return { success: false, error: 'Message body is required' };

  const limited = sendRateLimited(adminUserId, BROADCAST_LIMIT);
  if (limited) return { success: false, error: limited };

  let recipients: BroadcastRecipient[];
  try {
    recipients = await resolveBroadcastRecipients(adminClient, {
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

  if (recipients.length === 0) {
    return { success: false, error: 'No contacts match this audience' };
  }
  // Refuse rather than truncate. A silently shortened broadcast is worse than a
  // refused one: the author would believe four thousand people heard from them.
  if (recipients.length > BROADCAST_RECIPIENT_CEILING) {
    return {
      success: false,
      error:
        `This audience has ${recipients.length.toLocaleString()} contacts, over the ` +
        `${BROADCAST_RECIPIENT_CEILING.toLocaleString()} limit for one broadcast. ` +
        'Narrow the audience and try again.',
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
  return { success: true, recipientCount: recipients.length, broadcastId: broadcast.id };
}

/**
 * Hand the send to the `crm-broadcast-send` Edge Function.
 *
 * The function owns delivery, progress and the final status from here, so the
 * request that queues the broadcast can return immediately.
 */
async function dispatchBroadcastSender(
  broadcastId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
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
    return { ok: true };
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

export async function getCRMBroadcasts(): Promise<CRMBroadcast[]> {
  const { adminClient } = await requireAdmin();
  const { data, error } = await adminClient
    .from('crm_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to fetch broadcasts: ${error.message}`);
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
