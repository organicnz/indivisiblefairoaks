import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase-server';
import { isFreshSvixTimestamp, verifySvixSignature } from '@/lib/svix-signature';
import type { Json } from '@/types/supabase';

/**
 * Resend delivery-event webhook.
 *
 * ## Signature verification
 *
 * Resend signs webhooks with HMAC-SHA256 using the webhook secret as the key.
 * The signed payload is `${svix-id}.${svix-timestamp}.${rawBody}`.
 * The signature arrives in the `svix-signature` header as `v1,<base64-sig>`
 * (potentially space-separated if multiple signatures are present).
 *
 * `crypto.subtle` is used directly — the svix package is not installed. The key
 * is the base64-decoded part after `whsec_`; see `src/lib/svix-signature.ts`.
 *
 * ## Replay protection
 *
 * Svix includes a seconds-since-epoch timestamp. A signature that verifies
 * against a stale timestamp is a captured webhook being replayed, so anything
 * older than five minutes is rejected before any write. Five minutes is Svix's
 * own tolerance, not an invention here.
 *
 * ## Event handling
 *
 * - **Suppressing events** set `do_not_email = true`, stamp `unsubscribed_at`
 *   (earliest evidence wins), log a `crm_activities` row, and record the event:
 *   - `email.bounced` **only when `bounce.type === 'Permanent'`**. Resend sends
 *     `email.bounced` for temporary bounces too (full inbox, greylisting), and
 *     opting somebody out permanently over a transient failure loses a
 *     supporter for nothing. A temporary bounce is recorded and changes nothing.
 *   - `email.complained` — the recipient marked it as spam.
 *   - `email.suppressed` — Resend dropped the send because the address is on its
 *     own suppression list. Without this the CRM keeps targeting addresses that
 *     Resend silently refuses to deliver to.
 * - `email.opened` / `email.clicked` / `email.delivery_delayed` → recorded
 *   only; `do_not_email` is untouched.
 *
 * ## Retries are deduplicated on `svix-id`
 *
 * Resend retries a delivery with the same `svix-id` and documents deduplicating
 * on it. `crm_email_events` is UNIQUE on `(svix_id, contact_id)`, so the event
 * insert is the claim: a duplicate-key error means this delivery was already
 * processed, and nothing further is written — no second row, no second
 * activity.
 *
 * ## Linking to the campaign
 *
 * `crm-broadcast-send` tags each message with our `broadcast_id`, which Resend
 * echoes back in `data.tags`. `data.broadcast_id` is *Resend's* broadcast id
 * and is not used. A tag that is not a UUID, or names no row, is recorded with
 * `broadcast_id = null` rather than refused — the delivery fact matters more
 * than the link.
 *
 * Unknown email addresses return 200 immediately. Resend must not retry on
 * addresses that simply aren't in our CRM (e.g. transactional recipients).
 *
 * ## Tri-state
 *
 * `do_not_email` is `false` (agreed), `true` (declined) or `NULL` (never
 * asked). Suppression fires when the stored value `!== true` — a never-asked
 * contact that bounces was asked (the mail went out) and the answer came back
 * as a hard failure, so it becomes `true`. An already-suppressed contact is
 * left alone: the event is still recorded, but no contact update and no
 * second activity row.
 *
 * ## This route does NOT call requireAdmin()
 *
 * It is an unauthenticated inbound webhook authenticated solely by the HMAC
 * signature. `createAdminClient()` is called directly, same as the Stripe
 * webhook handler. The only write it can perform in the suppress direction is
 * `do_not_email = true` — it can never set `false` or `NULL`, so a forged
 * event (which still needs the secret) is a mailing-list DoS, not a
 * re-subscription.
 */

// Map Resend event types to crm_email_events.event_type values.
const RESEND_TO_EVENT_TYPE: Record<string, string> = {
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.delivery_delayed': 'delivery_delayed',
  'email.suppressed': 'suppressed',
};

type Suppression = {
  activityType: 'email_bounced' | 'email_complained';
  title: string;
  description: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ResendEvent = {
  type: string;
  created_at?: string;
  data: {
    to?: string[] | string;
    email_id?: string;
    tags?: Record<string, string> | Array<{ name: string; value: string }>;
    bounce?: { type?: string; subType?: string };
    [key: string]: unknown;
  };
};

/** What, if anything, this event means for the contact's consent. */
function suppressionFor(event: ResendEvent): Suppression | null {
  switch (event.type) {
    case 'email.bounced':
      if (event.data.bounce?.type !== 'Permanent') return null;
      return {
        activityType: 'email_bounced',
        title: 'Email Bounced — Suppressed',
        description:
          'Resend reported a permanent bounce. Contact has been suppressed from future broadcasts.',
      };
    case 'email.complained':
      return {
        activityType: 'email_complained',
        title: 'Spam Complaint — Suppressed',
        description:
          'Resend reported a spam complaint. Contact has been suppressed from future broadcasts.',
      };
    case 'email.suppressed':
      // Recorded under the bounce type: crm_activities' CHECK has no separate
      // value, and a Resend suppression is a prior hard bounce or complaint.
      return {
        activityType: 'email_bounced',
        title: 'Address Suppressed by Resend',
        description:
          'Resend dropped a send because this address is on its suppression list. Contact has been suppressed from future broadcasts.',
      };
    default:
      return null;
  }
}

/** Our broadcast id from the echoed tags, in either shape Resend may use. */
function broadcastIdFrom(event: ResendEvent): string | null {
  const tags = event.data.tags;
  const value = Array.isArray(tags)
    ? tags.find((t) => t?.name === 'broadcast_id')?.value
    : tags?.broadcast_id;
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

function recipientsFrom(event: ResendEvent): string[] {
  const raw = event.data?.to;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [
    ...new Set(
      list
        .filter((r): r is string => typeof r === 'string')
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

export async function POST(req: Request): Promise<NextResponse> {
  // Rate-limit webhook replays (100/minute/IP).
  const gate = rateLimit(clientKey(req.headers, 'resend-webhook'), 100, 60_000);
  if (!gate.ok) {
    return new NextResponse('Too many requests.', {
      status: 429,
      headers: { 'Retry-After': String(gate.retryAfterSec) },
    });
  }

  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse('Webhook secret not configured.', { status: 400 });
  }

  const svixId = req.headers.get('svix-id') ?? '';
  const svixTimestamp = req.headers.get('svix-timestamp') ?? '';
  const svixSignature = req.headers.get('svix-signature') ?? '';

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse('Missing signature headers.', { status: 400 });
  }

  if (!isFreshSvixTimestamp(svixTimestamp)) {
    return new NextResponse('Stale webhook timestamp.', { status: 400 });
  }

  const rawBody = await req.text();

  const valid = await verifySvixSignature(secret, svixId, svixTimestamp, rawBody, svixSignature);
  if (!valid) {
    return new NextResponse('Invalid signature.', { status: 400 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Invalid JSON body.', { status: 400 });
  }

  const eventType = RESEND_TO_EVENT_TYPE[event.type];
  if (!eventType || !event.data) {
    // Unknown event type — ack it so Resend doesn't keep retrying.
    return new NextResponse(null, { status: 200 });
  }

  const recipients = recipientsFrom(event);
  if (recipients.length === 0) {
    return new NextResponse(null, { status: 200 });
  }

  const adminClient = await createAdminClient();
  const now = new Date().toISOString();
  const occurredAt =
    typeof event.created_at === 'string' && !Number.isNaN(Date.parse(event.created_at))
      ? event.created_at
      : now;
  const providerId = typeof event.data.email_id === 'string' ? event.data.email_id : null;
  const broadcastId = broadcastIdFrom(event);
  const suppression = suppressionFor(event);

  for (const email of recipients) {
    // Unknown addresses are skipped, not refused — Resend must not retry on
    // transactional recipients who were never in the CRM. Emails are stored
    // lowercase, so the lookup lowercases too.
    const { data: contact } = await adminClient
      .from('crm_contacts')
      .select('id, do_not_email, unsubscribed_at')
      .eq('email', email)
      .maybeSingle();
    if (!contact) continue;

    const row = {
      contact_id: contact.id,
      broadcast_id: broadcastId,
      event_type: eventType,
      provider_id: providerId,
      svix_id: svixId,
      metadata: (event.data ?? {}) as Json,
      occurred_at: occurredAt,
    };
    let { error } = await adminClient.from('crm_email_events').insert(row);
    // 23503: the tagged campaign does not exist (deleted, or a foreign tag).
    // Keep the delivery fact, drop the link.
    if (error?.code === '23503' && broadcastId) {
      ({ error } = await adminClient
        .from('crm_email_events')
        .insert({ ...row, broadcast_id: null }));
    }
    // 23505: this (svix-id, contact) was already processed — a retry. The insert
    // is the claim, so stop here rather than writing a second activity.
    if (error?.code === '23505') continue;

    // `!== true` is the tri-state: both `false` (agreed) and `NULL` (never
    // asked) become suppressed; an already-`true` row is left alone.
    if (!suppression || (contact.do_not_email as boolean | null) === true) continue;

    await adminClient
      .from('crm_contacts')
      .update({
        do_not_email: true,
        // Earliest evidence wins: a contact suppressed before keeps its date.
        unsubscribed_at: (contact.unsubscribed_at as string | null) ?? now,
        updated_at: now,
      })
      .eq('id', contact.id);

    await adminClient.from('crm_activities').insert({
      contact_id: contact.id,
      type: suppression.activityType,
      title: suppression.title,
      description: suppression.description,
      metadata: { provider_id: providerId, event: event.type, svix_id: svixId } as Json,
    });
  }

  return new NextResponse(null, { status: 200 });
}
