import { NextResponse } from 'next/server';
import { renderUnsubscribeGreeting } from '@/lib/crm-unsubscribe';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public one-click unsubscribe landing zone (RFC 8058).
 * GET renders a tiny branded confirmation; POST performs the opt-out and
 * returns 204 so mail clients can auto-confirm via List-Unsubscribe-Post.
 *
 * Abuse posture: token is a per-contact uuid (unguessable), and the update
 * is idempotent — replaying it cannot corrupt state beyond staying opted out.
 * Rate-limited to 20 / 10 min / IP as a courtesy against hammering.
 */
async function applyUnsubscribe(req: Request, token: string | null): Promise<NextResponse> {
  const gate = rateLimit(clientKey(req.headers, 'crm-unsubscribe'), 20, 600_000);
  if (!gate.ok) {
    return new NextResponse('Too many requests. Please retry shortly.', {
      status: 429,
      headers: { 'Retry-After': String(gate.retryAfterSec) },
    });
  }

  if (!token || !UUID_RE.test(token)) {
    return new NextResponse('Invalid unsubscribe link.', { status: 400 });
  }

  try {
    const adminClient = await createAdminClient();
    const { data: contact } = await adminClient
      .from('crm_contacts')
      .select('id, email, first_name, do_not_email')
      .eq('unsubscribe_token', token)
      .single();

    if (!contact) {
      return new NextResponse('This unsubscribe link is no longer valid.', { status: 404 });
    }

    if (!contact.do_not_email) {
      await adminClient
        .from('crm_contacts')
        .update({
          do_not_email: true,
          unsubscribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', contact.id);

      await adminClient.from('crm_activities').insert({
        contact_id: contact.id,
        type: 'note',
        title: 'Unsubscribed via Link',
        description: 'One-click unsubscribe from email broadcasts.',
      });
    }

    const name = renderUnsubscribeGreeting(contact.first_name);
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="robots" content="noindex,nofollow" /><title>Unsubscribed</title></head><body style="margin:0;background:#0F172A;font-family:system-ui,-apple-system,sans-serif;color:#E2E8F0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;"><div style="max-width:420px;text-align:center;"><div style="font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#60A5FA;margin-bottom:12px;">Indivisible Fair Oaks-Carmichael</div><h1 style="font-size:22px;font-weight:900;margin:0 0 12px;color:#fff;">You&rsquo;re unsubscribed</h1><p style="font-size:14px;line-height:1.6;color:#94A3B8;margin:0;">${name}you will no longer receive chapter email broadcasts. Transactional messages about your orders or account are unaffected.</p></div></body></html>`;

    if (req.method === 'POST') {
      return new NextResponse(null, {
        status: 204,
        headers: { 'X-Robots-Tag': 'noindex, nofollow' },
      });
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse('Unable to process unsubscribe right now.', { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return applyUnsubscribe(req, searchParams.get('token'));
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  let token: string | null = null;
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData().catch(() => null);
    token = typeof form?.get('token') === 'string' ? (form.get('token') as string) : null;
  }
  if (!token) {
    const { searchParams } = new URL(req.url);
    token = searchParams.get('token');
  }
  return applyUnsubscribe(req, token);
}
