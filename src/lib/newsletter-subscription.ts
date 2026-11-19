import { randomUUID } from 'node:crypto';
import { broadcastSubject } from '@/lib/crm-broadcast';
import { MAX_TAGS_PER_CONTACT, normalizeTags } from '@/lib/crm-import';
import { isE2EMode } from '@/lib/e2e-mode';
import {
  brandShell,
  escapeHtml,
  type SendEmailResult,
  safeSubject,
  sendEmail,
  stripControls,
} from '@/lib/email';
import { env } from '@/lib/env';

/**
 * Newsletter consent lives on the CRM contact, next to the chapter-wide
 * `do_not_email` flag. This module owns the shape of the extra newsletter gate
 * so the public action, the confirmation route and the bulletin send cannot
 * disagree about what "confirmed" means.
 */
export const NEWSLETTER_CONFIRMATION_TTL_MS = 48 * 60 * 60 * 1_000;
export const NEWSLETTER_CONFIRMED_TAG = 'newsletter-confirmed';
export const NEWSLETTER_SOURCE_TAG = 'newsletter';
export const ACTION_ALERTS_TAG = 'action-alerts';

/** Tags that mark a pending request without claiming it is confirmed. */
export function withNewsletterRequestTags(tags: readonly string[]): string[] {
  const required = [ACTION_ALERTS_TAG, NEWSLETTER_SOURCE_TAG];
  const normalized = normalizeTags([...tags]).filter((tag) => tag !== NEWSLETTER_CONFIRMED_TAG);
  const rest = normalized
    .filter((tag) => !required.includes(tag))
    .slice(0, Math.max(0, MAX_TAGS_PER_CONTACT - required.length));
  return [...required, ...rest];
}

/**
 * The tags a confirmed newsletter contact carries. `newsletter_confirmed_at`
 * is the actual audience predicate; these tags keep the contact legible in the
 * CRM and make the newsletter segment filterable by hand.
 */
export function withNewsletterConfirmationTags(tags: readonly string[]): string[] {
  const required = [ACTION_ALERTS_TAG, NEWSLETTER_SOURCE_TAG, NEWSLETTER_CONFIRMED_TAG];
  const normalized = normalizeTags([...tags]);
  const rest = normalized
    .filter((tag) => !required.includes(tag))
    .slice(0, Math.max(0, MAX_TAGS_PER_CONTACT - required.length));
  return [...required, ...rest];
}

/** Remove only the confirmation marker; the topic tags stay for CRM history. */
export function withoutNewsletterConfirmationTag(tags: readonly string[]): string[] {
  return normalizeTags([...tags]).filter((tag) => tag !== NEWSLETTER_CONFIRMED_TAG);
}

export interface NewsletterConfirmation {
  token: string;
  expiresAt: string;
  confirmationSentAt: string;
}

/** A fresh single-use token. The default clock is injectable for tests. */
export function createNewsletterConfirmation(now = Date.now()): NewsletterConfirmation {
  return {
    token: randomUUID(),
    expiresAt: new Date(now + NEWSLETTER_CONFIRMATION_TTL_MS).toISOString(),
    confirmationSentAt: new Date(now).toISOString(),
  };
}

export function isNewsletterConfirmationLive(
  expiresAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!expiresAt) return false;
  const instant = Date.parse(expiresAt);
  return Number.isFinite(instant) && instant > now;
}

export function newsletterConfirmationUrl(token: string, siteUrl?: string): string {
  const origin = (siteUrl ?? env.NEXT_PUBLIC_SITE_URL).replace(/\/+$/, '');
  return `${origin}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
}

export interface NewsletterConfirmationEmailInput {
  email: string;
  firstName?: string | null;
  token: string;
  siteUrl?: string;
}

/**
 * The confirmation message is transactional: it is sent only because somebody
 * entered the address on the public form. It carries no marketing copy and no
 * unsubscribe header, because until the link is followed there is no
 * subscription to unsubscribe from.
 */
export function buildNewsletterConfirmationEmail({
  email,
  firstName,
  token,
  siteUrl,
}: NewsletterConfirmationEmailInput): Parameters<typeof sendEmail>[0] {
  const origin = (siteUrl ?? env.NEXT_PUBLIC_SITE_URL).replace(/\/+$/, '');
  const confirmUrl = newsletterConfirmationUrl(token, origin);
  // The name may come from a contact-form row that was length-checked but not
  // markup-checked. Escape it and strip controls before it reaches the shell.
  const safeName = firstName ? stripControls(firstName).slice(0, 80).trim() : '';
  const greeting = safeName ? `Hi ${escapeHtml(safeName)},` : 'Hi neighbor,';

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#FFFFFF;font-weight:700;">${greeting}</p>
    <p style="margin:0 0 16px;">You asked to receive chapter bulletins and Action Alerts from Indivisible Fair Oaks-Carmichael. Confirm this address and we will add you to the list.</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#2563EB;color:#FFFFFF;text-decoration:none;font-weight:800;padding:13px 24px;border-radius:10px;">Confirm subscription</a>
    </p>
    <p style="margin:0 0 12px;">Or paste this link into your browser:</p>
    <p style="margin:0 0 24px;word-break:break-all;color:#93C5FD;font-size:12px;">${escapeHtml(confirmUrl)}</p>
    <p style="margin:0;color:#94A3B8;font-size:12px;line-height:1.6;">If you did not ask for this, ignore this email. Nothing changes until the link is opened, and the link expires in 48 hours.</p>
  `.trim();

  const text = [
    safeName ? `Hi ${safeName},` : 'Hi neighbor,',
    '',
    'You asked to receive chapter bulletins and Action Alerts from Indivisible Fair Oaks-Carmichael.',
    'Confirm this address and we will add you to the list:',
    '',
    confirmUrl,
    '',
    'If you did not ask for this, ignore this email. Nothing changes until the link is opened,',
    'and the link expires in 48 hours.',
  ].join('\n');

  return {
    to: email,
    subject: safeSubject('Confirm your chapter bulletin subscription'),
    html: brandShell({
      eyebrow: 'Confirm your subscription',
      body,
      footer: 'You are not subscribed until you confirm',
      siteUrl: origin,
    }),
    text,
    tags: [{ name: 'type', value: 'newsletter-confirmation' }],
  };
}

/** Refuse to send from an E2E build; the public action also short-circuits. */
export async function sendNewsletterConfirmation(
  input: NewsletterConfirmationEmailInput
): Promise<SendEmailResult> {
  if (isE2EMode()) {
    return { ok: false, error: 'e2e-mode', status: 0 };
  }
  return sendEmail(buildNewsletterConfirmationEmail(input));
}

export interface BulletinBroadcastInput {
  title: string;
  dateLabel: string;
  description: string;
  body?: string | null;
  pdfUrl?: string | null;
  archiveUrl?: string | null;
  slug: string;
  siteUrl?: string;
}

/**
 * A bulletin is already written in plain text. The broadcast path adds the
 * brand shell, greeting and unsubscribe footer; this function only turns the
 * issue into the body the admin will approve, with a link back to the public
 * reader page and any durable copies.
 */
export function buildBulletinBroadcast({
  title,
  dateLabel,
  description,
  body,
  pdfUrl,
  archiveUrl,
  slug,
  siteUrl,
}: BulletinBroadcastInput): { subject: string; body: string } {
  const origin = (siteUrl ?? env.NEXT_PUBLIC_SITE_URL).replace(/\/+$/, '');
  const lines = [dateLabel.trim(), '', description.trim()];
  const fullBody = body?.trim();
  if (fullBody) lines.push('', fullBody);
  if (pdfUrl?.trim()) lines.push('', `PDF: ${pdfUrl.trim()}`);
  if (archiveUrl?.trim()) lines.push('', `Archive: ${archiveUrl.trim()}`);
  lines.push('', `Read this issue online: ${origin}/newsletters/${encodeURIComponent(slug)}`);

  return {
    subject: broadcastSubject(`Chapter Bulletin: ${title.trim()}`),
    body: lines.join('\n').trim(),
  };
}
