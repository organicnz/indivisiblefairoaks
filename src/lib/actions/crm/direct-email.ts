import { brandShell, escapeHtml, safeSubject, sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
import {
  claimDirectEmailSend,
  createDirectEmailSend,
  isDirectEmailSendRetrySafe,
  isDirectEmailSendStale,
  markDirectEmailSendAccepted,
  markDirectEmailSendFailed,
  readDirectEmailSend,
} from './direct-email-ledger';
import {
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

const SEND_LIMIT = { limit: 30, windowMs: 60_000 } as const;
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DUPLICATE_WARNING =
  'This email was already accepted by Resend for this idempotency key; no second copy was sent.';
const IN_PROGRESS_WARNING =
  'This email is already being sent for this idempotency key; no second copy was sent.';
const LEDGER_UPDATE_WARNING =
  'The email was sent, but its send ledger could not be updated. Retry this same submission after a couple of minutes to reconcile it.';

type DirectEmailAuditAfter =
  | { email: string; subject: string; resend_id: string }
  | { email: string; subject: string; provider_status: number };

export async function sendCRMDirectEmail({
  contactId,
  subject,
  message,
  idempotencyKey,
}: {
  contactId: string;
  subject: string;
  message: string;
  /**
   * Stable across retries of one submission. Callers that omit it get a fresh
   * key, which still records the send but cannot deduplicate a retry; the
   * compose form supplies one and keeps it until the submission succeeds.
   */
  idempotencyKey?: string;
}): Promise<CRMResult<{ warning?: string; requiresReconcile?: boolean }>> {
  const blocked = sendBlockedInE2E();
  if (blocked) return blocked;

  const admin = await requireCRMAdmin();
  const { adminClient, adminUserId } = admin;

  if (!subject.trim() || !message.trim()) {
    return { success: false, error: 'Subject and message are required' };
  }

  const key = (idempotencyKey?.trim() || crypto.randomUUID()).toLowerCase();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return { success: false, error: 'A valid idempotency key is required' };
  }

  /*
   * Read the ledger before doing anything that could call Resend. An accepted
   * row is the idempotent answer: the original request may have died after the
   * provider accepted the message, but the email must not be sent again. A
   * fresh pending row is still owned by another request; only a row whose lease
   * has expired may be reclaimed.
   */
  const existingResult = await readDirectEmailSend(adminClient, key);
  if (existingResult.error) {
    return {
      success: false,
      error: `Could not check the email send ledger: ${existingResult.error.message}`,
    };
  }
  const existing = existingResult.data;
  if (existing?.status === 'accepted') {
    return { success: true, warning: DUPLICATE_WARNING };
  }
  if (existing?.status === 'pending' && !isDirectEmailSendStale(existing)) {
    return { success: true, warning: IN_PROGRESS_WARNING, requiresReconcile: true };
  }
  if (existing && !isDirectEmailSendRetrySafe(existing)) {
    return {
      success: false,
      error:
        'This send is too old to retry safely because the provider idempotency window has expired. Check the contact timeline before composing a new email.',
    };
  }

  const limited = sendRateLimited(adminUserId, SEND_LIMIT);
  if (limited) return { success: false, error: limited };

  /*
   * A retry must resend the message the ledger recorded, not a later edit that
   * happens to reuse the form. The compose UI gives an edited message a new
   * key; this is the server-side guard for any other caller.
   */
  if (existing && !existing.contact_id) {
    return { success: false, error: 'The contact for this send no longer exists' };
  }
  const effectiveContactId = existing?.contact_id ?? contactId;
  const effectiveSubject = existing?.subject ?? subject;
  const effectiveMessage = existing?.message ?? message;

  const { data: contact, error: fetchError } = await adminClient
    .from('crm_contacts')
    .select('id, email, first_name, last_name, do_not_email, unsubscribe_token')
    .eq('id', effectiveContactId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: `Could not load contact: ${fetchError.message}` };
  }
  if (!contact) {
    return { success: false, error: 'Contact not found' };
  }

  // The ledger's address snapshot is the retry target. A contact's email can
  // change between attempts; resending an old attempt to the new address would
  // be a different email under the same idempotency key.
  const recipientEmail = existing?.recipient_email ?? contact.email;

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

  /*
   * Record the attempt before Resend sees it. If this write fails, no email is
   * sent: a provider-accepted message with no ledger row is the state this
   * table exists to prevent.
   */
  if (existing) {
    const claimed = await claimDirectEmailSend(adminClient, existing);
    if (claimed.error) {
      return {
        success: false,
        error: `Could not resume this email send: ${claimed.error.message}`,
      };
    }
    if (!claimed.data) {
      // Another request reclaimed the stale attempt first.
      return { success: true, warning: IN_PROGRESS_WARNING, requiresReconcile: true };
    }
  } else {
    const created = await createDirectEmailSend(adminClient, {
      idempotency_key: key,
      contact_id: contact.id,
      actor_user_id: adminUserId,
      recipient_email: recipientEmail,
      subject: effectiveSubject,
      message: effectiveMessage,
    });
    if (created.error) {
      if (created.error.code === '23505') {
        // A concurrent duplicate submit won the insert. Its provider call is
        // the only one; this request must not start a second.
        return { success: true, warning: IN_PROGRESS_WARNING, requiresReconcile: true };
      }
      return {
        success: false,
        error: `Could not record this email in the send ledger: ${created.error.message}`,
      };
    }
    if (!created.data) {
      return { success: false, error: 'Could not record this email in the send ledger' };
    }
  }

  const cleanSubject = safeSubject(effectiveSubject.trim());
  const cleanMessage = effectiveMessage.trim();
  const auditDirectEmail = (
    outcome: 'success' | 'failure',
    after: DirectEmailAuditAfter,
    error?: string
  ) =>
    recordCRMAudit(admin, {
      action: 'crm.direct_email.send',
      targetType: 'crm_contact',
      targetId: contact.id,
      targetLabel: recipientEmail,
      before: null,
      after,
      outcome,
      error,
      metadata: { idempotency_key: key },
    });
  const recipientName =
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Supporter';
  const escapedMessage = escapeHtml(cleanMessage).replace(/\n/g, '<br />');
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
    // Same origin the text footer and the unsubscribe link use. The shell used
    // to default to the apex while this message's text pointed at staging.
    siteUrl: env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, ''),
  });

  const sendResult = await sendEmail({
    to: recipientEmail,
    subject: cleanSubject,
    html,
    // The site origin comes from the same env var the HTML footer and the
    // unsubscribe link do. It used to be a literal here, so a staging build
    // mailed a text body pointing at the apex — which 302s to Google Sites
    // until the cutover — while the HTML in the same email pointed at staging.
    // Two different hosts in one message, and the one a screen reader reads
    // first was the wrong one. `unsubscribeUrl` is the existing derivation.
    text: [
      cleanMessage,
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
    // The same key on every retry is what turns the crash window into a
    // recovery: Resend answers with the original message id instead of
    // delivering a second copy.
    idempotencyKey: key,
  });

  if (!sendResult.ok) {
    const error = `Email dispatch failed: ${sendResult.error}`;
    // A failed attempt stays retryable. The next claim reuses this key, so if a
    // timeout actually reached Resend, the provider's cache still prevents a
    // duplicate.
    await markDirectEmailSendFailed(adminClient, key, sendResult.status, error);
    await auditDirectEmail(
      'failure',
      { email: recipientEmail, subject: cleanSubject, provider_status: sendResult.status },
      error
    );
    return { success: false, error };
  }

  const acceptedAt = new Date().toISOString();
  const accepted = await markDirectEmailSendAccepted(
    adminClient,
    key,
    sendResult.id,
    200,
    acceptedAt
  );

  /*
   * The provider accepted the message, but the ledger write did not land. Do
   * not write the timeline or audit yet: a retry of the same submission will
   * reclaim the pending row, get the original provider id, settle the ledger,
   * and write those records once. The warning tells the organizer to make that
   * retry instead of leaving a half-recorded send.
   */
  if (accepted.error || !accepted.data) {
    return { success: true, warning: LEDGER_UPDATE_WARNING, requiresReconcile: true };
  }

  const now = acceptedAt;

  const [contactUpdate, activityInsert, auditResult] = await Promise.all([
    adminClient
      .from('crm_contacts')
      .update({ last_outbound_at: now, last_contacted_at: now })
      .eq('id', contact.id)
      .select('id')
      .maybeSingle(),
    adminClient.from('crm_activities').insert({
      contact_id: contact.id,
      type: 'email_sent',
      title: `Sent Email: ${cleanSubject}`,
      description: cleanMessage,
      metadata: { resend_id: sendResult.id, subject: cleanSubject },
      created_by: adminUserId,
    }),
    auditDirectEmail('success', {
      email: recipientEmail,
      subject: cleanSubject,
      resend_id: sendResult.id,
    }),
  ]);

  const warning = combineCRMWarnings(
    // The email was accepted by the provider. If the contact vanished between
    // the read and this update, the send still happened, but claiming its
    // last-contacted stamp was recorded would be false.
    contactUpdate.error || !contactUpdate.data
      ? "The contact's last-contacted date could not be updated."
      : null,
    activityInsert.error ? 'The CRM timeline entry could not be recorded.' : null,
    crmAuditLostWarning(auditResult, 'The email was sent')
  );

  revalidateCRMRoutes(contact.id);
  return warning ? { success: true, warning } : { success: true };
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
