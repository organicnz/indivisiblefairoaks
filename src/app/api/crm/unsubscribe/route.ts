import { NextResponse } from 'next/server';
import { renderUnsubscribeGreeting } from '@/lib/crm-unsubscribe';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public unsubscribe (RFC 8058 one-click, plus a human confirmation step).
 *
 * ## A GET must never change state here
 *
 * The obvious implementation — render the "you're unsubscribed" page and write
 * `do_not_email` on the way past — is a mass-unsubscribe waiting to happen.
 * **Corporate mail security scanners fetch every URL in an inbound message**
 * (Proofpoint, Barracuda, Microsoft Safe Links, Proofpoint TAP), and most web
 * clients and chat clients prefetch links on hover. Any of them turns "the
 * recipient clicked unsubscribe" into "the recipient's mail gateway clicked
 * unsubscribe", and a chapter that sends 5,000 broadcasts has 5,000 gateways
 * watching for exactly that URL.
 *
 * So the two methods do genuinely different things:
 *
 *   - **GET** looks the contact up and renders a confirmation page. It writes
 *     nothing. Safe to be fetched by anything.
 *   - **POST** performs the opt-out. Two shapes, distinguished by the body
 *     rather than by sniffing headers:
 *       - a browser form carrying `confirm=1` gets the confirmation page back;
 *       - an RFC 8058 `List-Unsubscribe-Post` auto-confirm has no body, and
 *         gets `204`.
 *
 * Distinguishing on the body is deliberate. Inferring it from `Accept` or a
 * user-agent is the kind of cleverness that silently starts returning 204 to a
 * real person when a mail client changes a header, and the failure mode is a
 * subscriber who sees nothing happen and assumes it worked — or does not.
 *
 * ## Abuse posture
 *
 * The token is a per-contact uuid (122 bits of v4, unguessable), and the write
 * is idempotent: replaying it cannot move the row back to subscribed. Rate
 * limited to 20 / 10 min / IP.
 *
 * The token is deliberately *not* rotated on re-subscribe. Rotating it would
 * break the link in every historical broadcast the contact still has, and a
 * member who has deliberately re-subscribed is not being attacked by their own
 * old email. See `docs/crm-operations.md`.
 */
const PAGE = (body: string) =>
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="robots" content="noindex,nofollow" /><title>Indivisible Fair Oaks-Carmichael</title></head><body style="margin:0;background:#0F172A;font-family:system-ui,-apple-system,sans-serif;color:#E2E8F0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;"><div style="max-width:460px;text-align:center;"><div style="font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#60A5FA;margin-bottom:12px;">Indivisible Fair Oaks-Carmichael</div>${body}</div></body></html>`;

const NO_INDEX = { 'X-Robots-Tag': 'noindex, nofollow' };

/** Shared gate and token check. Returns the contact row, or a ready response. */
type Contact = { id: string; email: string; first_name: string | null };

async function resolve(
  req: Request,
  token: string | null
): Promise<{ contact: Contact } | { response: NextResponse }> {
  const gate = rateLimit(clientKey(req.headers, 'crm-unsubscribe'), 20, 600_000);
  if (!gate.ok) {
    return {
      response: new NextResponse('Too many requests. Please retry shortly.', {
        status: 429,
        headers: { 'Retry-After': String(gate.retryAfterSec) },
      }),
    };
  }

  if (!token || !UUID_RE.test(token)) {
    return { response: new NextResponse('Invalid unsubscribe link.', { status: 400 }) };
  }

  const adminClient = await createAdminClient();
  const { data: contact } = await adminClient
    .from('crm_contacts')
    .select('id, email, first_name, do_not_email')
    .eq('unsubscribe_token', token)
    .single();

  if (!contact) {
    return {
      response: new NextResponse('This unsubscribe link is no longer valid.', { status: 404 }),
    };
  }
  return { contact: contact as Contact };
}

const html = (body: string) =>
  new NextResponse(PAGE(body), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...NO_INDEX,
    },
  });

/**
 * Renders the confirmation step. Writes nothing, so a link scanner, a prefetcher
 * or a chat client fetching this URL leaves the contact exactly as it was.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  try {
    const resolved = await resolve(req, token);
    if ('response' in resolved) return resolved.response;
    const name = renderUnsubscribeGreeting(resolved.contact.first_name);
    const confirmUrl = `/api/crm/unsubscribe?token=${encodeURIComponent(token ?? '')}`;

    return html(
      `<h1 style="font-size:22px;font-weight:900;margin:0 0 12px;color:#fff;">Stop chapter emails?</h1>` +
        `<p style="font-size:14px;line-height:1.6;color:#94A3B8;margin:0 0 24px;">${name}confirm and you will no longer receive chapter email broadcasts. Transactional messages about your orders or account are unaffected.</p>` +
        // A real form, not a link. A link would be a GET, and a GET must not
        // change state here.
        `<form method="post" action="${confirmUrl}">` +
        `<input type="hidden" name="token" value="${token ?? ''}" />` +
        `<input type="hidden" name="confirm" value="1" />` +
        `<button type="submit" style="font:inherit;font-size:14px;font-weight:800;letter-spacing:0.02em;color:#fff;background:#155DFC;border:0;border-radius:10px;padding:12px 22px;cursor:pointer;">Unsubscribe me</button>` +
        `</form>` +
        `<p style="font-size:12px;line-height:1.6;color:#64748B;margin:24px 0 0;">We only ask you to confirm because some mail security software opens every link in an email automatically, and we would rather not unsubscribe you by accident.</p>`
    );
  } catch {
    return new NextResponse('Unable to process unsubscribe right now.', { status: 500 });
  }
}

/** Performs the opt-out. The only method that writes. */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const contentType = req.headers.get('content-type') || '';
  let token = searchParams.get('token');
  let fromBrowserForm = false;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData().catch(() => null);
    const fromBody = form?.get('token');
    if (typeof fromBody === 'string' && fromBody) token = fromBody;
    // The marker the GET page's own form sends. Its absence is what identifies
    // an RFC 8058 auto-confirm, which posts the same URL with an empty body.
    if (form?.get('confirm') === '1') fromBrowserForm = true;
  }

  try {
    const resolved = await resolve(req, token);
    if ('response' in resolved) return resolved.response;
    const { contact } = resolved;

    // Idempotent, and deliberately so: the RFC 8058 auto-confirm and a person
    // clicking twice must both land here with no second activity row.
    const adminClient = await createAdminClient();
    const { data: current } = await adminClient
      .from('crm_contacts')
      .select('do_not_email')
      .eq('id', contact.id)
      .single();

    if (!current?.do_not_email) {
      const now = new Date().toISOString();
      await adminClient
        .from('crm_contacts')
        .update({ do_not_email: true, unsubscribed_at: now, updated_at: now })
        .eq('id', contact.id);

      await adminClient.from('crm_activities').insert({
        contact_id: contact.id,
        type: 'note',
        title: 'Unsubscribed via Link',
        description: 'Unsubscribed from email broadcasts via the confirmation link.',
      });
    }

    // RFC 8058: a `List-Unsubscribe-Post` auto-confirm wants 204 and no body.
    if (!fromBrowserForm) {
      return new NextResponse(null, { status: 204, headers: NO_INDEX });
    }

    const name = renderUnsubscribeGreeting(contact.first_name);
    return html(
      `<h1 style="font-size:22px;font-weight:900;margin:0 0 12px;color:#fff;">You&rsquo;re unsubscribed</h1>` +
        `<p style="font-size:14px;line-height:1.6;color:#94A3B8;margin:0;">${name}you will no longer receive chapter email broadcasts. Transactional messages about your orders or account are unaffected.</p>`
    );
  } catch {
    return new NextResponse('Unable to process unsubscribe right now.', { status: 500 });
  }
}
