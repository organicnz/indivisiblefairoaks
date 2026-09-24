'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { type CRMImportError, parseCRMImportCsv, toCsvRow } from '@/lib/crm-import';
import { brandShell, escapeHtml, safeSubject, sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
import type { Database } from '@/types/supabase';

export type CRMContact = Database['public']['Tables']['crm_contacts']['Row'];
export type CRMContactInsert = Database['public']['Tables']['crm_contacts']['Insert'];
export type CRMContactUpdate = Database['public']['Tables']['crm_contacts']['Update'];
export type CRMActivity = Database['public']['Tables']['crm_activities']['Row'];
export type CRMBroadcast = Database['public']['Tables']['crm_broadcasts']['Row'];
export type CRMTask = Database['public']['Tables']['crm_tasks']['Row'];
export type CRMSegment = Database['public']['Tables']['crm_segments']['Row'];

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
  tags: z.array(z.string()).default([]),
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

export async function getCRMStats(): Promise<CRMStats> {
  const { adminClient } = await requireAdmin();

  const [
    { count: totalContacts },
    { count: activeVolunteers },
    { count: localDistrict },
    { data: donorRows },
    { count: openTasks },
  ] = await Promise.all([
    adminClient.from('crm_contacts').select('*', { count: 'exact', head: true }),
    adminClient
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active_volunteer', 'choir', 'organizer']),
    adminClient
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })
      .in('district', ['CA-03', 'CA-06']),
    adminClient.from('crm_contacts').select('total_donated_cents').gt('total_donated_cents', 0),
    adminClient.from('crm_tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  const totalDonationsCents = (donorRows || []).reduce(
    (sum, r) => sum + (r.total_donated_cents || 0),
    0
  );

  return {
    totalContacts: totalContacts ?? 0,
    activeVolunteers: activeVolunteers ?? 0,
    localDistrict: localDistrict ?? 0,
    totalDonors: donorRows?.length ?? 0,
    totalDonationsCents,
    openTasks: openTasks ?? 0,
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

  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/tasks');
  revalidatePath(`/admin/crm/${contactId}`);
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
  const { error } = await adminClient
    .from('crm_tasks')
    .update({
      status,
      completed_at: status === 'done' ? now : null,
      updated_at: now,
    })
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/tasks');
  return { success: true };
}

export async function deleteCRMTask(id: string): Promise<{ success: boolean; error?: string }> {
  const { adminClient } = await requireAdmin();
  const { error } = await adminClient.from('crm_tasks').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/tasks');
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
    revalidatePath('/admin/crm');
    return { success: true, segmentId: data.id };
  }

  const { data, error } = await adminClient.from('crm_segments').insert(row).select('id').single();
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A segment with that name already exists' };
    }
    return { success: false, error: error.message };
  }
  revalidatePath('/admin/crm');
  return { success: true, segmentId: data.id };
}

export async function deleteCRMSegment(id: string): Promise<{ success: boolean; error?: string }> {
  const { adminClient } = await requireAdmin();
  const { error } = await adminClient.from('crm_segments').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/crm');
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

    revalidatePath('/admin/crm');
    revalidatePath(`/admin/crm/${id}`);
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

  revalidatePath('/admin/crm');
  return { success: true, contactId: created.id };
}

export async function deleteCRMContact(id: string): Promise<{ success: boolean; error?: string }> {
  const { adminClient } = await requireAdmin();

  const { error } = await adminClient.from('crm_contacts').delete().eq('id', id);
  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/crm');
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

  revalidatePath(`/admin/crm/${contactId}`);
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

  revalidatePath('/admin/crm');
  revalidatePath(`/admin/crm/${contactId}`);
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

  revalidatePath('/admin/crm');
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

  revalidatePath('/admin/crm');
  revalidatePath(`/admin/crm/${keepId}`);
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

  revalidatePath(`/admin/crm/${contactId}`);
  return { success: true };
}

export async function sendCRMBroadcast({
  subject,
  body,
  targetTags = [],
  targetStatus = [],
  targetDistricts = [],
}: {
  subject: string;
  body: string;
  targetTags?: string[];
  targetStatus?: string[];
  targetDistricts?: string[];
}): Promise<{
  success: boolean;
  recipientCount?: number;
  failedCount?: number;
  broadcastId?: string;
  error?: string;
}> {
  const { adminClient, adminUserId } = await requireAdmin();

  if (!subject.trim() || !body.trim()) {
    return { success: false, error: 'Subject and message body are required' };
  }

  // PostgREST caps a single response at 1000 rows — page through recipients.
  const RECIPIENT_PAGE = 1000;
  const RECIPIENT_HARD_CAP = 10_000;
  const recipients: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    unsubscribe_token: string;
  }[] = [];

  for (let offset = 0; offset < RECIPIENT_HARD_CAP; offset += RECIPIENT_PAGE) {
    let qb = adminClient
      .from('crm_contacts')
      .select('id, email, first_name, last_name, unsubscribe_token');

    // Consent gate: never resolve opted-out contacts as recipients.
    qb = qb.eq('do_not_email', false);

    if (targetStatus.length > 0) {
      qb = qb.in('status', targetStatus);
    }
    if (targetDistricts.length > 0) {
      qb = qb.in('district', targetDistricts);
    }
    if (targetTags.length > 0) {
      qb = qb.contains('tags', targetTags);
    }

    const { data, error: recError } = await qb
      .order('id', { ascending: true })
      .range(offset, offset + RECIPIENT_PAGE - 1);

    if (recError) {
      return { success: false, error: `Failed to resolve recipients: ${recError.message}` };
    }
    if (!data || data.length === 0) break;
    recipients.push(...data);
    if (data.length < RECIPIENT_PAGE) break;
  }

  if (recipients.length === 0) {
    return { success: false, error: 'No constituents match the selected criteria' };
  }

  // Insert draft broadcast record
  const { data: broadcast, error: bcError } = await adminClient
    .from('crm_broadcasts')
    .insert({
      subject: safeSubject(subject.trim()),
      body: body.trim(),
      target_tags: targetTags,
      target_status: targetStatus,
      target_districts: targetDistricts,
      recipient_count: recipients.length,
      status: 'sending',
    })
    .select('id')
    .single();

  if (bcError || !broadcast) {
    return { success: false, error: 'Failed to create broadcast log' };
  }

  const cleanSubject = safeSubject(subject.trim());
  const escapedBody = escapeHtml(body.trim()).replace(/\n/g, '<br />');

  // Dispatch in small concurrent batches to keep within Fluid CPU + Resend limits.
  let successfulSends = 0;
  let failedSends = 0;
  const BATCH = 5;
  const now = new Date().toISOString();

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (recipient) => {
        const recipientName =
          [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || 'Supporter';
        const unsubHref = unsubscribeUrl(recipient.unsubscribe_token);
        const html = brandShell({
          eyebrow: 'Chapter Broadcast',
          body: `
            <p style="margin:0 0 16px;color:#F1F5F9;font-size:16px;">Hello ${escapeHtml(recipientName)},</p>
            <div style="margin:0 0 20px;padding:20px;background:#0F172A;border-radius:12px;border-left:3px solid #2563EB;color:#F1F5F9;font-size:14px;line-height:1.7;">
              ${escapedBody}
            </div>
            <p style="margin:24px 0 0;color:#94A3B8;font-size:13px;line-height:1.5;">
              Indivisible Fair Oaks-Carmichael Organizing Team<br />
              <a href="https://indivisiblefairoaks.org" style="color:#60A5FA;text-decoration:none;">indivisiblefairoaks.org</a>
            </p>
            <p style="margin:12px 0 0;font-size:12px;">
              <a href="${unsubHref}" style="color:#60A5FA;">Unsubscribe from chapter email</a>
            </p>
          `.trim(),
          footer: 'You received this community broadcast as a registered supporter or volunteer.',
        });

        const res = await sendEmail({
          to: recipient.email,
          subject: cleanSubject,
          html,
          text: `${body.trim()}\n\n--\nIndivisible Fair Oaks-Carmichael\nhttps://indivisiblefairoaks.org\n\nUnsubscribe: ${unsubHref}`,
          replyTo: env.ADMIN_ORDER_EMAIL || 'contact@indivisiblefairoaks.org',
          tags: [
            { name: 'type', value: 'crm-broadcast' },
            { name: 'broadcast_id', value: broadcast.id },
          ],
          headers: listUnsubscribeHeaders(recipient.unsubscribe_token),
        });
        return { recipient, res };
      })
    );

    for (const { recipient, res } of results) {
      if (res.ok) {
        successfulSends += 1;
        await adminClient.from('crm_activities').insert({
          contact_id: recipient.id,
          type: 'email_sent',
          title: `Broadcast: ${cleanSubject}`,
          description: `Delivered via campaign #${broadcast.id}`,
          metadata: { broadcast_id: broadcast.id, resend_id: res.id },
          created_by: adminUserId,
        });
      } else {
        failedSends += 1;
      }
    }
  }

  await adminClient
    .from('crm_broadcasts')
    .update({
      status: failedSends === 0 ? 'sent' : successfulSends > 0 ? 'sent' : 'failed',
      recipient_count: recipients.length,
      failed_count: failedSends,
      sent_at: now,
    })
    .eq('id', broadcast.id);

  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/broadcasts');

  if (successfulSends === 0) {
    return {
      success: false,
      recipientCount: recipients.length,
      failedCount: failedSends,
      broadcastId: broadcast.id,
      error: 'All deliveries failed',
    };
  }

  return {
    success: true,
    recipientCount: successfulSends,
    failedCount: failedSends,
    broadcastId: broadcast.id,
  };
}

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

  revalidatePath('/admin/crm');
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
