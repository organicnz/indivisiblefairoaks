import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import type { AdminAuditEntry, AdminAuditResult } from '@/lib/admin-audit';
import { recordAdminAudit } from '@/lib/admin-audit';
import { type AdminSession, requireAdmin } from '@/lib/admin-auth';
import { MAX_TAG_LENGTH, TAG_PATTERN } from '@/lib/crm-import';
import { isE2EMode } from '@/lib/e2e-mode';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';

/**
 * The shared boundary for every CRM server action.
 *
 * Domain modules own their queries and validation. Every CRM mutation is
 * required to enter through the same admin gate and record its audit through
 * `recordCRMAudit`; the wrapper supplies the actor and MFA fields so a new
 * action cannot quietly omit them.
 *
 * That is the requirement, not a claim about current coverage. `health.ts`
 * and `stats.ts` do not call it because both are read-only and have no
 * mutation to record. That is not a precedent for a new write path, and it
 * does not exempt storage-only mutations: `media.ts` audits its uploads and
 * deletes through the wrapper even though they never touch a PostgREST table.
 */
export type CRMAdminContext = AdminSession;
export type AdminClient = AdminSession['adminClient'];

/**
 * The common result envelope for CRM mutations.
 *
 * `T` keeps each action's own fields (ids, counts, warnings) while `success` and
 * `error` stay in one place. Reads that return data or throw do not use this
 * envelope; they are not mutation results.
 */
export type CRMResult<T extends object = object> = {
  success: boolean;
  error?: string;
  /**
   * Set when the mutation committed but a secondary record could not be
   * written. The change stands; callers show this after the success message.
   */
  warning?: string;
} & T;

export const CRM_AUDIT_LOST_DETAIL =
  'its audit record could not be written or queued. The admin audit log is incomplete — do not retry the change.';

/**
 * The warning for a mutation whose audit record is neither in the log nor in
 * the outbox. `successClause` names what committed, e.g. "The follow-up was
 * created". A queued record is durable and retried, so it is not a loss; the
 * outbox health page is where delivery delays are visible.
 */
export function crmAuditLostWarning(audit: AdminAuditResult, successClause: string): string | null {
  if (audit.ok || audit.queued) return null;
  return `${successClause}, but ${CRM_AUDIT_LOST_DETAIL}`;
}

/** End each independent warning as its own sentence before joining them. */
function asSentence(warning: string): string {
  return /[.!?]$/.test(warning) ? warning : `${warning}.`;
}

/**
 * Combine the independent warnings from one completed mutation. Callers show
 * the result once, after the success message, rather than dropping one warning
 * because another was also present.
 */
export function combineCRMWarnings(
  ...warnings: Array<string | null | undefined>
): string | undefined {
  const present = warnings.filter((warning): warning is string => Boolean(warning));
  return present.length > 0 ? present.map(asSentence).join(' ') : undefined;
}

/** The only way a CRM domain module should reach the admin client. */
export function requireCRMAdmin(): Promise<CRMAdminContext> {
  return requireAdmin();
}

/** Record a CRM mutation without repeating the actor fields at every call site. */
export function recordCRMAudit(
  admin: CRMAdminContext,
  entry: Omit<AdminAuditEntry, 'actorUserId' | 'actorEmail' | 'mfaLevel'>
): Promise<AdminAuditResult> {
  return recordAdminAudit(admin.adminClient, {
    ...entry,
    actorUserId: admin.adminUserId,
    actorEmail: admin.adminEmail,
    mfaLevel: admin.mfaLevel,
  });
}

/**
 * Tag shape is enforced identically on both write paths. The CSV importer already
 * normalised to lowercase and capped at 20 (see `splitTags` in crm-import.ts); without
 * the matching cap here, a hand-entered contact could carry 500 tags, which then
 * renders 500 options in the directory filter and floods the broadcast chip list.
 */
export const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TAG_LENGTH)
  .regex(TAG_PATTERN, 'Tags may not contain <, >, or commas');

export function unsubscribeUrl(token: string): string {
  return `${env.NEXT_PUBLIC_SITE_URL}/api/crm/unsubscribe?token=${token}`;
}

export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * PostgREST `.or()` filters are comma-separated `column.op.value` tuples and
 * use parentheses for grouping. Characters that appear inside those structural
 * positions must be stripped from the user value or the whole filter string
 * fails to parse (HTTP 400).
 */
export function escapeIlikeOrValue(value: string): string {
  return escapeIlike(value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim());
}

/**
 * Every CRM mutation invalidates the same set of reads: the KPI cards on the directory,
 * the directory itself, the follow-up board, and the contact 360 that owns the row.
 * Hand-listing these per action is how they drifted — toggling a task on the 360 page
 * revalidated the board but not the 360, so the tab it was toggled in stayed stale.
 *
 * Expire immediately, like the other write paths. A cacheLife profile here is
 * stale-while-revalidate: the tag is marked stale but stays fresh until the
 * profile's expiry, so the first request after a save renders the previous tag
 * chips and refreshes behind it.
 */
export function revalidateCRMRoutes(contactId?: string | null): void {
  revalidateTag('crm-tags', { expire: 0 });
  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/tasks');
  revalidatePath('/admin/crm/broadcasts');
  if (contactId) revalidatePath(`/admin/crm/${contactId}`);
}

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
export function sendRateLimited(
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
export function sendBlockedInE2E(): { success: false; error: string } | null {
  return isE2EMode() ? { success: false, error: 'Sending is disabled in test builds.' } : null;
}
