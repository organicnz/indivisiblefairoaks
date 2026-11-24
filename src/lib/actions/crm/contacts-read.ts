import { crmContactDoNotEmail, normalizeCRMEmail } from '@/lib/crm-contact-options';
import { getDirectEmailDeliveries, resendIdFromSnapshot } from '@/lib/crm-direct-email-delivery';
import { applyCRMStatusFilter } from '@/lib/crm-donor';
import { splitActiveValues } from '@/lib/crm-filters';
import { normalizeTags, toCsvRow } from '@/lib/crm-import';
import {
  CRM_CONTACT_TIMELINE_PAGE_SIZE,
  CRM_DIRECTORY_MAX_PAGE_SIZE,
  CRM_DIRECTORY_PAGE_SIZE,
  CRM_EXPORT_LIMIT,
} from '@/lib/crm-limits';
import { type CRMTagScan, getCachedCRMTags } from '@/lib/crm-tag-scan';
import type { ConsentDecision, CRMActivityWithDelivery, CRMContact, CRMTask } from '@/types/crm';
import {
  type AdminClient,
  crmAuditLostWarning,
  escapeIlikeOrValue,
  recordCRMAudit,
  requireCRMAdmin,
} from './shared';

export interface GetCRMContactsParams {
  query?: string;
  status?: string;
  district?: string;
  tag?: string;
  /** Comma-separated multi-value filters — take precedence over the single-value fields. */
  statusList?: string[];
  districtList?: string[];
  tagList?: string[];
  /** Consent audit: opt-outs, opt-ins, and the never-asked third state. */
  consent?: ConsentDecision;
  page?: number;
  pageSize?: number;
}

type ContactFilterState = {
  statuses: string[];
  districts: string[];
  tags: string[];
  q: string;
  /**
   * Tri-state, so `undefined` (no consent filter) is no longer the only way to
   * say "not filtering". `null` means "consent IS null", and it needs `.is()`:
   * `.eq('do_not_email', null)` is `col=eq.null` in PostgREST and matches
   * nothing, so the `unasked` filter would have silently returned the whole
   * directory instead of the unasked contacts.
   */
  doNotEmail?: boolean | null;
};

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
  consent,
}: GetCRMContactsParams): ContactFilterState {
  const statuses = statusList?.length ? statusList : splitActiveValues(status ?? '');
  const districts = districtList?.length ? districtList : splitActiveValues(district ?? '');
  const tags = normalizeTags(tagList?.length ? tagList : splitActiveValues(tag ?? ''));
  return {
    statuses,
    districts,
    tags,
    q: query.trim().slice(0, 100),
    // `unasked` maps to `null`, which is a *value* the filter uses rather than
    // the absence of one — hence `null` rather than `undefined` here, and `.is()`
    // below.
    doNotEmail: consent === undefined ? undefined : crmContactDoNotEmail(consent),
  };
}

/** The applied directory filters, normalized the same way the query sees them. */
function auditExportFilters(filters: ContactFilterState, consent?: ConsentDecision) {
  return {
    query: filters.q || null,
    statuses: filters.statuses,
    districts: filters.districts,
    tags: filters.tags,
    consent: consent ?? null,
  };
}

function applyContactFilters(qb: ReturnType<typeof contactSelect>, filters: ContactFilterState) {
  let out = qb;
  out = applyCRMStatusFilter(out, filters.statuses);
  if (filters.districts.length === 1) {
    out = out.eq('district', filters.districts[0]);
  } else if (filters.districts.length > 1) {
    out = out.in('district', filters.districts);
  }
  if (filters.tags.length > 0) {
    out = out.contains('tags', filters.tags);
  }
  if (filters.doNotEmail !== undefined) {
    // `.is()` for the null case, never `.eq(col, null)`. PostgREST serialises the
    // latter as `col=eq.null`, which matches nothing — so the `unasked` filter
    // would return the entire directory and an organiser auditing opt-outs would
    // be shown every constituent, labelled as though none of them had been asked.
    if (filters.doNotEmail === null) out = out.is('do_not_email', null);
    else out = out.eq('do_not_email', filters.doNotEmail);
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
  // Offsets are only coherent against a total order: created_at ties across
  // a bulk insert, so id breaks the tie and a row cannot duplicate or vanish
  // between pages.
  let result = await qb
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  /*
   * Fallback: migration not applied yet, or FTS tokenization missed a partial
   * match. First page only, and only when it is empty or errored.
   *
   * The old condition fired on *any* empty page. Search a term whose FTS
   * matches fill exactly one page: page 1 returns FTS rows with `count: 50`,
   * page 2 comes back empty, the fallback runs ILIKE — a broader predicate —
   * and returns *those* rows with `count: 500`. The pager then reads "page 2 of
   * 10" on a list whose page 1 said "of 1", and neither page is wrong on its
   * own, which is why nobody caught it by looking at one page at a time.
   */
  if (filters.q && page === 1 && (result.error || !result.data?.length)) {
    qb = applyContactFilters(contactSelect(adminClient), filters);
    result = await qb
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);
  }

  if (result.error) {
    return { contacts: [], totalCount: 0, error: result.error.message };
  }
  if (result.count === null) {
    return { contacts: [], totalCount: 0, error: 'total count unavailable' };
  }
  return { contacts: (result.data as CRMContact[]) || [], totalCount: result.count };
}

export type FindCRMContactByEmailResult = {
  contact: CRMContact | null;
  error?: string;
};

/**
 * Preflight one normalized email before the contact editor writes.
 *
 * This is deliberately a read: the unique constraint on `crm_contacts.email`
 * remains the authority. The lookup narrows the ordinary duplicate case so the
 * editor can offer Open or Merge before a write is attempted; a concurrent
 * create or re-key that slips past it is handled by `saveCRMContact`'s 23505
 * branch, not by giving this function a lock it cannot hold across the form.
 */
export async function findCRMContactByEmail({
  email,
  excludeContactId,
}: {
  email: string;
  excludeContactId?: string;
}): Promise<FindCRMContactByEmailResult> {
  const normalizedEmail = normalizeCRMEmail(email);
  if (!normalizedEmail) return { contact: null, error: 'Email address is required' };

  const { adminClient } = await requireCRMAdmin();
  let query = adminClient.from('crm_contacts').select('*').eq('email', normalizedEmail);
  if (excludeContactId) query = query.neq('id', excludeContactId);

  const { data, error } = await query.maybeSingle();
  if (error) return { contact: null, error: error.message };
  return { contact: (data as CRMContact | null) ?? null };
}

export async function getCRMContacts(params: GetCRMContactsParams = {}): Promise<{
  contacts: CRMContact[];
  totalCount: number;
}> {
  const { adminClient } = await requireCRMAdmin();
  // Clamped, because both values come from URL search params and reach PostgREST
  // as a range. `page: 0` produced `range(-50, -1)`, which is a 416 rather than
  // a read, and an unclamped `pageSize` let any caller ask for the whole
  // directory. `getContentList` has clamped its pair since it was written; this
  // one had not, so the same request was safe on the content side and not here.
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const pageSize = Math.min(
    CRM_DIRECTORY_MAX_PAGE_SIZE,
    Math.max(1, Math.floor(Number(params.pageSize) || CRM_DIRECTORY_PAGE_SIZE))
  );
  const filters = resolveFilters(params);
  const result = await fetchContactPage(adminClient, filters, page, pageSize);
  if (result.error) {
    throw new Error(`Failed to load CRM contacts: ${result.error}`);
  }
  return { contacts: result.contacts, totalCount: result.totalCount };
}

export async function exportCRMContacts(params: GetCRMContactsParams = {}): Promise<{
  csv: string;
  /** Rows actually written to the file. Never the matched total. */
  count: number;
  /** Rows the filter matched, which is ≥ `count` whenever `truncated`. */
  matchedCount: number;
  /** True when the cap dropped rows. `matchedCount` then exceeds `count`. */
  truncated: boolean;
  error?: string;
  /** Set when the CSV was produced but its audit record could not be kept. */
  warning?: string;
}> {
  const admin = await requireCRMAdmin();
  const { adminClient } = admin;
  const filters = resolveFilters(params);
  const auditExport = (
    outcome: 'success' | 'failure',
    counts: { count: number; matchedCount: number; truncated: boolean },
    error?: string
  ) =>
    recordCRMAudit(admin, {
      action: 'crm.contacts.export',
      targetType: 'crm_operation',
      targetId: 'crm-export',
      targetLabel: 'Constituent CSV export',
      outcome,
      error: error ?? null,
      metadata: {
        format: 'csv',
        filters: auditExportFilters(filters, params.consent),
        exported_count: counts.count,
        matched_count: counts.matchedCount,
        truncated: counts.truncated,
      },
    });
  /*
   * The full filtered set, not just the visible page — but capped, because a
   * chapter with tens of thousands of rows would otherwise hold the whole
   * directory in the Next server's memory to build one string.
   *
   * The cap is only defensible because it is *reported*. `range(0, 9999)` used to
   * truncate with nothing on screen saying so, and this file is the one artefact
   * that leaves the building: it looks like a complete backup, it re-imports
   * cleanly, and it is missing rows. Nothing in the CSV, the toast or the
   * filename would have said so, so the failure would surface at restore time —
   * weeks later, to a volunteer, with no way to know what is absent.
   *
   * `matchedCount` comes from `fetchContactPage`'s `totalCount`, which is the
   * filter's own count and not the rows read. That distinction is the whole
   * point: a `truncated` flag whose number is derived from the same read as
   * `count` could not detect its own truncation.
   */
  const result = await fetchContactPage(adminClient, filters, 1, CRM_EXPORT_LIMIT);
  if (result.error) {
    await auditExport('failure', { count: 0, matchedCount: 0, truncated: false }, result.error);
    return { csv: '', count: 0, matchedCount: 0, truncated: false, error: result.error };
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
    'Unsubscribed At',
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
      /*
       * Tri-state, and the export is where it has to survive.
       *
       * `c.do_not_email ? 'yes' : 'no'` wrote `no` for a null row, and re-importing
       * that file would have converted every "never asked" constituent into an
       * explicit yes — a backup and restore cycle silently enrolling people in
       * broadcast mail. The importer reads a blank cell as null, so the blank here
       * is the round-trip.
       */
      c.do_not_email === null ? '' : c.do_not_email ? 'yes' : 'no',
      c.total_donated_cents,
      c.source || '',
      c.created_at,
      c.unsubscribed_at || '',
    ])
  );
  const matchedCount = result.totalCount;
  const counts = {
    csv: [header, ...lines].join('\r\n'),
    count: result.contacts.length,
    matchedCount,
    // `contacts.length === totalCount` is the untruncated case. Comparing the
    // read against the count rather than against the constant is what makes this
    // correct if the cap is ever raised: two rows short of the cap is not
    // truncated, and only the mismatch knows the difference.
    truncated: result.contacts.length < matchedCount,
  };
  const auditResult = await auditExport('success', counts);
  const warning = crmAuditLostWarning(auditResult, 'The export completed');
  return { ...counts, ...(warning ? { warning } : {}) };
}

const CONTACT_TASK_LIMIT = 50;

export async function getCRMContactDetail(
  id: string,
  activityPage = 1
): Promise<{
  contact: CRMContact;
  activities: CRMActivityWithDelivery[];
  /** The page of the timeline represented by `activities`, clamped to >= 1. */
  activityPage: number;
  activityPageSize: number;
  activityCount: number;
  tasks: CRMTask[];
  /** True when `tasks` was cut at `CONTACT_TASK_LIMIT`. */
  tasksTruncated: boolean;
  taskCount: number;
  /** Open tasks on record — the tab label counts open, not total. */
  openTaskCount: number;
}> {
  const { adminClient } = await requireCRMAdmin();
  const requestedPage = Number(activityPage);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const activityFrom = (page - 1) * CRM_CONTACT_TIMELINE_PAGE_SIZE;
  const activityTo = activityFrom + CRM_CONTACT_TIMELINE_PAGE_SIZE - 1;

  const [
    { data: contact, error: contactError },
    { data: activities, error: actError },
    { count: activityCount, error: countError },
    { data: tasks, error: taskError },
    { count: taskCount, error: taskCountError },
    { count: openTaskCount, error: openTaskCountError },
  ] = await Promise.all([
    adminClient.from('crm_contacts').select('*').eq('id', id).maybeSingle(),
    adminClient
      .from('crm_activities')
      .select('*')
      .eq('contact_id', id)
      // `created_at DESC` alone is not a total order: `crm_activities` is written
      // by trigger in batches, so ties are routine, and a non-unique sort key
      // makes offset paging return an arbitrary subset across calls.
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(activityFrom, activityTo),
    adminClient
      .from('crm_activities')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', id),
    adminClient
      .from('crm_tasks')
      .select('*')
      .eq('contact_id', id)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(CONTACT_TASK_LIMIT),
    // The activities panel beside this one already reports its true count with
    // a truncation flag; the tasks panel rendered the capped number as the
    // total instead. A contact with 80 open follow-ups read "Follow-ups (50)".
    adminClient.from('crm_tasks').select('*', { count: 'exact', head: true }).eq('contact_id', id),
    adminClient
      .from('crm_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', id)
      .eq('status', 'open'),
  ]);

  if (contactError) {
    throw new Error(`Failed to load contact: ${contactError.message}`);
  }
  if (!contact) {
    throw new Error('Contact not found');
  }

  if (actError) {
    throw new Error(`Failed to load contact activities: ${actError.message}`);
  }
  if (countError) {
    throw new Error(`Failed to count contact activities: ${countError.message}`);
  }
  if (taskError) {
    throw new Error(`Failed to load contact tasks: ${taskError.message}`);
  }
  if (taskCountError) {
    throw new Error(`Failed to count contact tasks: ${taskCountError.message}`);
  }
  if (openTaskCountError) {
    throw new Error(`Failed to count open contact tasks: ${openTaskCountError.message}`);
  }

  const activityRows = activities || [];
  const directSends = new Map<string, string | null>();
  for (const activity of activityRows) {
    if (activity.type !== 'email_sent') continue;
    const providerId = resendIdFromSnapshot(activity.metadata);
    // Activities are newest-first; keep the first sighting if a retry ever
    // produced two timeline rows for the same provider message.
    if (providerId && !directSends.has(providerId)) {
      directSends.set(providerId, activity.created_at);
    }
  }

  /*
   * Correlate the direct sends on this page with their Resend delivery events
   * in one query. The activity's provider id is the join key. A delivery read
   * failure must not take down the contact page: the send still happened, so
   * the timeline renders without the supplementary status rather than 404ing.
   */
  let activitiesWithDelivery: CRMActivityWithDelivery[] = activityRows;
  if (directSends.size > 0) {
    try {
      const deliveries = await getDirectEmailDeliveries(adminClient, {
        contactId: contact.id,
        providerIds: [...directSends.keys()],
        acceptedAtByProvider: directSends,
      });
      activitiesWithDelivery = activityRows.map((activity) => {
        if (activity.type !== 'email_sent') return activity;
        const providerId = resendIdFromSnapshot(activity.metadata);
        const delivery = providerId ? deliveries.get(providerId) : undefined;
        return delivery ? { ...activity, delivery } : activity;
      });
    } catch {
      // Delivery status is supplementary; keep the timeline usable.
    }
  }

  return {
    contact,
    activities: activitiesWithDelivery,
    activityPage: page,
    activityPageSize: CRM_CONTACT_TIMELINE_PAGE_SIZE,
    activityCount: activityCount ?? 0,
    tasks: tasks || [],
    taskCount: taskCount ?? 0,
    tasksTruncated: (taskCount ?? 0) > (tasks?.length ?? 0),
    openTaskCount: openTaskCount ?? 0,
  };
}

/**
 * Distinct tags across the directory — powers the filter and composer chips.
 *
 * This scans the whole table on every CRM page load, because Postgres cannot
 * return distinct array elements from a plain select and there is no RPC for it.
 * `.order('id')` is load-bearing rather than cosmetic: offset paging is coherent
 * only against a total order, and without it a row inserted mid-scan shifts the
 * boundary and a tag is read twice or not at all.
 *
 * Returns `{ tags, truncated, scanned }` rather than a bare array. The ceiling is
 * a resource limit on an unindexable scan, so a chapter large enough to hit it
 * would silently get a partial tag list — and a missing tag chip means a
 * constituent with that tag cannot be targeted at all, with nothing on screen
 * saying so. Making the return type carry the flag means neither call site can
 * forget to check.
 */
export async function getCRMExistingTags(): Promise<CRMTagScan> {
  // Authorize first, outside any cache. A server action is callable by anyone
  // who can POST to it, so the check has to run on every call; only the data
  // behind it is cached. See `getCachedCRMTags` for why the two are separate.
  await requireCRMAdmin();
  return getCachedCRMTags();
}
