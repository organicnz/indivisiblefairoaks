import { isE2EMode } from '@/lib/e2e-mode';
import {
  brandShell,
  escapeHtml,
  safeSubject,
  sendEmail,
  type SendEmailResult,
} from '@/lib/email';
import { env } from '@/lib/env';

function siteUrl() {
  return (env.NEXT_PUBLIC_SITE_URL || 'https://indivisiblefairoaks.org').replace(
    /\/+$/,
    ''
  );
}

/**
 * This is a new send path. Like every other one in the app, it must refuse in
 * an e2e build so a test click cannot mail a real submitter.
 */
async function sendPrivateEmail(
  input: Parameters<typeof sendEmail>[0]
): Promise<SendEmailResult> {
  if (isE2EMode()) {
    return { ok: false, error: 'test-build', status: 0 };
  }
  return sendEmail(input);
}

export async function sendReunificationConfirmation({
  email,
  referenceCode,
  statusUrl,
}: {
  email: string;
  referenceCode: string;
  statusUrl: string;
}) {
  const url = siteUrl();
  const body = `
    <p style="margin:0 0 14px;color:#F8FAFC;font-size:18px;font-weight:800;line-height:1.35;">Your private request was received</p>
    <p style="margin:0 0 14px;color:#CBD5E1;">Reference <strong style="color:#FFFFFF;">${escapeHtml(referenceCode)}</strong>. A volunteer will review the information and may contact you using the details you provided.</p>
    <p style="margin:0 0 18px;color:#CBD5E1;">We do not publish names, faces, or immigration status on the alert map. Your request is kept private and is not a public alert.</p>
    <p style="margin:0 0 20px;"><a href="${escapeHtml(statusUrl)}" style="display:inline-block;background:#DC2626;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:13px;padding:12px 20px;border-radius:8px;">Open your private status page</a></p>
    <p style="margin:0 0 10px;color:#94A3B8;font-size:12px;line-height:1.65;">Keep this email and link private. Anyone with the link can see the status reference, though not the full case details.</p>
    <p style="margin:0;color:#64748B;font-size:11px;line-height:1.6;">This service cannot guarantee an outcome or a release date. Immediate danger? Call 911. <a href="${escapeHtml(url)}/ice-alerts/reunification" style="color:#94A3B8;">Reunification resources</a>.</p>
  `;

  return sendPrivateEmail({
    to: email,
    subject: safeSubject(`Private reunification request received — ${referenceCode}`),
    html: brandShell({
      eyebrow: 'ICE Alert / Private reunification',
      body,
      footer: 'Private request — not a public alert',
      siteUrl: url,
    }),
    text: [
      `Your private reunification request was received. Reference: ${referenceCode}.`,
      '',
      `Private status page: ${statusUrl}`,
      '',
      'We do not publish names, faces, or immigration status on the alert map.',
      'Keep this link private. This service cannot guarantee an outcome or a release date.',
      'Immediate danger? Call 911.',
    ].join('\n'),
    tags: [{ name: 'type', value: 'ice-reunification-confirmation' }],
  });
}

export async function sendReunificationAdminNotice({
  referenceCode,
}: {
  referenceCode: string;
}) {
  const adminEmail = env.ADMIN_ORDER_EMAIL || 'contact@indivisiblefairoaks.org';
  const body = `
    <p style="margin:0 0 12px;color:#F8FAFC;font-size:18px;font-weight:800;">New private reunification request</p>
    <p style="margin:0 0 12px;color:#CBD5E1;">Reference <strong style="color:#FFFFFF;">${escapeHtml(referenceCode)}</strong> is in the service-role-only intake table.</p>
    <p style="margin:0 0 12px;color:#94A3B8;font-size:12px;line-height:1.65;">This email deliberately contains no names, contact details, or case notes. Review the request in the Supabase dashboard, verify against official resources, and update the status when appropriate.</p>
    <p style="margin:0;color:#FCA5A5;font-size:12px;font-weight:700;">Do not forward this notification or paste case details into email.</p>
  `;

  return sendPrivateEmail({
    to: adminEmail,
    subject: safeSubject(`[Private] Reunification request ${referenceCode}`),
    html: brandShell({
      eyebrow: 'ICE Alert / Private intake',
      body,
      footer: 'Service-role-only request',
      siteUrl: siteUrl(),
    }),
    text: [
      `New private reunification request: ${referenceCode}.`,
      'Review it in the service-role-only Supabase table.',
      'No names, contact details, or case notes are included in this email.',
    ].join('\n'),
    tags: [{ name: 'type', value: 'ice-reunification-admin' }],
  });
}
