import { brandShell, escapeHtml, safeSubject, sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
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

type DirectEmailAuditAfter =
  | { email: string; subject: string; resend_id: string }
  | { email: string; subject: string; provider_status: number };

export async function sendCRMDirectEmail({
  contactId,
  subject,
  message,
}: {
  contactId: string;
  subject: string;
  message: string;
}): Promise<CRMResult<{ warning?: string }>> {
  const blocked = sendBlockedInE2E();
  if (blocked) return blocked;

  const admin = await requireCRMAdmin();
  const { adminClient, adminUserId } = admin;

  if (!subject.trim() || !message.trim()) {
    return { success: false, error: 'Subject and message are required' };
  }

  const limited = sendRateLimited(adminUserId, SEND_LIMIT);
  if (limited) return { success: false, error: limited };

  const { data: contact, error: fetchError } = await adminClient
    .from('crm_contacts')
    .select('id, email, first_name, last_name, do_not_email, unsubscribe_token')
    .eq('id', contactId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: `Could not load contact: ${fetchError.message}` };
  }
  if (!contact) {
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
  const auditDirectEmail = (
    outcome: 'success' | 'failure',
    after: DirectEmailAuditAfter,
    error?: string
  ) =>
    recordCRMAudit(admin, {
      action: 'crm.direct_email.send',
      targetType: 'crm_contact',
      targetId: contact.id,
      targetLabel: contact.email,
      before: null,
      after,
      outcome,
      error,
    });
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
    // Same origin the text footer and the unsubscribe link use. The shell used
    // to default to the apex while this message's text pointed at staging.
    siteUrl: env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, ''),
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
    const error = `Email dispatch failed: ${sendResult.error}`;
    await auditDirectEmail(
      'failure',
      { email: contact.email, subject: cleanSubject, provider_status: sendResult.status },
      error
    );
    return { success: false, error };
  }

  const now = new Date().toISOString();

  const [contactUpdate, activityInsert, auditResult] = await Promise.all([
    adminClient
      .from('crm_contacts')
      .update({ last_outbound_at: now, last_contacted_at: now })
      .eq('id', contactId)
      .select('id')
      .maybeSingle(),
    adminClient.from('crm_activities').insert({
      contact_id: contactId,
      type: 'email_sent',
      title: `Sent Email: ${cleanSubject}`,
      description: message.trim(),
      metadata: { resend_id: sendResult.id, subject: cleanSubject },
      created_by: adminUserId,
    }),
    auditDirectEmail('success', {
      email: contact.email,
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

  revalidateCRMRoutes(contactId);
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
