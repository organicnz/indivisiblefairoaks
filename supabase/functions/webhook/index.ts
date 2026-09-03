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
    return 'wcoaqlglwxwceqktpckt.supabase.co'
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

  // 3. Link the Stripe customer id back to the profile when we can.
  if (session.customer) {
    await updateStripeCustomerId(supabase, session, log)
  }

  // 4. Fire the admin notification email (non-blocking — never fail the event).
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
  supabase: ReturnType<typeof createClient>,
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

  const customerId = await resolveCustomerId(supabase, session)
  const [billing, shipping] = buildAddresses(session)

  // The discount may be expanded to a full Coupon object (webhook payload) or
  // left as its id — record the human-readable code when we have it.
  const discount = session.discounts?.[0]?.coupon
  const couponCode =
    typeof discount === 'object' && discount !== null ? discount.name : null

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: customerId,
      stripe_session_id: session.id,
      coupon_code: couponCode,
      stripe_payment_intent_id: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
      status: 'processing',
      total_amount: (session.amount_total ?? 0) / 100,
      currency: session.currency?.toUpperCase() ?? 'NZD',
      payment_method: 'stripe',
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
  supabase: ReturnType<typeof createClient>,
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
    total: (item.amount_total ?? 0) / 100,
  }))

  const { error } = await supabase.from('order_items').insert(rows)
  if (error) {
    console.error(`[webhook:${session.id}] Order items insert failed:`, error.message)
    throw new Error(`Order items insert failed: ${error.message}`)
  }
  log(`Inserted ${rows.length} items for order #${orderId}`)
}

async function updateStripeCustomerId(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
  log: Logger,
) {
  const customerId = await resolveCustomerId(supabase, session)
  if (!customerId || typeof session.customer !== 'string') return

  const { error } = await supabase
    .from('profiles')
    .update({ stripe_customer_id: session.customer })
    .eq('id', customerId)

  if (error) log(`Failed to link Stripe customer to profile: ${error.message}`)
  else log(`Linked Stripe customer ${session.customer} to profile ${customerId}`)
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
  supabase: ReturnType<typeof createClient>,
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
  supabase: ReturnType<typeof createClient>,
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
  supabase: ReturnType<typeof createClient>,
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
async function resolveCustomerId(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
): Promise<number | null> {
  const userId = session.metadata?.userId
  if (userId && userId !== 'guest') {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    // DB failures must surface so the event retries rather than silently
    // creating a guest order for a registered customer.
    if (error) throw new Error(`Profile lookup by user_id failed: ${error.message}`)
    if (data) return data.id as number
  }

  const email = session.customer_details?.email
  if (!email) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (error) throw new Error(`Profile lookup by email failed: ${error.message}`)
  return (data?.id as number | undefined) ?? null
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
    ...(cust?.address ?? {}),
    ...custName,
    ...(cust?.phone ? { phone: cust.phone } : {}),
    ...(cust?.email ? { email: cust.email } : {}),
  }
  const shipping = {
    ...(ship?.address ?? {}),
    ...shipName,
    ...(cust?.email && !cust?.name && !ship?.name ? { email: cust.email } : {}),
  }

  return [billing, shipping] as const
}

// ---------------------------------------------------------------------------
// Admin order notification email via Resend
// ---------------------------------------------------------------------------
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

  const adminEmail = Deno.env.get('ADMIN_ORDER_EMAIL') ?? 'indivisible@indivisiblefairoaks.org'
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'orders@indivisiblefairoaks.org'
  const customer = session.customer_details
  const totalNZD = ((session.amount_total ?? 0) / 100).toFixed(2)
  const orderLabel = `#${orderId}`

  const shippingAddr = (session as Stripe.Checkout.Session & {
    shipping_details?: { address?: Record<string, string> }
  }).shipping_details?.address ?? customer?.address

  const addressLine = shippingAddr
    ? [
        shippingAddr.line1,
        shippingAddr.line2,
        shippingAddr.city,
        shippingAddr.state,
        shippingAddr.postal_code,
        shippingAddr.country,
      ].filter(Boolean).join(', ')
    : 'Not provided'

  const itemRows = lineItems.map((item) => {
    const name = item.description ?? 'Unknown item'
    const qty = item.quantity ?? 1
    const itemTotal = ((item.amount_total ?? 0) / 100).toFixed(2)
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid rgba(209,255,0,0.15);color:#fff;font-size:14px;">${name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid rgba(209,255,0,0.15);color:#fff;font-size:14px;text-align:center;">${qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid rgba(209,255,0,0.15);color:#D1FF00;font-size:14px;text-align:right;">$${itemTotal}</td>
    </tr>`
  }).join('')

  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : ''

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0A472E;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
        <tr>
          <td style="padding:32px 40px;text-align:center;border-bottom:1px solid rgba(209,255,0,0.2);">
            <img src="https://${SUPABASE_HOST}/storage/v1/object/public/media/wp-content/uploads/2021/10/logo.png" alt="Catch-22" width="160" style="display:block;margin:0 auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 4px;color:#D1FF00;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.2em;">New Order Received</p>
            <h2 style="margin:0 0 24px;color:#fff;font-size:22px;font-weight:900;">Order ${orderLabel} — $${totalNZD} NZD</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:rgba(0,0,0,0.25);border-radius:8px;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0 0 8px;color:#D1FF00;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;">Customer</p>
                <p style="margin:0 0 4px;color:#fff;font-size:14px;">${customer?.name ?? 'Guest'}</p>
                <p style="margin:0 0 4px;color:rgba(255,255,255,0.6);font-size:13px;">${customer?.email ?? 'No email'}</p>
                <p style="margin:0;color:rgba(255,255,255,0.6);font-size:13px;">${customer?.phone ?? ''}</p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:rgba(0,0,0,0.25);border-radius:8px;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0 0 8px;color:#D1FF00;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;">Ship To</p>
                <p style="margin:0;color:#fff;font-size:14px;line-height:1.6;">${addressLine}</p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:rgba(0,0,0,0.25);border-radius:8px;">
              <tr>
                <td style="padding:12px 12px 4px;color:#D1FF00;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;">Item</td>
                <td style="padding:12px 12px 4px;color:#D1FF00;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;text-align:center;">Qty</td>
                <td style="padding:12px 12px 4px;color:#D1FF00;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;text-align:right;">Total</td>
              </tr>
              ${itemRows}
              <tr>
                <td colspan="2" style="padding:12px;color:rgba(255,255,255,0.6);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Order Total</td>
                <td style="padding:12px;color:#D1FF00;font-size:16px;font-weight:900;text-align:right;">$${totalNZD} NZD</td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center">
                <a href="https://dashboard.stripe.com/payments/${paymentIntent}" style="display:inline-block;background:#D1FF00;color:#0A472E;font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:0.15em;text-decoration:none;padding:14px 32px;border-radius:9999px;">View in Stripe Dashboard</a>
              </td></tr>
            </table>
            <p style="margin:20px 0 0;color:rgba(255,255,255,0.3);font-size:11px;text-align:center;">Session: ${session.id}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(209,255,0,0.2);text-align:center;">
            <p style="margin:0;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Catch-22 &middot; Premium Fishing Gear &middot; New Zealand</p>
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
      subject: `🎣 New Order ${orderLabel} — $${totalNZD} NZD from ${customer?.name ?? 'Guest'}`,
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
