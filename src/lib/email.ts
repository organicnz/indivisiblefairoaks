import { env } from '@/lib/env';

export const RESEND_API_URL = 'https://api.resend.com/emails';

const DEFAULT_FROM = 'contact@indivisiblefairoaks.org';
const DEFAULT_ADMIN = 'contact@indivisiblefairoaks.org';
const MAX_SUBJECT_LEN = 200;
const SEND_TIMEOUT_MS = 10_000;

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status: number };

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function stripControls(value: string): string {
  return value.replace(/\p{C}/gu, '');
}

export function safeSubject(value: string): string {
  return stripControls(value).slice(0, MAX_SUBJECT_LEN);
}

/**
 * Sends a transactional email using Resend.
 * Never throws — network, timeout, and API errors resolve into `{ ok: false }`.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'missing-resend-api-key', status: 0 };
  }

  const to = Array.isArray(input.to) ? input.to : [input.to];
  if (to.length === 0 || to.some((a) => !a.includes('@'))) {
    return { ok: false, error: 'invalid-recipient', status: 0 };
  }

  const from = input.from || env.RESEND_FROM_EMAIL || DEFAULT_FROM;

  let res: Response;
  try {
    res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        ...(input.replyTo ? { reply_to: stripControls(input.replyTo) } : {}),
        subject: safeSubject(input.subject),
        html: input.html,
        text: input.text,
        ...(input.tags ? { tags: input.tags } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.name : 'network-error';
    return { ok: false, error: `transport:${reason}`, status: 0 };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, error: body.slice(0, 500), status: res.status };
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: data.id ?? '' };
}

export const LOGO_URL = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/wp-content/uploads/2021/10/logo.png`;

/**
 * Shared "Sensory Luxury" branded email shell for transactional mail.
 * Matches website color system: Royal Blue (#2563EB), Deep Navy (#0F172A), Slate Card (#1E293B).
 */
export function brandShell(opts: { eyebrow: string; body: string; footer: string }): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#1E293B;border-radius:24px;overflow:hidden;border:1px solid rgba(37,99,235,0.25);box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
<tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,#172554 0%,#1E293B 100%);">
<a href="https://indivisiblefairoaks.org" target="_blank" style="text-decoration:none;display:inline-block;">
<img src="${LOGO_URL}" alt="Indivisible Fair Oaks-Carmichael" width="170" style="display:block;margin:0 auto 12px;max-width:170px;height:auto;" />
</a>
<div style="display:inline-block;padding:5px 14px;background:rgba(37,99,235,0.2);border:1px solid rgba(59,130,246,0.35);color:#93C5FD;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;border-radius:9999px;">${opts.eyebrow}</div>
</td></tr>
<tr><td style="padding:36px 40px 28px;color:#E2E8F0;font-size:14px;line-height:1.7;">${opts.body}</td></tr>
<tr><td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.08);background:#0F172A;text-align:center;">
<p style="margin:0;color:#94A3B8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">${opts.footer}</p>
<p style="margin:6px 0 0;color:#64748B;font-size:11px;">Indivisible Fair Oaks-Carmichael &middot; Sacramento County</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Convenience helper to notify chapter organizers of a new contact submission.
 */
export async function sendContactNotification({
  id,
  name,
  email,
  message,
}: {
  id: number | string;
  name: string;
  email: string;
  message: string;
}): Promise<SendEmailResult> {
  const adminEmail = env.ADMIN_ORDER_EMAIL || DEFAULT_ADMIN;
  const escapedName = escapeHtml(stripControls(name));
  const escapedEmail = escapeHtml(stripControls(email));
  const escapedMessage = escapeHtml(message).replace(/\n/g, '<br />');

  const subject = `[Contact Form #${id}] Message from ${stripControls(name)}`;
  const text = `New contact form submission (#${id})\n\nFrom: ${name} <${email}>\n\nMessage:\n${message}`;

  const body = `
    <p style="margin:0 0 16px;"><span style="display:block;color:#94A3B8;font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">From</span><strong style="font-size:16px;color:#FFFFFF;">${escapedName}</strong></p>
    <p style="margin:0 0 16px;"><span style="display:block;color:#94A3B8;font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">Email</span><a href="mailto:${escapedEmail}" style="color:#60A5FA;text-decoration:none;font-weight:600;">${escapedEmail}</a></p>
    <div style="margin:0 0 8px;"><span style="display:block;color:#94A3B8;font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">Message</span></div>
    <div style="margin:0 0 20px;padding:18px 20px;background:#0F172A;border-radius:12px;border-left:3px solid #2563EB;color:#F1F5F9;font-size:14px;line-height:1.6;">${escapedMessage}</div>
  `.trim();

  const html = brandShell({
    eyebrow: `Contact Submission #${id}`,
    body,
    footer: 'Reply directly to this email to contact the submitter',
  });

  return sendEmail({
    to: adminEmail,
    subject,
    html,
    text,
    replyTo: email,
    tags: [{ name: 'type', value: 'contact-notification' }],
  });
}
