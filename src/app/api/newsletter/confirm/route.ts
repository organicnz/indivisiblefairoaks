import { NextResponse } from 'next/server';
import { renderUnsubscribeGreeting } from '@/lib/crm-unsubscribe';
import {
  isNewsletterConfirmationLive,
  withNewsletterConfirmationTags,
} from '@/lib/newsletter-subscription';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { readFormDataWithLimit } from '@/lib/request-body';
import { createAdminClient } from '@/lib/supabase-server';
import type { CRMContactUpdate, NewsletterContactUpdate } from '@/types/crm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FORM_BODY_BYTES = 8_192;
const NO_INDEX = { 'X-Robots-Tag': 'noindex, nofollow' };

type Contact = {
  id: string;
  email: string;
  first_name: string | null;
  tags: string[] | null;
  newsletter_confirmed_at: string | null;
  newsletter_confirm_expires_at: string | null;
};

const PAGE = (body: string) =>
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="robots" content="noindex,nofollow" /><title>Indivisible Fair Oaks-Carmichael</title></head><body style="margin:0;background:#0F172A;font-family:system-ui,-apple-system,sans-serif;color:#E2E8F0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;"><div style="max-width:460px;text-align:center;"><div style="font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#60A5FA;margin-bottom:12px;">Indivisible Fair Oaks-Carmichael</div>${body}</div></body></html>`;

const html = (body: string, status = 200) =>
  new NextResponse(PAGE(body), {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...NO_INDEX,
    },
  });

/**
 * Resolve a confirmation token without changing anything.
 *
 * Mail scanners fetch every URL in an email. A GET must therefore be safe: this
 * function only reads, and the write happens in POST after a human submits the
 * form. The token is a UUID and is looked up as a whole value.
 */
async function resolve(
  req: Request,
  token: string | null
): Promise<{ contact: Contact } | { response: NextResponse }> {
  const gate = rateLimit(clientKey(req.headers, 'newsletter-confirm'), 20, 600_000);
  if (!gate.ok) {
    return {
      response: new NextResponse('Too many requests. Please retry shortly.', {
        status: 429,
        headers: { 'Retry-After': String(gate.retryAfterSec) },
      }),
    };
  }

  if (!token || !UUID_RE.test(token)) {
    return { response: new NextResponse('Invalid confirmation link.', { status: 400 }) };
  }

  const adminClient = await createAdminClient();
  const { data: contact } = await adminClient
    .from('crm_contacts')
    .select('id, email, first_name, tags, newsletter_confirmed_at, newsletter_confirm_expires_at')
    .eq('newsletter_confirm_token' as never, token)
    .maybeSingle();

  if (!contact) {
    return {
      response: new NextResponse('This confirmation link is no longer valid.', { status: 404 }),
    };
  }
  return { contact: contact as unknown as Contact };
}

/** Safe to prefetch: this only renders the confirmation step. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  try {
    const resolved = await resolve(req, token);
    if ('response' in resolved) return resolved.response;
    const { contact } = resolved;
    const name = renderUnsubscribeGreeting(contact.first_name);

    if (contact.newsletter_confirmed_at) {
      return html(
        `<h1 style="font-size:22px;font-weight:900;margin:0 0 12px;color:#fff;">You&rsquo;re already confirmed</h1>` +
          `<p style="font-size:14px;line-height:1.6;color:#94A3B8;margin:0;">${name}this address is already on the chapter bulletin list. Every bulletin includes an unsubscribe link if you change your mind.</p>`
      );
    }

    if (!isNewsletterConfirmationLive(contact.newsletter_confirm_expires_at)) {
      return html(
        `<h1 style="font-size:22px;font-weight:900;margin:0 0 12px;color:#fff;">This link has expired</h1>` +
          `<p style="font-size:14px;line-height:1.6;color:#94A3B8;margin:0;">${name}confirmation links last 48 hours. Request a new one from the subscription form on the news page.</p>`,
        410
      );
    }

    return html(
      `<h1 style="font-size:22px;font-weight:900;margin:0 0 12px;color:#fff;">Confirm your subscription?</h1>` +
        `<p style="font-size:14px;line-height:1.6;color:#94A3B8;margin:0 0 24px;">${name}confirm and you will receive chapter bulletins and Action Alerts. Every bulletin includes a one-click unsubscribe link.</p>` +
        // A POST form, not a link. The GET above is what mail scanners fetch.
        `<form method="post" action="/api/newsletter/confirm">` +
        `<input type="hidden" name="token" value="${token ?? ''}" />` +
        `<input type="hidden" name="confirm" value="1" />` +
        `<button type="submit" style="font:inherit;font-size:14px;font-weight:800;letter-spacing:0.02em;color:#fff;background:#155DFC;border:0;border-radius:10px;padding:12px 22px;cursor:pointer;">Confirm subscription</button>` +
        `</form>` +
        `<p style="font-size:12px;line-height:1.6;color:#64748B;margin:24px 0 0;">We ask you to confirm because someone else could have typed your address. Nothing changes until you press the button.</p>`
    );
  } catch {
    return new NextResponse('Unable to process confirmation right now.', { status: 500 });
  }
}

/** The only method that changes subscription state. */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const contentType = req.headers.get('content-type') || '';
  let token = searchParams.get('token');
  let humanConfirmed = false;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await readFormDataWithLimit(req, MAX_FORM_BODY_BYTES);
    if (!body.ok) {
      return new NextResponse(
        body.code === 'too-large' ? 'Request body too large.' : 'Invalid form.',
        {
          status: body.code === 'too-large' ? 413 : 400,
        }
      );
    }
    const form = body.value;
    const fromBody = form.get('token');
    if (typeof fromBody === 'string' && fromBody) token = fromBody;
    humanConfirmed = form.get('confirm') === '1';
  }

  if (!humanConfirmed) {
    return new NextResponse('Open the confirmation page and press the confirmation button.', {
      status: 400,
    });
  }

  try {
    const resolved = await resolve(req, token);
    if ('response' in resolved) return resolved.response;
    const { contact } = resolved;
    const name = renderUnsubscribeGreeting(contact.first_name);

    if (contact.newsletter_confirmed_at) {
      return html(
        `<h1 style="font-size:22px;font-weight:900;margin:0 0 12px;color:#fff;">You&rsquo;re already confirmed</h1>` +
          `<p style="font-size:14px;line-height:1.6;color:#94A3B8;margin:0;">${name}this address is already on the chapter bulletin list.</p>`
      );
    }

    const now = new Date().toISOString();
    const adminClient = await createAdminClient();
    const updatePayload: NewsletterContactUpdate = {
      do_not_email: false,
      newsletter_confirmed_at: now,
      newsletter_confirm_token: null,
      newsletter_confirm_expires_at: null,
      unsubscribed_at: null,
      tags: withNewsletterConfirmationTags(Array.isArray(contact.tags) ? contact.tags : []),
      updated_at: now,
    };
    const { data: confirmed, error } = await adminClient
      .from('crm_contacts')
      .update(updatePayload as unknown as CRMContactUpdate)
      .eq('id', contact.id)
      // Columns from the unapplied migration; `as never` keeps the generated
      // column union honest until `bun run types:generate` can include them.
      .eq('newsletter_confirm_token' as never, token ?? '')
      .gt('newsletter_confirm_expires_at' as never, now)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[newsletter-confirm] update failed:', error);
      return new NextResponse('Unable to confirm this subscription right now.', { status: 500 });
    }
    if (!confirmed) {
      return html(
        `<h1 style="font-size:22px;font-weight:900;margin:0 0 12px;color:#fff;">This link has expired</h1>` +
          `<p style="font-size:14px;line-height:1.6;color:#94A3B8;margin:0;">${name}request a new confirmation link from the subscription form on the news page.</p>`,
        410
      );
    }

    await adminClient.from('crm_activities').insert({
      contact_id: contact.id,
      type: 'note',
      title: 'Subscribed to Action Alerts',
      description: 'Confirmed newsletter subscription via email.',
      metadata: {
        channel: 'newsletter_confirmation',
        source: 'action_alerts',
        confirmed_at: now,
      },
    });

    return html(
      `<h1 style="font-size:22px;font-weight:900;margin:0 0 12px;color:#fff;">You&rsquo;re subscribed</h1>` +
        `<p style="font-size:14px;line-height:1.6;color:#94A3B8;margin:0;">${name}you will receive chapter bulletins and Action Alerts. Every bulletin includes a one-click unsubscribe link.</p>`
    );
  } catch (err) {
    console.error('[newsletter-confirm] failed:', err);
    return new NextResponse('Unable to process confirmation right now.', { status: 500 });
  }
}
