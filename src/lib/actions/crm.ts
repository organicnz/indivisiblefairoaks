'use server';

import { cacheLife, cacheTag, revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import {
  BROADCAST_RECIPIENT_CEILING,
  broadcastSubject,
  buildBroadcastEmail,
} from '@/lib/crm-broadcast';
import type { ConsentState } from '@/lib/crm-filters';
import { isInAudience, splitActiveValues } from '@/lib/crm-filters';
import {
  type CRMImportError,
  MAX_CONTACT_NOTES_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_CONTACT,
  normalizeTags,
  parseCRMImportCsv,
  TAG_PATTERN,
  toCsvRow,
} from '@/lib/crm-import';
import {
  BROADCAST_DISPATCH_TIMEOUT_MS,
  BROADCAST_HISTORY_MAX_PAGE_SIZE,
  BROADCAST_HISTORY_PAGE_SIZE,
  CRM_EXPORT_LIMIT,
  TAG_SCAN_LIMIT,
} from '@/lib/crm-limits';
import { isE2EMode } from '@/lib/e2e-mode';
import { brandShell, escapeHtml, LOGO_URL, safeSubject, sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import type { Database } from '@/types/supabase';

export type CRMContact = Database['public']['Tables']['crm_contacts']['Row'];
export type CRMContactInsert = Database['public']['Tables']['crm_contacts']['Insert'];
export type CRMContactUpdate = Database['public']['Tables']['crm_contacts']['Update'];
export type CRMActivity = Database['public']['Tables']['crm_activities']['Row'];
/**
 * A campaign row.
 *
 * `marked_failed_at` / `marked_failed_by` arrive with migration 20261005000000
 * and are intersected in for the same reason as `CRMSegment` below: the generated
 * types come from the live project, so they do not know a column until the
 * migration carrying it has been applied. The composer reads `marked_failed_at`
 * to decide whether a stranded row still needs clearing, so it is not optional.
 */
export type CRMBroadcast = Database['public']['Tables']['crm_broadcasts']['Row'] & {
  marked_failed_at?: string | null;
  marked_failed_by?: string | null;
};
export type CRMTask = Database['public']['Tables']['crm_tasks']['Row'];
/**
 * A saved filter.
 *
 * The `consent` intersection used to live here because the generated row type
 * did not know the column until its migration was applied. Migration
 * 20261005000000 is applied and the types regenerated, so the row carries
 * `consent: string | null` itself and the shim — which narrowed it to the
 * literal union and broke the read path — is gone.
 */
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
  // Bounded, unlike before. An arbitrarily large blob reached `crm_contacts.notes`
  // from three directions at once — this schema, the CSV importer, and an editor
  // textarea with no `maxLength` — and it is rendered in the 360 panel *and*
  // emitted in every CSV export of the directory. `taskSchema` caps `details` at
  // 2000 for comparison; a free-text organizer note does not need more than the
  // importer's own row limit.
  notes: z.string().max(MAX_CONTACT_NOTES_LENGTH).nullable().optional(),
  /**
   * The version this edit was based on — the `updated_at` the editor was opened
   * with. Optional, so an existing caller without it keeps the old behaviour, but
   * the editor always sends it and it is what turns two organizers editing one
   * contact from last-write-wins into a reported conflict.
   */
  updated_at: z.string().nullable().optional(),
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

/**
 * A reusable filter. `consent` is a first-class member, not a spare column:
 * "everyone who opted out" is the audit a chapter most often needs to repeat,
 * and while the field was absent an opt-out filter could be applied but not
 * saved — so the only way to re-run it was to remember the dropdown.
 */
/** Shape of the `.select('id').single()` result both segment writes return. */
type SegmentWriteResult = {
  data: { id: string } | null;
  error: { message: string; code?: string } | null;
};

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
  /*
   * All three states, so "everyone we have never asked" is a segment you can
   * save and re-run. It was two when this field was added, which meant the audit
   * a chapter most often wants — who is in the audience without ever having said
   * yes — could be produced on screen but not kept.
   */
  consent: z.enum(['opted_out', 'opted_in', 'unasked']).optional(),
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
      .select('id, email, first_name, last_name, unsubscribe_token, do_not_email')
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
    /*
     * Defense in depth, not redundancy. The query above already carries
     * `.eq('do_not_email', false)` — the SQL expression of `isInAudience()`.
     * This filter is the row expression of the same rule, and it is what holds
     * the invariant if anyone ever loosens the query: without it, dropping the
     * predicate silently re-adds every opted-out and never-asked contact to the
     * audience, with no error and no test noticing (the mock serves whatever
     * rows it is given). `isInAudience` is "the rule every send path depends
     * on, expressed once" — this is the once, used. `do_not_email` is selected
     * for exactly this filter; removing it from the select turns the filter
     * into a pass-through.
     */
    recipients.push(
      ...(data as (BroadcastRecipient & { do_not_email: boolean | null })[]).filter((r) =>
        isInAudience(r.do_not_email)
      )
    );
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
  revalidateTag('crm-tags', 'hours');
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
  /** Consent audit: opt-outs, opt-ins, and the never-asked third state. */
  consent?: ConsentState;
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
    doNotEmail:
      consent === 'opted_out'
        ? true
        : consent === 'opted_in'
          ? false
          : consent === 'unasked'
            ? null
            : undefined,
  };
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

export async function exportCRMContacts(params: GetCRMContactsParams = {}): Promise<{
  csv: string;
  /** Rows actually written to the file. Never the matched total. */
  count: number;
  /** Rows the filter matched, which is ≥ `count` whenever `truncated`. */
  matchedCount: number;
  /** True when the cap dropped rows. `matchedCount` then exceeds `count`. */
  truncated: boolean;
  error?: string;
}> {
  const { adminClient } = await requireAdmin();
  const filters = resolveFilters(params);
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
  return {
    csv: [header, ...lines].join('\r\n'),
    count: result.contacts.length,
    matchedCount,
    // `contacts.length === totalCount` is the untruncated case. Comparing the
    // read against the count rather than against the constant is what makes this
    // correct if the cap is ever raised: two rows short of the cap is not
    // truncated, and only the mismatch knows the difference.
    truncated: result.contacts.length < matchedCount,
  };
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
    .order('id', { ascending: false })
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
    .order('id', { ascending: false })
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

/**
 * Saved segments, newest first — with the true total alongside.
 *
 * The read used to be `.limit(50)` with no count and no pager, so a chapter
 * past 50 saved segments silently lost the oldest. And since the directory only
 * lists what this returns, an unreachable segment was also undeletable: no UI
 * path could reach its delete control. That is precisely the failure the docs
 * claim was fixed for drafts; it was not carried to segments.
 *
 * Segments grow one row per deliberate save — not per campaign, per contact,
 * or per import — so the honest fix is a cap high enough to never bind (500)
 * with a truncation flag, rather than a pager for a list nobody pages. If the
 * flag ever fires, that is the signal to build the pager, not to raise the cap
 * again.
 */
const SEGMENT_LIMIT = 500;

export async function getCRMSegments(): Promise<{ segments: CRMSegment[]; truncated: boolean }> {
  const { adminClient } = await requireAdmin();
  const { data, error, count } = await adminClient
    .from('crm_segments')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(SEGMENT_LIMIT);
  if (error) throw new Error(`Failed to load segments: ${error.message}`);
  return { segments: data || [], truncated: (count ?? 0) > (data?.length ?? 0) };
}

export async function saveCRMSegment(
  rawInput: z.input<typeof segmentSchema>
): Promise<{ success: boolean; segmentId?: string; error?: string }> {
  const { adminClient } = await requireAdmin();
  const parsed = segmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { id, name, query, statuses, districts, tags, consent } = parsed.data;
  const row = {
    name: name.trim(),
    query,
    statuses,
    districts,
    tags,
    // Written as SQL NULL rather than omitted, so clearing a segment's consent
    // filter on edit actually clears it. Omitting the key would leave the
    // previous value in place on an UPDATE.
    consent: consent ?? null,
  };

  /*
    Cast for the same reason as `CRMSegment` above: the generated row type does
    not know `consent` until migration 20261005000000 has been applied to the
    project the types were derived from. The value is written as SQL NULL, not
    omitted — omitting the key would leave the previous consent filter in place
    when a segment's filter is cleared, which is the edit the field exists for.
  */
  const segments = adminClient as unknown as {
    from: (table: 'crm_segments') => {
      update: (values: typeof row) => {
        eq: (
          col: string,
          value: string
        ) => {
          select: (cols: string) => {
            single: () => Promise<SegmentWriteResult>;
          };
        };
      };
      insert: (values: typeof row) => {
        select: (cols: string) => {
          single: () => Promise<SegmentWriteResult>;
        };
      };
    };
  };

  if (id) {
    const { data, error } = await segments
      .from('crm_segments')
      .update(row)
      .eq('id', id)
      .select('id')
      .single();
    if (error) return { success: false, error: error.message };
    // Belt and braces: a concurrent delete between the read and the write matches
    // no row, which `.single()` reports as an error — but a defensive check here
    // costs nothing and the alternative is `data.id` on a null.
    if (!data) return { success: false, error: 'That segment no longer exists' };
    revalidateCRMRoutes();
    return { success: true, segmentId: data.id };
  }

  const { data, error } = await segments.from('crm_segments').insert(row).select('id').single();
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A segment with that name already exists' };
    }
    return { success: false, error: error.message };
  }
  if (!data) return { success: false, error: 'The segment could not be created' };
  revalidateCRMRoutes();
  return { success: true, segmentId: data.id };
}

export async function deleteCRMSegment(id: string): Promise<{ success: boolean; error?: string }> {
  const { adminClient } = await requireAdmin();
  const { data, error } = await adminClient
    .from('crm_segments')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Segment not found' };
  revalidateCRMRoutes();
  return { success: true };
}

/**
 * How many timeline entries one contact's 360 shows.
 *
 * The read was unbounded, and `CRMDetailClient` rendered every row it got. A
 * recipient of one 5,000-recipient broadcast therefore had 5,000 timeline
 * entries on their profile page: no pagination, no cap, and a payload that
 * grows with the chapter's largest campaign rather than with the contact. Tasks
 * beside it were already capped at 50, so the two panels of the same view had
 * opposite bounds and nobody noticed, because the tasks panel behaved.
 *
 * `exact` because the panel needs the true total to say "showing 50 of 5,000"
 * rather than implying the list ended.
 */
const CONTACT_ACTIVITY_LIMIT = 50;

const CONTACT_TASK_LIMIT = 50;

export async function getCRMContactDetail(id: string): Promise<{
  contact: CRMContact;
  activities: CRMActivity[];
  /** True when `activities` was cut at `CONTACT_ACTIVITY_LIMIT`. */
  activitiesTruncated: boolean;
  activityCount: number;
  tasks: CRMTask[];
  /** True when `tasks` was cut at `CONTACT_TASK_LIMIT`. */
  tasksTruncated: boolean;
  taskCount: number;
  /** Open tasks on record — the tab label counts open, not total. */
  openTaskCount: number;
}> {
  const { adminClient } = await requireAdmin();

  const [
    { data: contact, error: contactError },
    { data: activities, error: actError },
    { count: activityCount, error: countError },
    { data: tasks, error: taskError },
    { count: taskCount, error: taskCountError },
    { count: openTaskCount, error: openTaskCountError },
  ] = await Promise.all([
    adminClient.from('crm_contacts').select('*').eq('id', id).single(),
    adminClient
      .from('crm_activities')
      .select('*')
      .eq('contact_id', id)
      // `created_at DESC` alone is not a total order: `crm_activities` is written
      // by trigger in batches, so ties are routine, and a non-unique sort key
      // makes `.limit()` return an arbitrary subset across calls.
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(CONTACT_ACTIVITY_LIMIT),
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

  if (contactError || !contact) {
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

  return {
    contact,
    activities: activities || [],
    activityCount: activityCount ?? 0,
    activitiesTruncated: (activityCount ?? 0) > (activities?.length ?? 0),
    tasks: tasks || [],
    taskCount: taskCount ?? 0,
    tasksTruncated: (taskCount ?? 0) > (tasks?.length ?? 0),
    openTaskCount: openTaskCount ?? 0,
  };
}

export type SaveCRMContactResult = {
  success: boolean;
  contactId?: string;
  error?: string;
  /**
   * Why the save was refused. `conflict` is the optimistic-concurrency refusal —
   * a colleague saved the same contact while this form was open — and the editor
   * needs it to say something other than "failed to save".
   */
  reason?: 'conflict';
  /**
   * The row's new `updated_at`, written by the `touch_updated_at` trigger. The
   * editor adopts it so its next save is based on the database's version rather
   * than on a timestamp its own clock produced.
   */
  updatedAt?: string | null;
};

export async function saveCRMContact(
  rawInput: z.input<typeof contactSchema>
): Promise<SaveCRMContactResult> {
  const { adminClient, adminUserId } = await requireAdmin();

  const parsed = contactSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { id, ...data } = parsed.data;
  const normalizedEmail = data.email.trim().toLowerCase();

  if (id) {
    /*
      Optimistic concurrency, mirroring `saveContent`'s `expectedUpdatedAt`.

      The read-then-update here was last-write-wins with no signal: two organizers
      editing one contact both read, both wrote, and the second silently discarded
      the first's changes. That is the default outcome of the one surface whose
      purpose is to look after other people's data, and `saveContent` fixed the
      identical problem for CMS pages while the CRM kept it.

      The precondition rides on the UPDATE rather than on a SELECT-then-UPDATE,
      which would leave a window in which a colleague's save still lands between
      the check and the write. `crm_contacts.updated_at` is maintained by the
      `touch_updated_at` trigger (migration 20260930140000), so the value the
      editor sends back is the database's, not a second clock's.

      A null claim uses `.is()`, never `.eq()`: `.eq('updated_at', null)` is
      `col=eq.null` in PostgREST and matches nothing, so the guard would fire
      against every untouched row. Same trap `saveContent`'s version precondition
      documents, and the reason it is written down at all.
    */
    const expectedUpdatedAt = data.updated_at ?? null;

    const { data: previous, error: previousError } = await adminClient
      .from('crm_contacts')
      .select('status, email, tags, notes, updated_at')
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

    // `updated_at` is deliberately *not* in this payload. It is the expected
    // version, not the new one: writing it back would overwrite the value the
    // `touch_updated_at` trigger is about to write with the stale one, which makes
    // the next save by anyone conflict with itself. The trigger owns the column.
    // (`id` was already destructured out of `data` above.)
    const { updated_at: _expected, ...writable } = data;
    const updatePayload: CRMContactUpdate = {
      ...writable,
      email: normalizedEmail,
    };

    // `.maybeSingle()`, not `.single()`. `.single()` turns "matched no row" into
    // a PGRST116 *error*, which is indistinguishable from a genuine failure — and
    // a conflict reported as "JSON object requested, multiple (or no) rows
    // returned" tells the volunteer nothing about the two-organizers case this
    // guard exists for. `maybeSingle()` resolves `{ data: null }` for zero rows,
    // which is the one shape that means exactly that.
    let updateQuery = adminClient.from('crm_contacts').update(updatePayload).eq('id', id);
    if (expectedUpdatedAt) updateQuery = updateQuery.eq('updated_at', expectedUpdatedAt);
    else updateQuery = updateQuery.is('updated_at', null);

    const { data: updated, error } = await updateQuery.select('id').maybeSingle();

    // The read above already proved the row exists, so "matched no row" here can
    // only mean the precondition failed — somebody else saved in between. That is
    // the conflict. Anything else is a real failure and reported as one.
    if (!error && !updated) {
      return {
        success: false,
        error:
          'Someone else saved this contact while you were editing. Reload to see their changes, then re-apply yours.',
        reason: 'conflict',
      };
    }
    if (error) return { success: false, error: error.message };
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
    // The new version, so the editor's next save is based on what the trigger
    // just wrote rather than on the timestamp it arrived with.
    const { data: fresh } = await adminClient
      .from('crm_contacts')
      .select('updated_at')
      .eq('id', id)
      .single();
    return { success: true, contactId: updated.id, updatedAt: fresh?.updated_at ?? null };
  }

  // Insert new contact. `updated_at` is dropped for the same reason as the update
  // path: it is the precondition, not a value, and the column is maintained by
  // `touch_updated_at`.
  const { updated_at: _expected, ...insertable } = data;
  const { data: created, error } = await adminClient
    .from('crm_contacts')
    .insert({
      ...insertable,
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

/**
 * An admin's decision about one contact's email consent.
 *
 * Three values because the column stores three (migration 20261005020000), and
 * the middle one is the point: `'unasked'` records "we have never put this to
 * them", which is a true statement about the relationship and not a synonym for
 * a yes.
 *
 * Reachable from the 360 panel. Before this it was a boolean toggle, so an
 * organiser could mark somebody opted out or opted in but had no way to say
 * "unknown" — and the nearest thing they could do, clearing the flag, recorded a
 * *yes* they had not been given.
 */
export type ConsentDecision = 'opted_out' | 'opted_in' | 'unasked';

export async function setCRMEmailConsent({
  contactId,
  doNotEmail,
}: {
  contactId: string;
  doNotEmail: ConsentDecision;
}): Promise<{ success: boolean; error?: string }> {
  const { adminClient, adminUserId } = await requireAdmin();
  const now = new Date().toISOString();

  const storedValue = doNotEmail === 'unasked' ? null : doNotEmail === 'opted_out';

  /*
    Cast, because `src/types/supabase.ts` is generated from the live project and
    types `do_not_email` as `boolean` until migration 20261005020000 has been
    applied. The `CRMContactUpdate` shape is spelled out here rather than left to
    inference so a future removal of the cast fails on the *value*, not silently
    on the type.
  */
  const consentPayload = {
    do_not_email: storedValue,
    /*
     * The timestamp follows the consent rather than being cleared on any
     * non-opt-out. Restoring consent is not the same as erasing the evidence
     * that somebody once unsubscribed, and an organiser reading this profile
     * six months later is better served by a date than by a blank. The
     * unsubscribe route keeps its own behaviour — it is the only thing that
     * creates one.
     */
    ...(doNotEmail === 'opted_out' ? { unsubscribed_at: now } : {}),
    updated_at: now,
  } as CRMContactUpdate;

  const { error } = await adminClient
    .from('crm_contacts')
    .update(consentPayload)
    .eq('id', contactId);

  if (error) return { success: false, error: error.message };

  const ACTIVITY: Record<ConsentDecision, { title: string; description: string }> = {
    opted_out: {
      title: 'Email Consent Revoked',
      description: 'Marked do-not-email — excluded from all broadcasts.',
    },
    opted_in: {
      title: 'Email Consent Restored',
      description: 'Re-subscribed for chapter email broadcasts.',
    },
    unasked: {
      title: 'Email Consent Marked Unknown',
      description:
        'Consent reset to "never asked" — excluded from broadcasts until this person opts in.',
    },
  };

  await adminClient.from('crm_activities').insert({
    contact_id: contactId,
    type: 'note',
    ...ACTIVITY[doNotEmail],
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
      .or(orFilter)
      // Bounded by construction — the chunk holds 50 emails and `email` is
      // unique — but stated rather than implied, so a later chunk-size change
      // cannot silently unbound it.
      .limit(LOOKUP_CHUNK);
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
      //
      // `null` is carried too, not flattened to `false`: a restore has to
      // preserve "never asked", or the second round-trip of the same file
      // enrols everybody who was never asked.
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
    // The generated `Insert` type says `do_not_email?: boolean` until migration
    // 20261005020000 is applied; the value genuinely is `boolean | null` now, and
    // the column is nullable in the database the moment it lands. Casting the
    // payload rather than the client keeps the rest of the chain typed.
    const payload = chunk as unknown as CRMContactInsert[];
    const { data: created, error } = await adminClient
      .from('crm_contacts')
      .insert(payload)
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

  /*
    Four statements, previously with no transaction and no lock.

    A failure at step three or four left the duplicate alive with its activities
    and tasks already re-pointed at the survivor: a double-counted timeline, the
    same follow-up appearing twice on the board, and an error message naming only
    the step that happened to fail. Two concurrent merges of the same pair both
    read, both wrote, and both added `total_donated_cents` — so the survivor's
    giving total was inflated by one copy.

    `rpc('merge_crm_contacts', …)` runs the whole thing inside the database as
    one statement, so it either commits or it does not, and it takes the survivor
    row `FOR UPDATE` first so a concurrent merge of the same pair serialises
    behind it and then reads the already-merged state. See migration
    20261005030000_merge_crm_contacts.sql.

    The RPC is `SECURITY DEFINER` and service-role-only; `requireAdmin()` above is
    the actual authorization boundary, exactly as for every other action here.
    The RLS policies remain as defence in depth for any future direct client path.
  */
  // Cast, because `src/types/supabase.ts` is generated from the live project and
  // does not list the RPC until migration 20261005030000 has been applied. The
  // signature is declared here rather than left to inference so the parameters
  // are checked at this call site; remove the cast when the types are
  // regenerated against a database that has it.
  const rpc = adminClient as unknown as {
    rpc: (
      fn: 'merge_crm_contacts',
      args: { p_keep_id: string; p_remove_id: string; p_actor_id: string | null }
    ) => Promise<{ error: { message: string } | null }>;
  };
  const { error: mergeError } = await rpc.rpc('merge_crm_contacts', {
    p_keep_id: keepId,
    p_remove_id: removeId,
    p_actor_id: adminUserId,
  });

  if (mergeError) {
    return { success: false, error: `Merge failed: ${mergeError.message}` };
  }

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

  /*
   * `!== false`, not truthiness. `do_not_email` is tri-state since the consent
   * migration: `false` means the contact agreed, `true` means they opted out,
   * and `NULL` means they were never asked. `NULL` is falsy in JS, so a
   * truthiness test mails every contact whose record says "never asked" — which
   * is exactly what profile signups and store orders produce. Every other send
   * path uses `IS FALSE` (`resolveBroadcastRecipients`, the Edge Function, the
   * recipient count); this was the sole exception, and the UI agreed with it.
   */
  if (contact.do_not_email !== false) {
    return {
      success: false,
      error:
        contact.do_not_email === true
          ? 'Contact has unsubscribed — email sending is blocked'
          : 'No consent on file for this contact — email sending is blocked until they opt in',
    };
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

// `PROGRESS_POLL_TIMEOUT_MS` and the other numeric bounds live in
// `@/lib/crm-limits`, not here: this is a `'use server'` module, and Next rejects
// any non-async export from one — including a constant a client component needs.

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
    // `failed_count` is the unsent remainder, matching `markCRMBroadcastFailed`.
    // Without it the row reads "N recipients, none accepted, none rejected"
    // rather than "nothing was attempted" — and nothing was.
    await adminClient
      .from('crm_broadcasts')
      .update({
        status: 'failed',
        sent_at: new Date().toISOString(),
        failed_count: recipients.length,
      })
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
      .update({ status: 'failed', sent_at: new Date().toISOString(), failed_count: 1 })
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
/**
 * Declare a stranded campaign failed, by hand.
 *
 * `docs/crm-operations.md` documents the recovery for a row stuck at `sending`
 * as "send a new, narrower broadcast" and is emphatic that the stuck row must not
 * be re-dispatched — clearing `dispatched_at` re-sends to everyone already
 * delivered to. That guidance is correct and was unactionable from the UI: the
 * composer had no control that could mark a row failed, so two organizers staring
 * at a stuck campaign had to choose between doing nothing and editing the
 * database by hand.
 *
 * Deliberately one-directional. It can only move a row to `failed`, never back to
 * a sendable state, because the one irreversible mistake available here is
 * restarting a campaign. It refuses on a row the sender still owns (`queued` or
 * `sending` with a live `dispatched_at` inside the dispatch window), so it cannot
 * be used to cut short a send that is merely slow.
 *
 * `marked_failed_at` / `marked_failed_by` are written rather than `status` alone,
 * so the record distinguishes "the sender reported failure" from "an organizer
 * decided this one was stuck" — a distinction that matters when reading a history
 * row six months later.
 */
export async function markCRMBroadcastFailed(
  broadcastId: string
): Promise<{ success: boolean; error?: string }> {
  const { adminClient, adminUserId } = await requireAdmin();

  const { data: existing, error: readError } = await adminClient
    .from('crm_broadcasts')
    .select('id, subject, status, sent_count, recipient_count, dispatched_at, test_only')
    .eq('id', broadcastId)
    .maybeSingle();

  if (readError) return { success: false, error: readError.message };
  if (!existing) return { success: false, error: 'That campaign no longer exists' };

  /*
   * The composer hides this control for `test_only` rows, but hiding is not a
   * boundary — the action is. A preview stranded at `sending` is a stuck
   * preview, not a stuck campaign, and marking it failed writes an organizer's
   * fingerprints onto a row whose only reader is the sender's own poll loop.
   */
  if (existing.test_only) {
    return {
      success: false,
      error: 'This is a preview, not a campaign — re-send the test instead.',
    };
  }

  if (existing.status === 'sent' || existing.status === 'failed') {
    return {
      success: false,
      error: `This campaign already finished as "${existing.status}" — nothing to clear.`,
    };
  }
  if (existing.status === 'draft') {
    return {
      success: false,
      error: 'This is an unsent draft, not a stuck campaign. Discard it instead.',
    };
  }

  // A row dispatched recently is assumed healthy: 5,000 recipients at ten per
  // round trip is a long send, and "fail" here would mark a working campaign dead.
  const dispatchedAt = existing.dispatched_at ? Date.parse(existing.dispatched_at) : null;
  if (
    dispatchedAt !== null &&
    !Number.isNaN(dispatchedAt) &&
    Date.now() - dispatchedAt < BROADCAST_DISPATCH_TIMEOUT_MS
  ) {
    return {
      success: false,
      error:
        'This campaign was dispatched less than 15 minutes ago and may still be delivering. Only use this for a send that is genuinely stuck.',
    };
  }

  // Cast for the same reason as `CRMSegment`: `marked_failed_at` and
  // `marked_failed_by` arrive with migration 20261005000000 and are absent from
  // the generated row type until that migration has been applied to the project
  // the types came from. `failed_count` is the arithmetic that matters — the
  // undelivered remainder, so the history row's two counts still reconcile.
  const broadcasts = adminClient as unknown as {
    from: (table: 'crm_broadcasts') => {
      update: (values: Record<string, unknown>) => {
        eq: (
          col: string,
          value: string
        ) => {
          in: (
            col: string,
            values: string[]
          ) => {
            select: (cols: string) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    };
  };
  /*
   * The status predicate is the write, not the read above. The guard was
   * evaluated on a read, but this update matched on `.eq('id', …)` alone — so
   * a sender `finish()` landing between the two turned a campaign that reached
   * every recipient into `failed` with `failed_count = 0`. The docs' "refuses a
   * row already sent or failed" held at read time only. Scoping the write to
   * the still-stranded states makes the refusal atomic: zero rows matched means
   * the campaign finished while the organizer was deciding, and nothing is
   * changed.
   */
  const { data: marked, error } = await broadcasts
    .from('crm_broadcasts')
    .update({
      status: 'failed',
      failed_count: Math.max((existing.recipient_count ?? 0) - (existing.sent_count ?? 0), 0),
      marked_failed_at: new Date().toISOString(),
      marked_failed_by: adminUserId,
    })
    .eq('id', broadcastId)
    .in('status', ['queued', 'sending'])
    .select('id')
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!marked)
    return {
      success: false,
      error: 'That campaign finished while you were deciding — nothing was changed.',
    };

  revalidateCRMRoutes();
  return { success: true };
}

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

  // Pre-flight: probe the health endpoint (no auth required) before sending.
  // A missing RESEND_API_KEY or APP_URL will surface here as a clear
  // configuration error rather than a failed broadcast row.
  try {
    const healthRes = await fetch(`${functionUrl}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (healthRes.ok) {
      const health = (await healthRes.json()) as { ready: boolean; missing?: string[] };
      if (health.ready === false) {
        const missing = Array.isArray(health.missing) ? health.missing : [];
        return {
          ok: false,
          error: `broadcast sender is missing required secrets: ${missing.join(', ')}`,
        };
      }
    }
    // A non-ok response (e.g. network error or unexpected status) is inconclusive;
    // proceed with the actual dispatch.
  } catch {
    // Network error on the health probe is inconclusive; proceed.
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
      // Bounded, like every other outbound call in the app. `sendEmail` uses
      // `AbortSignal.timeout(SEND_TIMEOUT_MS)` and the contact form uses 8s;
      // this one had nothing, so a hung Edge Function hung the server action —
      // the composer's button stayed disabled indefinitely, the row stayed
      // `queued`, and there was no failure and no message. A timeout turns that
      // into the reportable failure the caller already knows how to handle
      // (it marks the row failed and names the reason).
      signal: AbortSignal.timeout(BROADCAST_DISPATCH_TIMEOUT_MS),
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
 *
 * The read these two comments used to sit on is gone. It was `.limit(25)` with no
 * offset, and the composer called it while `getCRMBroadcastHistoryPage` sat unused
 * — so a chapter past twenty-five campaigns could not see, or even confirm the
 * existence of, its own history, and the heading rendered the rows read so it read
 * as a complete list. A second unpaged history read is the shape of that bug
 * returning, so it was removed rather than left for a caller to find. Anything that
 * wants "the recent campaigns" calls
 * `getCRMBroadcastHistoryPage({ page: 1 })` and uses its `totalCount`.
 */

/*
 * One page of campaign history.
 *
 * The read was `.limit(50)` with no offset, no count and no pager, so a chapter
 * past fifty campaigns could not see its fifty-first — the failure mode
 * `deleteCRMBroadcastDraft`'s own comment describes for drafts, where an
 * unreachable row could not even be deleted. The count comes back so the
 * composer can say how many campaigns exist rather than implying the list ends.
 */
export async function getCRMBroadcastHistoryPage({
  page = 1,
  pageSize = BROADCAST_HISTORY_PAGE_SIZE,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<{ broadcasts: CRMBroadcast[]; totalCount: number; page: number }> {
  const { adminClient } = await requireAdmin();
  /*
   * Clamped, and the NaN case is the one that actually bites.
   *
   * `Math.max(1, Math.trunc(NaN))` is `NaN`, not 1 — `Math.trunc` and `Math.max`
   * both propagate NaN. So `?page=abc` produced `from = NaN`, `range(NaN, NaN)`,
   * and a history that rendered as empty. An empty history is the single most
   * misleading thing this page can show: it reads as "you have never sent a
   * campaign", and an organizer who was told their history had vanished would
   * reasonably go looking for the bug in their own account rather than in a URL.
   *
   * `Number.isFinite` first, then clamp. The page does its own parse, but this is
   * a `'use server'` boundary — it is callable directly, not only through the page.
   */
  const size = Math.min(
    Math.max(1, Number.isFinite(pageSize) ? Math.trunc(pageSize) : BROADCAST_HISTORY_PAGE_SIZE),
    BROADCAST_HISTORY_MAX_PAGE_SIZE
  );
  const current = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const from = (current - 1) * size;

  const { data, error, count } = await adminClient
    .from('crm_broadcasts')
    .select('*', { count: 'exact' })
    .neq('status', 'draft')
    // Offset paging needs a total order, and `created_at` ties across a batch of
    // self-tests sent in the same second. `id` breaks it.
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + size - 1);

  if (error) {
    throw new Error(`Failed to fetch broadcast history: ${error.message}`);
  }

  return { broadcasts: data || [], totalCount: count ?? 0, page: current };
}

/** Unsent work in progress, newest first. Resumable, and removable. */
export async function getCRMBroadcastDrafts(): Promise<CRMBroadcast[]> {
  const { adminClient } = await requireAdmin();
  // No `count: 'exact'` here, unlike the history read. A count is a second
  // thing to keep honest on a bounded list whose count is not displayed; the
  // history read needs it because the pager renders "page 3 of 30".
  const { data, error } = await adminClient
    .from('crm_broadcasts')
    .select('*')
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })
    // `id` breaks `updated_at` ties. Two drafts saved in the same millisecond is
    // not exotic — the button debounces, and a double-click lands both — and
    // without a total order the resumable draft can be whichever row the planner
    // returned first.
    .order('id', { ascending: false })
    .limit(BROADCAST_HISTORY_PAGE_SIZE);

  if (error) {
    throw new Error(`Failed to fetch broadcast drafts: ${error.message}`);
  }

  return data || [];
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
export async function getCRMExistingTags(): Promise<{
  tags: string[];
  /**
   * True when the ceiling stopped the scan, so `tags` may be incomplete.
   *
   * Distinct in meaning from a hidden tag in the composer: the 40-chip cap hides
   * a tag that *was* read and is selectable by typing, whereas this hides a tag
   * that was never read at all and cannot be found by any means.
   */
  truncated: boolean;
  /** Rows actually read. Compare against the ceiling to tell. */
  scanned: number;
}> {
  'use cache';
  cacheLife('hours');
  cacheTag('crm-tags');
  const { adminClient } = await requireAdmin();
  const tags = new Set<string>();
  const PAGE = 1000;
  let scanned = 0;
  let exhausted = false;

  for (let offset = 0; offset < TAG_SCAN_LIMIT; offset += PAGE) {
    const { data, error } = await adminClient
      .from('crm_contacts')
      .select('tags')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) {
      throw new Error(`Failed to load tags: ${error.message}`);
    }
    // A short page is the only reliable "that was the last one" signal, and the
    // only thing that distinguishes "hit the ceiling" from "read everything".
    if (!data || data.length === 0) {
      exhausted = true;
      break;
    }
    for (const row of data) {
      for (const t of row.tags || []) {
        if (t) tags.add(t);
      }
    }
    scanned += data.length;
    // A short page means the table ended, which is what separates "hit the
    // ceiling" from "read everything". Without it the two are indistinguishable
    // and the flag below is always false — a warning that can never fire reads as
    // safety.
    if (data.length < PAGE) {
      exhausted = true;
      break;
    }
  }

  /*
   * If the scan stopped at the ceiling, some constituent's tags were never read,
   * and a tag that appears only there cannot be selected in the composer's chips.
   * The consequence is quiet and bad: a chapter sees no "canvasser" tag, concludes
   * nobody has it, and either campaigns to nobody or assumes the data is gone.
   *
   * Returning a sentinel rather than a bare `string[]` is what makes that visible
   * — the type changes from "the tags" to "the tags, possibly not all of them",
   * so the two call sites have to decide what to render.
   */
  const truncated = scanned >= TAG_SCAN_LIMIT && !exhausted;
  return { tags: [...tags].sort((a, b) => a.localeCompare(b)), truncated, scanned };
}

/**
 * The audience a broadcast would reach, and how many matching contacts are
 * excluded by consent.
 *
 * The exclusion number is the half the dispatch bar never showed: "opted-out
 * contacts are excluded automatically" told the author a rule, not a fact,
 * so a chapter that had quietly accumulated hundreds of opt-outs could mail
 * an audience a fraction the size it was expecting without noticing. Both
 * counts come from one target specification, so the two numbers reconcile.
 */
export async function getBroadcastRecipientCount({
  targetTags = [],
  targetStatus = [],
  targetDistricts = [],
}: {
  targetTags?: string[];
  targetStatus?: string[];
  targetDistricts?: string[];
}): Promise<{ count: number; excludedCount: number }> {
  const { adminClient } = await requireAdmin();

  targetTags = normalizeTags(targetTags);

  const targetQuery = () => {
    let qb = adminClient.from('crm_contacts').select('*', { count: 'exact', head: true });
    if (targetStatus.length > 0) {
      qb = qb.in('status', targetStatus);
    }
    if (targetDistricts.length > 0) {
      qb = qb.in('district', targetDistricts);
    }
    if (targetTags.length > 0) {
      qb = qb.contains('tags', targetTags);
    }
    return qb;
  };

  /*
  Two counts from one target specification, so `count + excludedCount` is every
  contact the audience rules matched — deliberately one specification, because
  the dispatch bar's claim is that the two reconcile, and two separately-built
  queries would be two chances to disagree.

  The audience is `.eq('do_not_email', false)`: an explicit yes. A NULL row was
  never asked and is not mailed. In SQL `col = false` is NULL for a null row and
  NULL is not true, so the nulls fall out of the audience without being named —
  which is a property of SQL rather than of this code, and the tests pin it.

  The exclusion is therefore the complement: `.not('do_not_email', 'is', false)`,
  i.e. `IS NOT FALSE`, which covers `true` **and** `NULL` in one query. It used to
  be `.eq('do_not_email', true)` alone, which was exact while the column was NOT
  NULL and stopped being exact the moment NULL became expressible: the bar would
  have said "0 excluded" while every never-asked contact was in fact being
  dropped, which is the one number an organiser would use to decide whether
  anything was silently missing.

  `.not(…, 'is', false)` and not `.neq('do_not_email', false)`. The two are
  opposites on a null row — `IS DISTINCT FROM` includes it, `<>` excludes it as
  UNKNOWN — and picking the wrong one turns this from an audit into a mail run.
  Two queries rather than three is also one fewer round trip on a count that runs
  on every chip click.
  */
  const [{ count, error }, { count: excluded, error: excludedError }] = await Promise.all([
    targetQuery().eq('do_not_email', false),
    targetQuery().not('do_not_email', 'is', false),
  ]);

  if (error) {
    throw new Error(`Failed to count broadcast recipients: ${error.message}`);
  }
  if (excludedError) {
    throw new Error(`Failed to count excluded recipients: ${excludedError.message}`);
  }

  return { count: count ?? 0, excludedCount: excluded ?? 0 };
}
