import {
  BROADCAST_RECIPIENT_CEILING,
  broadcastSubject,
  buildBroadcastEmail,
} from '@/lib/crm-broadcast';
import { applyCRMStatusFilter } from '@/lib/crm-donor';
import { isInAudience } from '@/lib/crm-filters';
import { normalizeTags } from '@/lib/crm-import';
import {
  BROADCAST_DISPATCH_TIMEOUT_MS,
  BROADCAST_HISTORY_MAX_PAGE_SIZE,
  BROADCAST_HISTORY_PAGE_SIZE,
} from '@/lib/crm-limits';
import { LOGO_URL } from '@/lib/email';
import { env } from '@/lib/env';
import type {
  BroadcastFollowUp,
  BroadcastMetrics,
  BroadcastProgress,
  BroadcastRecipient,
  BroadcastTarget,
  CRMBroadcast,
  CRMBroadcastEmailEvent,
  CRMBroadcastInsert,
  NewsletterBroadcastInsert,
} from '@/types/crm';
import {
  type AdminClient,
  type CRMResult,
  combineCRMWarnings,
  crmAuditLostWarning,
  recordCRMAudit,
  requireCRMAdmin,
  revalidateCRMRoutes,
  sendBlockedInE2E,
  sendRateLimited,
  unsubscribeUrl,
} from './shared';

const BROADCAST_LIMIT = { limit: 5, windowMs: 60_000 } as const;

/** Ledger rows per PostgREST write. A 5,000-recipient campaign is ten writes. */
const BROADCAST_LEDGER_BATCH = 500;

/**
 * Campaign metrics straight from `crm_broadcast_metrics()`.
 *
 * One call per history page, never one per row. The function is service-role
 * only and returns a row for every requested campaign, including campaigns with
 * no ledger rows at all (legacy history). A missing function during the
 * schema-before-app rollout is treated as "no ledger yet": callers fall back to
 * `crm_broadcasts.sent_count` / `failed_count`, which are the only numbers those
 * campaigns ever had. A real database failure is logged but does not take the
 * history page down — an empty history would read as "you never sent anything".
 */
async function getBroadcastMetricsFor(
  adminClient: AdminClient,
  broadcastIds: string[]
): Promise<Record<string, BroadcastMetrics>> {
  const ids = [...new Set(broadcastIds.filter(Boolean))];
  if (ids.length === 0) return {};

  // `?.` because test doubles and older clients can return no envelope at all;
  // treating that as "no ledger rows" keeps the legacy fallback honest.
  const response = await adminClient.rpc('crm_broadcast_metrics', {
    p_broadcast_ids: ids,
  });
  const error = response?.error ?? null;
  if (error) {
    // A schema-before-app rollout is expected; a real read failure is not.
    if (!isMissingLedger(error)) {
      console.error('[crm] broadcast metrics unavailable:', error.message);
    }
    return {};
  }

  const metrics: Record<string, BroadcastMetrics> = {};
  for (const row of response?.data ?? []) {
    metrics[row.broadcast_id] = {
      broadcastId: row.broadcast_id,
      recipientCount: row.recipient_count,
      acceptedCount: row.accepted_count,
      failedCount: row.failed_count,
      suppressedCount: row.suppressed_count,
      pendingCount: row.pending_count,
      recordedCount: row.recorded_count,
      unresolvedCount: row.unresolved_count,
    };
  }
  return metrics;
}

/** A missing ledger function/table is a rollout state, not a data error. */
function isMissingLedger(error: { code?: string; message?: string } | null): boolean {
  const code = error?.code ?? '';
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    code === '42P01' ||
    /could not find the function|does not exist/i.test(error?.message ?? '')
  );
}

/**
 * Record the audience as failed when the sender could not be reached at all.
 *
 * The Edge sender is the normal writer, but a dispatch that never starts has no
 * Edge process to write anything. These rows are the same per-recipient truth:
 * every resolved contact gets a terminal failed row, so the campaign still has
 * a follow-up list. Called only after the campaign was successfully marked
 * failed — a row written before that could survive into a retry and contradict
 * a later successful send.
 */
async function recordBroadcastDispatchFailure(
  adminClient: AdminClient,
  broadcastId: string,
  recipients: Array<{
    id?: string | null;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  }>,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  const rows = recipients.map((recipient) => ({
    broadcast_id: broadcastId,
    contact_id: recipient.id ?? null,
    email: recipient.email.trim().toLowerCase(),
    recipient_name: [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || null,
    status: 'failed' as const,
    reason: reason.slice(0, 500),
    failed_at: now,
  }));

  for (let i = 0; i < rows.length; i += BROADCAST_LEDGER_BATCH) {
    const { error } = await adminClient
      .from('crm_broadcast_recipients')
      .upsert(rows.slice(i, i + BROADCAST_LEDGER_BATCH), {
        onConflict: 'broadcast_id,email',
        ignoreDuplicates: true,
      });
    if (error) {
      console.error(
        `[crm] failed to record dispatch failure for broadcast ${broadcastId}:`,
        error.message
      );
      return;
    }
  }
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
  target: BroadcastTarget,
  options: { newsletterConfirmedOnly?: boolean } = {}
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
      .select(
        'id, email, first_name, last_name, unsubscribe_token, do_not_email, newsletter_confirmed_at'
      )
      .eq('do_not_email', false)
      .order('id', { ascending: true });

    if (options.newsletterConfirmedOnly) {
      // Added by the unapplied newsletter migration; the generated column union
      // will include it after `bun run types:generate`.
      qb = qb.not('newsletter_confirmed_at' as never, 'is', null);
    }

    qb = applyCRMStatusFilter(qb, targetStatus);
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
      ...(
        data as unknown as (BroadcastRecipient & {
          do_not_email: boolean | null;
          newsletter_confirmed_at?: string | null;
        })[]
      ).filter(
        (r) =>
          isInAudience(r.do_not_email) &&
          (!options.newsletterConfirmedOnly || Boolean(r.newsletter_confirmed_at))
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
export async function previewCRMBroadcast({
  subject,
  body,
  recipientName = 'Neighbor',
}: {
  subject: string;
  body: string;
  recipientName?: string;
}): Promise<{ html: string; text: string; subject: string }> {
  await requireCRMAdmin();
  return {
    ...buildBroadcastEmail({
      recipientName,
      body,
      unsubscribeUrl: unsubscribeUrl('00000000-0000-0000-0000-000000000000'),
      logoUrl: LOGO_URL,
      // The preview is the message: same builder, same origin. A hardcoded apex
      // here would show the author links no recipient ever receives.
      siteUrl: env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, ''),
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
}: BroadcastTarget & { broadcastId?: string | null; subject: string; body: string }): Promise<
  CRMResult<{ broadcastId?: string }>
> {
  const { adminClient, adminUserId } = await requireCRMAdmin();
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

export async function deleteCRMBroadcastDraft(id: string): Promise<CRMResult> {
  const { adminClient } = await requireCRMAdmin();
  const { data: existing, error: readError } = await adminClient
    .from('crm_broadcasts')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (readError) return { success: false, error: readError.message };
  // Only drafts are removable. Deleting a sent broadcast would orphan every
  // `email_sent` activity referencing it — that log is the audit trail.
  if (!existing) return { success: false, error: 'That broadcast no longer exists' };
  if (existing.status !== 'draft') {
    return { success: false, error: 'Only unsent drafts can be deleted' };
  }
  const { data: deleted, error } = await adminClient
    .from('crm_broadcasts')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!deleted) return { success: false, error: 'That broadcast no longer exists' };
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
  newsletterConfirmedOnly = false,
  sourceNewsletterSlug,
}: BroadcastTarget & {
  subject: string;
  body: string;
  newsletterConfirmedOnly?: boolean;
  sourceNewsletterSlug?: string;
}): Promise<
  CRMResult<{
    recipientCount?: number;
    broadcastId?: string;
    /** Present when the sender reports the delivery finished but its bookkeeping
     *  did not; carries the sender's own warning, not an error. */
    warning?: string;
  }>
> {
  const blocked = sendBlockedInE2E();
  if (blocked) return blocked;

  const admin = await requireCRMAdmin();
  const { adminClient, adminUserId } = admin;

  const cleanSubject = broadcastSubject(subject);
  if (!cleanSubject) return { success: false, error: 'Subject is required' };
  if (!body.trim()) return { success: false, error: 'Message body is required' };

  const limited = sendRateLimited(adminUserId, BROADCAST_LIMIT);
  if (limited) return { success: false, error: limited };

  targetTags = normalizeTags(targetTags);
  let audience: { recipients: BroadcastRecipient[]; exhausted: boolean };
  try {
    audience = await resolveBroadcastRecipients(
      adminClient,
      {
        targetTags,
        targetStatus,
        targetDistricts,
      },
      { newsletterConfirmedOnly }
    );
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

  const insertPayload: NewsletterBroadcastInsert = {
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
    ...(sourceNewsletterSlug ? { source_newsletter_slug: sourceNewsletterSlug } : {}),
  };
  const { data: broadcast, error: bcError } = await adminClient
    .from('crm_broadcasts')
    .insert(insertPayload as unknown as CRMBroadcastInsert)
    .select('id')
    .single();

  if (bcError) {
    if (sourceNewsletterSlug && bcError.code === '23505') {
      return {
        success: false,
        error:
          'This bulletin already has an active or completed email campaign. Check the campaign log before sending it again.',
      };
    }
    return { success: false, error: `Failed to create broadcast log: ${bcError.message}` };
  }
  if (!broadcast) {
    return { success: false, error: 'Failed to create broadcast log' };
  }

  const auditAfter = {
    subject: cleanSubject,
    body: body.trim(),
    status: 'queued',
    recipient_count: recipients.length,
    target_tags: targetTags,
    target_status: targetStatus,
    target_districts: targetDistricts,
    test_only: false,
    ...(sourceNewsletterSlug ? { source_newsletter_slug: sourceNewsletterSlug } : {}),
  };
  const audit = (outcome: 'success' | 'failure', after: Record<string, unknown>, error?: string) =>
    recordCRMAudit(admin, {
      action: 'crm.broadcast.send',
      targetType: 'crm_broadcast',
      targetId: broadcast.id,
      targetLabel: cleanSubject,
      before: null,
      after,
      outcome,
      error: error ?? null,
    });

  const dispatched = await dispatchBroadcastSender(broadcast.id);
  if (!dispatched.ok) {
    // Mark it failed rather than leaving it queued forever: the admin needs to
    // see that it did not go out, and be able to try again.
    // `failed_count` is the unsent remainder, matching `markCRMBroadcastFailed`.
    // Without it the row reads "N recipients, none accepted, none rejected"
    // rather than "nothing was attempted" — and nothing was.
    const { data: markedFailed, error: markError } = await adminClient
      .from('crm_broadcasts')
      .update({
        status: 'failed',
        sent_at: new Date().toISOString(),
        failed_count: recipients.length,
      })
      .eq('id', broadcast.id)
      // Only stamp a campaign that is still pending. If the sender finished
      // first, overwriting `sent` with `failed` would erase the true outcome.
      .in('status', ['queued', 'sending'])
      .select('id')
      .maybeSingle();
    const startFailure = `Broadcast could not be started: ${dispatched.error}`;
    if (markError) {
      const message = `${startFailure}. The campaign could not be marked failed: ${markError.message}. It may still appear queued — mark it failed before retrying.`;
      await audit('failure', { ...auditAfter, status: 'queued' }, message);
      return {
        success: false,
        recipientCount: recipients.length,
        broadcastId: broadcast.id,
        error: message,
      };
    }
    if (!markedFailed) {
      const message = `${startFailure}. The campaign could not be marked failed because it already finished or its row was not found. Check the campaign log before retrying.`;
      await audit('failure', { ...auditAfter, status: 'finished_or_missing' }, message);
      return {
        success: false,
        recipientCount: recipients.length,
        broadcastId: broadcast.id,
        error: message,
      };
    }
    await recordBroadcastDispatchFailure(adminClient, broadcast.id, recipients, startFailure);
    await audit('failure', { ...auditAfter, status: 'failed' }, startFailure);
    return {
      success: false,
      recipientCount: recipients.length,
      broadcastId: broadcast.id,
      error: startFailure,
    };
  }

  const auditResult = await audit('success', { ...auditAfter, status: 'queued' });
  const warning = combineCRMWarnings(
    dispatched.warning,
    crmAuditLostWarning(auditResult, 'The broadcast was queued')
  );
  revalidateCRMRoutes();
  return {
    success: true,
    recipientCount: recipients.length,
    broadcastId: broadcast.id,
    ...(warning ? { warning } : {}),
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
}): Promise<CRMResult<{ recipient?: string }>> {
  const blocked = sendBlockedInE2E();
  if (blocked) return blocked;

  const admin = await requireCRMAdmin();
  const { adminClient, adminUserId, adminEmail } = admin;

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

  const auditAfter = {
    subject: markedSubject,
    body: body.trim(),
    status: 'queued',
    recipient_count: 1,
    test_recipient: adminEmail,
    test_only: true,
  };
  const audit = (outcome: 'success' | 'failure', after: Record<string, unknown>, error?: string) =>
    recordCRMAudit(admin, {
      action: 'crm.broadcast.self_test',
      targetType: 'crm_broadcast',
      targetId: data.id,
      targetLabel: markedSubject,
      before: null,
      after,
      outcome,
      error: error ?? null,
    });

  const dispatched = await dispatchBroadcastSender(data.id);
  if (!dispatched.ok) {
    const { data: markedFailed, error: markError } = await adminClient
      .from('crm_broadcasts')
      .update({ status: 'failed', sent_at: new Date().toISOString(), failed_count: 1 })
      .eq('id', data.id)
      // Same atomic guard as a real broadcast: a finished preview must not be
      // rewritten as failed by a late failure response.
      .in('status', ['queued', 'sending'])
      .select('id')
      .maybeSingle();
    const testFailure = `Test could not be sent: ${dispatched.error}`;
    if (markError) {
      const message = `${testFailure}. The test row could not be marked failed: ${markError.message}. It may still appear queued.`;
      await audit('failure', { ...auditAfter, status: 'queued' }, message);
      return { success: false, error: message };
    }
    if (!markedFailed) {
      const message = `${testFailure}. The test row could not be marked failed because it already finished or was not found. Check the campaign log before retrying.`;
      await audit('failure', { ...auditAfter, status: 'finished_or_missing' }, message);
      return { success: false, error: message };
    }
    await recordBroadcastDispatchFailure(
      adminClient,
      data.id,
      [
        {
          id: null,
          email: adminEmail,
          first_name: 'Test',
          last_name: 'Recipient',
        },
      ],
      testFailure
    );
    await audit('failure', { ...auditAfter, status: 'failed' }, testFailure);
    return { success: false, error: testFailure };
  }

  const auditResult = await audit('success', { ...auditAfter, status: 'queued' });
  const warning = crmAuditLostWarning(auditResult, 'The test email was sent');
  revalidateCRMRoutes();
  return { success: true, recipient: adminEmail, ...(warning ? { warning } : {}) };
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
export async function markCRMBroadcastFailed(broadcastId: string): Promise<CRMResult> {
  const { adminClient, adminUserId } = await requireCRMAdmin();

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

  // A stranded campaign's ledger rows are still `pending` because the sender
  // never recorded an outcome. Marking the campaign failed has to carry through
  // to them, or the follow-up list would omit every recipient the organizer just
  // decided not to wait for.
  const { error: ledgerError } = await adminClient
    .from('crm_broadcast_recipients')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      reason: 'Campaign was marked failed before the sender recorded an outcome',
    })
    .eq('broadcast_id', broadcastId)
    .eq('status', 'pending');
  if (ledgerError) {
    console.error(
      `[crm] failed to settle pending ledger rows for broadcast ${broadcastId}:`,
      ledgerError.message
    );
  }

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
  const { adminClient } = await requireCRMAdmin();
  const { data, error } = await adminClient
    .from('crm_broadcasts')
    .select('id, subject, status, recipient_count, sent_count, failed_count, sent_at, created_at')
    .eq('id', broadcastId)
    .maybeSingle();
  if (error) throw new Error(`Failed to read broadcast progress: ${error.message}`);
  if (!data) return null;

  const metrics = (await getBroadcastMetricsFor(adminClient, [broadcastId]))[broadcastId];
  // Legacy campaigns have no ledger rows; their stored counters are still the
  // only available truth. A campaign with even one pre-registered row uses the
  // aggregate, including while every row is still `pending`.
  const ledger = metrics && metrics.recordedCount > 0 ? metrics : null;

  return {
    id: data.id,
    subject: data.subject,
    status: (data.status ?? 'draft') as BroadcastProgress['status'],
    recipientCount: ledger?.recipientCount ?? data.recipient_count ?? 0,
    sentCount: ledger?.acceptedCount ?? data.sent_count ?? 0,
    failedCount: ledger?.failedCount ?? data.failed_count ?? 0,
    suppressedCount: ledger?.suppressedCount,
    pendingCount: ledger?.pendingCount,
    sentAt: data.sent_at,
    createdAt: data.created_at ?? new Date().toISOString(),
  };
}

/**
 * How many delivery events one expanded history row shows.
 *
 * Bounded like every other capped read, and it says so: `totalCount` is the
 * query's exact count and `truncated` names the cap, so "200 events" never
 * reads as "200 events happened".
 */
const BROADCAST_EMAIL_EVENTS_LIMIT = 200;

/**
 * Delivery events for one broadcast: bounces, complaints, opens, clicks.
 *
 * `crm_email_events` is written by the Resend webhook and was never read by
 * any admin surface — the only post-send signal was the row's `sent_count`,
 * which counts provider *acceptances*, not deliveries. A campaign with 40
 * permanent bounces looked exactly as healthy as one with none. This is the
 * read half; the write half stays in `src/app/api/webhooks/resend/route.ts`.
 *
 * Recipient emails resolve in one batched read, not per event: the panel for
 * a large campaign's bounce list must not N+1 the directory.
 */
export async function getBroadcastEmailEvents(
  broadcastId: string
): Promise<{ events: CRMBroadcastEmailEvent[]; totalCount: number; truncated: boolean }> {
  const { adminClient } = await requireCRMAdmin();
  const { data, error, count } = await adminClient
    .from('crm_email_events')
    .select('id, event_type, contact_id, occurred_at, provider_id', { count: 'exact' })
    .eq('broadcast_id', broadcastId)
    .order('occurred_at', { ascending: false })
    .limit(BROADCAST_EMAIL_EVENTS_LIMIT);
  if (error) throw new Error(`Failed to read delivery events: ${error.message}`);
  if (count === null) {
    throw new Error('Failed to read delivery events: total count unavailable');
  }

  const rows = data ?? [];
  const contactIds = [...new Set(rows.map((row) => row.contact_id).filter(Boolean))];
  let emails = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data: contacts, error: contactError } = await adminClient
      .from('crm_contacts')
      .select('id, email')
      .in('id', contactIds);
    if (contactError) throw new Error(`Failed to read delivery events: ${contactError.message}`);
    emails = new Map((contacts ?? []).map((contact) => [contact.id, contact.email]));
  }

  const totalCount = count;
  return {
    events: rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      contactId: row.contact_id,
      contactEmail: emails.get(row.contact_id) ?? null,
      occurredAt: row.occurred_at,
      providerId: row.provider_id,
    })),
    totalCount,
    truncated: totalCount > rows.length,
  };
}

/**
 * Failed and suppressed recipients for one campaign's follow-up list.
 *
 * The list is bounded and ordered by SQL, and `total_count` is computed over the
 * full filtered set by the same function. Counting in JavaScript over a capped
 * page would make `100` look like the number of people needing follow-up.
 */
export async function getBroadcastFollowUps(
  broadcastId: string,
  { limit = 100, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<{ followUps: BroadcastFollowUp[]; totalCount: number; truncated: boolean }> {
  const { adminClient } = await requireCRMAdmin();
  const safeLimit = Math.min(Math.max(1, Number.isFinite(limit) ? Math.trunc(limit) : 100), 500);
  const safeOffset = Math.max(0, Number.isFinite(offset) ? Math.trunc(offset) : 0);

  const response = await adminClient.rpc('crm_broadcast_followups', {
    p_broadcast_id: broadcastId,
    p_limit: safeLimit,
    p_offset: safeOffset,
  });
  const error = response?.error ?? null;
  if (error) {
    if (isMissingLedger(error)) return { followUps: [], totalCount: 0, truncated: false };
    throw new Error(`Failed to read broadcast follow-ups: ${error.message}`);
  }

  const rows = response?.data ?? [];
  const totalCount = Number(rows[0]?.total_count ?? 0);
  return {
    followUps: rows.map((row) => ({
      contactId: row.contact_id,
      email: row.email,
      recipientName: row.recipient_name,
      status: row.status === 'suppressed' ? 'suppressed' : 'failed',
      reason: row.reason,
      providerId: row.provider_id,
      failedAt: row.failed_at,
      suppressedAt: row.suppressed_at,
      updatedAt: row.updated_at,
    })),
    totalCount,
    truncated: totalCount > rows.length,
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
} = {}): Promise<{
  broadcasts: CRMBroadcast[];
  totalCount: number;
  page: number;
  /** SQL aggregates keyed by campaign id. Empty when the ledger is unavailable. */
  metrics: Record<string, BroadcastMetrics>;
}> {
  const { adminClient } = await requireCRMAdmin();
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
  if (count === null) {
    throw new Error('Failed to fetch broadcast history: total count unavailable');
  }

  const broadcasts = data || [];
  const metrics = await getBroadcastMetricsFor(
    adminClient,
    broadcasts.map((broadcast) => broadcast.id)
  );
  return { broadcasts, totalCount: count, page: current, metrics };
}

/** Unsent work in progress, newest first. Resumable, and removable. */
export async function getCRMBroadcastDrafts(): Promise<CRMBroadcast[]> {
  const { adminClient } = await requireCRMAdmin();
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
  newsletterConfirmedOnly = false,
}: {
  targetTags?: string[];
  targetStatus?: string[];
  targetDistricts?: string[];
  newsletterConfirmedOnly?: boolean;
}): Promise<{ count: number; excludedCount: number }> {
  const { adminClient } = await requireCRMAdmin();

  targetTags = normalizeTags(targetTags);

  const targetQuery = () => {
    let qb = adminClient.from('crm_contacts').select('*', { count: 'exact', head: true });
    qb = applyCRMStatusFilter(qb, targetStatus);
    if (targetDistricts.length > 0) {
      qb = qb.in('district', targetDistricts);
    }
    if (targetTags.length > 0) {
      qb = qb.contains('tags', targetTags);
    }
    if (newsletterConfirmedOnly) {
      qb = qb.not('newsletter_confirmed_at' as never, 'is', null);
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
  if (count === null) {
    throw new Error('Failed to count broadcast recipients: total count unavailable');
  }
  if (excluded === null) {
    throw new Error('Failed to count excluded recipients: total count unavailable');
  }

  return { count, excludedCount: excluded };
}
