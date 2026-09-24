// @deno-types="npm:@hono/hono@^5.0.0"
// @deno-types="npm:@stripe/stripe-js@^9.0.0"
// @deno-types="npm:@supabase/supabase-js@^2.0.0"
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Hono } from 'jsr:@hono/hono'
import { HTTPException } from 'jsr:@hono/hono/http-exception'
import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Boot-time environment validation — fail fast instead of crashing mid-request
// ---------------------------------------------------------------------------
const REQUIRED_ENV: [string, string | undefined][] = [
  ['STRIPE_SECRET_KEY', Deno.env.get('STRIPE_SECRET_KEY')],
  ['STRIPE_WEBHOOK_SECRET', Deno.env.get('STRIPE_WEBHOOK_SECRET')],
  ['SUPABASE_URL', Deno.env.get('SUPABASE_URL')],
  ['SUPABASE_SERVICE_ROLE_KEY', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')],
]

for (const [name, value] of REQUIRED_ENV) {
  if (!value) {
    throw new Error(`Webhook function is missing required environment variable: ${name}`)
  }
}

const STRIPE_SECRET_KEY = REQUIRED_ENV[0][1]!
const STRIPE_WEBHOOK_SECRET = REQUIRED_ENV[1][1]!
const SUPABASE_URL = REQUIRED_ENV[2][1]!
const SUPABASE_SERVICE_ROLE_KEY = REQUIRED_ENV[3][1]!

// ---------------------------------------------------------------------------
// Stripe client — module-level, reused across invocations
// ---------------------------------------------------------------------------
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  // @ts-ignore — acacia is a valid API version
  apiVersion: '2025-02-24.acacia',
})

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

// Storage host for email assets (logo) — derived so a project fork needs no code change.
const SUPABASE_HOST = (() => {
  try {
    return new URL(SUPABASE_URL).hostname
  } catch {
    return 'mojsubkqjdruhpxbzgme.supabase.co'
  }
})()

// PostgreSQL unique-violation error code (used for race-safe idempotency)
const PG_UNIQUE_VIOLATION = '23505'

type Logger = (message: string) => void

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------
const app = new Hono()

// NOTE: the Supabase gateway only forwards POST to this function and the
// runtime passes the full prefixed path — match any path ending in /health so
// uptime monitors can ping it regardless of the deployment slug.
app.use('*', async (c, next) => {
  if (c.req.method === 'POST' && c.req.path.endsWith('/health')) {
    return c.json({ ok: true, service: 'webhook', ts: Date.now() })
  }
  await next()
})

app.post('*', async (c) => {
  const body = await c.req.text()
  const signature = c.req.header('stripe-signature')
  if (!signature) {
    throw new HTTPException(400, { message: 'Missing stripe-signature header' })
  }

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Webhook signature verification failed: ${message}`)
    throw new HTTPException(400, { message: 'Webhook Error: invalid signature' })
  }

  const log: Logger = (message) =>
    console.log(`[webhook:${event.id}] ${message}`)

  log(`Event received: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, log)
        break
      case 'checkout.session.expired':
        await handleSessionFailed(event.data.object as Stripe.Checkout.Session, log)
        break
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent, log)
        break
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge, log)
        break
      default:
        // Stripe expects a 2xx for unhandled events so it doesn't retry them
        log(`Unhandled event type — acknowledging`)
    }
  } catch (err: unknown) {
    // Any failure here returns a 500 so Stripe retries the event (3 days backoff)
    console.error(`[webhook:${event.id}] Processing failed:`, err)
    throw new HTTPException(500, { message: 'Event processing failed — will retry' })
  }

  return c.json({ received: true, id: event.id })
})

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  console.error('Unhandled webhook error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

Deno.serve(app.fetch)

// ---------------------------------------------------------------------------
// checkout.session.completed handler — idempotent, retry-safe fulfillment
// ---------------------------------------------------------------------------
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  log: Logger,
) {
  // Only fulfill real, paid, one-off purchases. Anything else is acknowledged
  // and ignored so we never create orders for failed or refunded payments.
  if (session.mode !== 'payment' || session.payment_status !== 'paid') {
    log(
      `Skipping fulfillment — mode=${session.mode} payment_status=${session.payment_status}`,
    )
    return
  }

  if (!session.amount_total || session.amount_total <= 0) {
    log(`Skipping fulfillment — invalid amount_total=${session.amount_total}`)
    return
  }

  const supabase = supabaseAdmin()

  // 1. Order row — insert or reuse (handles webhook retries AND concurrent
  //    deliveries of the same event via the unique session index).
  const orderId = await ensureOrder(supabase, session, log)

  // 2. Order items — backfilled if missing so a partially-failed earlier
  //    attempt converges to a complete order on retry.
  await ensureOrderItems(supabase, orderId, session, log)

  // 3. Fire the admin notification email (non-blocking — never fail the event).
  stripe.checkout.sessions
    .listLineItems(session.id, { limit: 100 })
    .then((items) =>
      sendAdminNotification(session, items.data, orderId).catch((err) =>
        console.error(`[webhook:${session.id}] Email notification failed:`, err)
      )
    )
    .catch((err) =>
      console.error(`[webhook:${session.id}] Line item fetch for email failed:`, err)
    )
}

// ---------------------------------------------------------------------------
// Fulfillment primitives
// ---------------------------------------------------------------------------
async function ensureOrder(
  supabase: ReturnType<typeof supabaseAdmin>,
  session: Stripe.Checkout.Session,
  log: Logger,
): Promise<number> {
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_session_id', session.id)
    .maybeSingle()

  if (existing) {
    log(`Order #${existing.id} already exists — reusing`)
    return existing.id as number
  }

  const userId = await resolveUserId(session)
  const [billing, shipping] = buildAddresses(session)

  // The discount may be expanded to a full Coupon object (webhook payload) or
  // left as its id — record the human-readable code when we have it.
  const discount = session.discounts?.[0]?.coupon
  const couponCode =
    typeof discount === 'object' && discount !== null ? discount.name : null

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      stripe_session_id: session.id,
      coupon_code: couponCode,
      stripe_payment_intent_id: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
      status: 'processing',
      total: (session.amount_total ?? 0) / 100,
      currency: session.currency?.toLowerCase() ?? 'usd',
      metadata:
        typeof session.customer === 'string' ? { stripe_customer_id: session.customer } : {},
      billing_address: billing,
      shipping_address: shipping,
      created_at: new Date(session.created * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (!orderError) {
    log(`Created order #${order.id}`)
    return order.id as number
  }

  // A concurrent delivery may have won the race — the unique index on
  // stripe_session_id turns that into a clean, recoverable state.
  if (
    (orderError as { code?: string }).code === PG_UNIQUE_VIOLATION ||
    /duplicate key/i.test(orderError.message)
  ) {
    const { data: raced } = await supabase
      .from('orders')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle()

    if (raced) {
      log(`Race detected — reusing concurrently created order #${raced.id}`)
      return raced.id as number
    }
  }

  // Real failure — throw so Stripe retries the event
  console.error(`[webhook:${session.id}] Order insert failed:`, orderError.message)
  throw new Error(`Order insert failed: ${orderError.message}`)
}

async function ensureOrderItems(
  supabase: ReturnType<typeof supabaseAdmin>,
  orderId: number,
  session: Stripe.Checkout.Session,
  log: Logger,
) {
  const { count, error: countError } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)

  if (countError) {
    throw new Error(`Order item count failed: ${countError.message}`)
  }
  if (count && count > 0) {
    log(`Order #${orderId} already has ${count} items — skipping`)
    return
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
  })

  const rows = lineItems.data.map((item) => ({
    order_id: orderId,
    product_name: item.description ?? 'Unknown item',
    quantity: item.quantity ?? 1,
    unit_price: (item.amount_total ?? 0) / 100 / (item.quantity ?? 1),
  }))

  const { error } = await supabase.from('order_items').insert(rows)
  if (error) {
    console.error(`[webhook:${session.id}] Order items insert failed:`, error.message)
    throw new Error(`Order items insert failed: ${error.message}`)
  }
  log(`Inserted ${rows.length} items for order #${orderId}`)
}

// ---------------------------------------------------------------------------
// Status transitions — session expired / payment failed / refunded
// ---------------------------------------------------------------------------
async function handleSessionFailed(
  session: Stripe.Checkout.Session,
  log: Logger,
) {
  const supabase = supabaseAdmin()
  const order = await findOrderBySession(supabase, session.id, log)
  if (!order) return
  if (order.status === 'refunded' || order.status === 'completed') return
  await setOrderStatus(supabase, order.id, 'cancelled', 'checkout.session.expired', log)
}

async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  log: Logger,
) {
  const supabase = supabaseAdmin()
  const order = await findOrderByPaymentIntent(supabase, paymentIntent.id, log)
  if (!order) return
  if (order.status === 'refunded' || order.status === 'completed') return
  await setOrderStatus(supabase, order.id, 'cancelled', 'payment_intent.payment_failed', log)
}

async function handleChargeRefunded(
  charge: Stripe.Charge,
  log: Logger,
) {
  const supabase = supabaseAdmin()

  // `charge.refunded` fires for PARTIAL refunds too — only downgrade the order
  // when the charge is actually fully refunded.
  if (!(charge.refunded && charge.amount_refunded >= charge.amount)) {
    log(
      `Partial refund (${charge.amount_refunded}/${charge.amount}) — order stays as-is`,
    )
    return
  }

  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : (charge.payment_intent?.id ?? null)
  if (!paymentIntentId) {
    log('Refunded charge has no payment intent — skipping')
    return
  }

  const order = await findOrderByPaymentIntent(supabase, paymentIntentId, log)
  if (!order) return
  if (order.status === 'cancelled') return
  await setOrderStatus(supabase, order.id, 'refunded', 'charge.refunded', log)
}

async function findOrderBySession(
  supabase: ReturnType<typeof supabaseAdmin>,
  sessionId: string,
  log: Logger,
) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()

  if (error) {
    log(`Order lookup failed: ${error.message}`)
    return null
  }
  return data
}

async function findOrderByPaymentIntent(
  supabase: ReturnType<typeof supabaseAdmin>,
  paymentIntentId: string,
  log: Logger,
) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle()

  if (error) {
    log(`Order lookup failed: ${error.message}`)
    return null
  }
  return data
}

async function setOrderStatus(
  supabase: ReturnType<typeof supabaseAdmin>,
  orderId: number,
  status: string,
  reason: string,
  log: Logger,
) {
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
  if (error) {
    log(`Failed to set order #${orderId} to '${status}': ${error.message}`)
  } else {
    log(`Order #${orderId} -> ${status} (${reason})`)
  }
}

// ---------------------------------------------------------------------------
// Customer resolution + address shaping
// ---------------------------------------------------------------------------
async function resolveUserId(session: Stripe.Checkout.Session): Promise<string | null> {
  const userId = session.metadata?.userId || session.client_reference_id
  if (!userId || userId === 'guest' || !/^[0-9a-f-]{36}$/i.test(userId)) return null
  return userId
}

// Split "First Last" into first_name/last_name, preserving the legacy shape
function splitName(fullName: string | null | undefined) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: null, last_name: null }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') || null }
}

// Merge Stripe customer/shipping details into the WooCommerce-style address
// payload so guest orders carry email, name and phone for fulfillment
function buildAddresses(session: Stripe.Checkout.Session) {
  const cust = session.customer_details
  const ship = session.shipping_details
  const custName = splitName(cust?.name ?? ship?.name)
  const shipName = splitName(ship?.name)

  const billing = {
    ...cust?.address,
    ...custName,
    ...(cust?.phone && { phone: cust.phone }),
    ...(cust?.email && { email: cust.email }),
  }
  const shipping = {
    ...ship?.address,
    ...shipName,
    ...(cust?.email && !cust?.name && !ship?.name && { email: cust.email }),
  }

  return [billing, shipping] as const
}

// ---------------------------------------------------------------------------
// Admin order notification email via Resend
// ---------------------------------------------------------------------------
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendAdminNotification(
  session: Stripe.Checkout.Session,
  lineItems: Stripe.LineItem[],
  orderId: number,
) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.warn(`[webhook:${session.id}] RESEND_API_KEY not set — skipping order notification email`)
    return
  }

  const adminEmail = Deno.env.get('ADMIN_ORDER_EMAIL') ?? 'contact@indivisiblefairoaks.org'
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'contact@indivisiblefairoaks.org'
  const customer = session.customer_details
  const currency = (session.currency ?? 'usd').toUpperCase()
  const totalAmount = ((session.amount_total ?? 0) / 100).toFixed(2)
  const orderLabel = `#${orderId}`

  const shippingAddr = (session as Stripe.Checkout.Session & {
    shipping_details?: { address?: Record<string, string> }
  }).shipping_details?.address ?? customer?.address

  const addressLine = shippingAddr
    ? escapeHtml(
        [
          shippingAddr.line1,
          shippingAddr.line2,
          shippingAddr.city,
          shippingAddr.state,
          shippingAddr.postal_code,
          shippingAddr.country,
        ]
          .filter(Boolean)
          .join(', ')
      )
    : 'Not provided'

  const itemRows = lineItems.map((item) => {
    const name = escapeHtml(item.description ?? 'Unknown item')
    const qty = Number(item.quantity ?? 1)
    const itemTotal = ((item.amount_total ?? 0) / 100).toFixed(2)
    return `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.08);color:#F1F5F9;font-size:14px;">${name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.08);color:#94A3B8;font-size:14px;text-align:center;">${qty}</td>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.08);color:#60A5FA;font-size:14px;font-weight:700;text-align:right;">$${itemTotal}</td>
    </tr>`
  }).join('')

  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : ''

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:40px 16px;background:#0F172A;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#1E293B;border-radius:24px;overflow:hidden;max-width:580px;border:1px solid rgba(37,99,235,0.25);box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
        <tr>
          <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,#172554 0%,#1E293B 100%);">
            <a href="https://indivisiblefairoaks.org" target="_blank" style="text-decoration:none;display:inline-block;">
              <img src="https://${SUPABASE_HOST}/storage/v1/object/public/media/wp-content/uploads/2021/10/logo.png" alt="Indivisible Fair Oaks-Carmichael" width="170" style="display:block;margin:0 auto 12px;max-width:170px;height:auto;" />
            </a>
            <div style="display:inline-block;padding:5px 14px;background:rgba(37,99,235,0.2);border:1px solid rgba(59,130,246,0.35);color:#93C5FD;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;border-radius:9999px;">Store Order Notification</div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 28px;">
            <h2 style="margin:0 0 20px;color:#FFFFFF;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.01em;">Order ${orderLabel} — $${totalAmount} ${currency}</h2>
            
            <div style="margin-bottom:18px;background:#0F172A;border-radius:14px;border:1px solid rgba(37,99,235,0.2);padding:18px 20px;">
              <p style="margin:0 0 8px;color:#93C5FD;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.18em;">Customer</p>
              <p style="margin:0 0 4px;color:#FFFFFF;font-size:15px;font-weight:600;">${escapeHtml(customer?.name ?? 'Guest')}</p>
              <p style="margin:0 0 4px;color:#CBD5E1;font-size:13px;">${escapeHtml(customer?.email ?? 'No email')}</p>
              <p style="margin:0;color:#94A3B8;font-size:13px;">${escapeHtml(customer?.phone ?? '')}</p>
            </div>

            <div style="margin-bottom:20px;background:#0F172A;border-radius:14px;border:1px solid rgba(37,99,235,0.2);padding:18px 20px;">
              <p style="margin:0 0 8px;color:#93C5FD;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.18em;">Shipping Address</p>
              <p style="margin:0;color:#CBD5E1;font-size:14px;line-height:1.6;">${addressLine}</p>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;background:#0F172A;border-radius:14px;border:1px solid rgba(37,99,235,0.2);overflow:hidden;">
              <tr style="background:rgba(37,99,235,0.12);">
                <td style="padding:12px 14px;color:#93C5FD;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;">Item</td>
                <td style="padding:12px 14px;color:#93C5FD;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;text-align:center;">Qty</td>
                <td style="padding:12px 14px;color:#93C5FD;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;text-align:right;">Total</td>
              </tr>
              ${itemRows}
              <tr>
                <td colspan="2" style="padding:14px;color:#94A3B8;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;">Order Total</td>
                <td style="padding:14px;color:#60A5FA;font-size:17px;font-weight:900;text-align:right;">$${totalAmount} ${currency}</td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" width="100%" role="presentation">
              <tr><td align="center" style="padding-top:6px;">
                <a href="https://dashboard.stripe.com/payments/${encodeURIComponent(paymentIntent)}" target="_blank" style="display:inline-block;background:#2563EB;color:#FFFFFF;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:0.16em;text-decoration:none;padding:15px 34px;border-radius:9999px;box-shadow:0 4px 14px rgba(37,99,235,0.4);border:1px solid rgba(255,255,255,0.15);">View in Stripe Dashboard</a>
              </td></tr>
            </table>
            <p style="margin:18px 0 0;color:#64748B;font-size:11px;text-align:center;">Stripe Session: ${escapeHtml(session.id)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 40px;border-top:1px solid rgba(255,255,255,0.08);background:#0F172A;text-align:center;">
            <p style="margin:0;color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Indivisible Fair Oaks-Carmichael &middot; Grassroots Democracy</p>
            <p style="margin:6px 0 0;color:#64748B;font-size:11px;">Sacramento County, California</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: adminEmail,
      subject: `New Order ${orderLabel} — $${totalAmount} ${currency} from ${escapeHtml(customer?.name ?? 'Guest')}`,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[webhook:${session.id}] Failed to send order notification email:`, err)
  } else {
    console.log(`[webhook:${session.id}] Order notification sent to ${adminEmail} for order ${orderLabel}`)
  }
}
