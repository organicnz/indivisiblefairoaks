// @deno-types="npm:@hono/hono@^5.0.0"
// @deno-types="npm:@stripe/stripe-js@^9.0.0"
// @deno-types="npm:@supabase/supabase-js@^2.0.0"
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Hono } from 'jsr:@hono/hono'
import { cors } from 'jsr:@hono/hono/cors'
import { HTTPException } from 'jsr:@hono/hono/http-exception'
import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getStripeShippingOptions } from '../_shared/shipping.ts'

// ---------------------------------------------------------------------------
// Boot-time environment validation — fail fast with a clear message
// ---------------------------------------------------------------------------
const REQUIRED_ENV: [string, string | undefined][] = [
  ['STRIPE_SECRET_KEY', Deno.env.get('STRIPE_SECRET_KEY')],
  ['SUPABASE_URL', Deno.env.get('SUPABASE_URL')],
  ['SUPABASE_SERVICE_ROLE_KEY', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')],
  ['SUPABASE_ANON_KEY', Deno.env.get('SUPABASE_ANON_KEY')],
]

for (const [name, value] of REQUIRED_ENV) {
  if (!value) {
    throw new Error(`Checkout function is missing required environment variable: ${name}`)
  }
}

const STRIPE_SECRET_KEY = REQUIRED_ENV[0][1]!
const SUPABASE_URL = REQUIRED_ENV[1][1]!
const SUPABASE_SERVICE_ROLE_KEY = REQUIRED_ENV[2][1]!
const SUPABASE_ANON_KEY = REQUIRED_ENV[3][1]!

// ---------------------------------------------------------------------------
// Stripe client — module-level, reused across invocations
// ---------------------------------------------------------------------------
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  // @ts-ignore — acacia is a valid API version
  apiVersion: '2025-02-24.acacia',
})

// ---------------------------------------------------------------------------
// Limits — defence in depth against abuse / API abuse
// ---------------------------------------------------------------------------
const MAX_LINE_ITEMS = 50
const MAX_QUANTITY_PER_ITEM = 50

type NormalizedItem = { id: number; quantity: number }

const app = new Hono()

const APP_URL = Deno.env.get('APP_URL') ?? 'https://indivisiblefairoaks.org'

app.use(
  '/*',
  cors({
    origin: APP_URL,
    allowHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
    allowMethods: ['POST', 'OPTIONS'],
  }),
)

app.post('*', async (c) => {
  const body = await c.req.json<{
    items?: unknown
    promoCode?: unknown
  }>()

  // 1. Normalize + validate the cart strictly (no client-supplied prices/names)
  const items = normalizeCart(body.items)

  // 2. Validate the promo code shape up front
  const promoCode = normalizePromoCode(body.promoCode)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 3. Resolve auth + fetch DB products in parallel
  const authHeader = c.req.header('Authorization')
  const [userResult, dbResult] = await Promise.all([
    resolveUser(authHeader),
    supabase
      .from('products')
      .select('id, name, price, stripe_price_id')
      .in('id', items.map((i) => i.id)),
  ])

  const { userEmail, userId } = userResult
  const { data: dbProducts, error: dbError } = dbResult

  if (dbError || !dbProducts) {
    throw new HTTPException(500, { message: 'Failed to validate cart items' })
  }

  // 4. Every item MUST resolve to a real product with a valid server-side price
  const productMap = new Map(dbProducts.map((p) => [p.id, p]))
  const lineItems = items.map(({ id, quantity }) => {
    const dbProduct = productMap.get(id)
    if (!dbProduct) {
      throw new HTTPException(400, { message: `Product not found: ${id}` })
    }

    if (dbProduct.stripe_price_id) {
      return { price: dbProduct.stripe_price_id, quantity }
    }

    const serverPrice = Number(dbProduct.price)
    if (!Number.isFinite(serverPrice) || serverPrice <= 0) {
      throw new HTTPException(400, { message: `Product has no valid price: ${id}` })
    }

    return {
      price_data: {
        currency: 'nzd',
        product_data: { name: dbProduct.name },
        unit_amount: Math.round(serverPrice * 100),
      },
      quantity,
    }
  })

  // 5. Resolve the promo code to a reusable Stripe coupon
  const discounts = promoCode
    ? [{ coupon: await resolveStripeCoupon(supabase, promoCode) }]
    : undefined

  // 6. Create the Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'link'],
    line_items: lineItems,
    mode: 'payment',
    currency: 'nzd',
    customer_email: userEmail,
    client_reference_id: userId,
    metadata: { userId: userId ?? 'guest' },
    discounts,
    success_url: `${APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/cart`,
    billing_address_collection: 'required',
    shipping_address_collection: { allowed_countries: ['NZ'] },
    phone_number_collection: { enabled: true },
    shipping_options: getStripeShippingOptions(),
  })

  return c.json({ sessionId: session.id, url: session.url })
})

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  const message = err instanceof Error ? err.message : 'Unknown error'
  console.error('Checkout error:', message)
  return c.json({ error: 'Checkout failed. Please try again.' }, 500)
})

Deno.serve(app.fetch)

// ---------------------------------------------------------------------------
// Cart validation
// ---------------------------------------------------------------------------
function normalizeCart(raw: unknown): NormalizedItem[] {
  if (!Array.isArray(raw)) {
    throw new HTTPException(400, { message: 'Invalid cart payload' })
  }
  if (raw.length === 0) {
    throw new HTTPException(400, { message: 'Cart is empty' })
  }
  if (raw.length > MAX_LINE_ITEMS) {
    throw new HTTPException(400, { message: `Cart exceeds ${MAX_LINE_ITEMS} line items` })
  }

  const merged = new Map<number, number>()
  for (const rawItem of raw) {
    if (typeof rawItem !== 'object' || rawItem === null) {
      throw new HTTPException(400, { message: 'Invalid item entry' })
    }
    const item = rawItem as Record<string, unknown>
    const id = item.id
    const quantity = item.quantity

    if (!Number.isInteger(id) || (id as number) <= 0) {
      throw new HTTPException(400, { message: 'Invalid item id' })
    }
    if (
      !Number.isInteger(quantity) ||
      (quantity as number) < 1 ||
      (quantity as number) > MAX_QUANTITY_PER_ITEM
    ) {
      throw new HTTPException(400, {
        message: `Quantity must be an integer between 1 and ${MAX_QUANTITY_PER_ITEM}`,
      })
    }

    // Dedupe repeated product ids by summing quantities
    const previous = merged.get(id as number) ?? 0
    merged.set(id as number, Math.min(previous + (quantity as number), MAX_QUANTITY_PER_ITEM))
  }

  return Array.from(merged, ([id, quantity]) => ({ id, quantity }))
}

function normalizePromoCode(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  if (typeof raw !== 'string' || raw.length > 50) {
    throw new HTTPException(400, { message: 'Invalid promo code' })
  }
  return raw.toUpperCase()
}

// ---------------------------------------------------------------------------
// Promo code -> reusable Stripe coupon
// ---------------------------------------------------------------------------
async function resolveStripeCoupon(
  supabase: ReturnType<typeof createClient>,
  code: string,
): Promise<string> {
  const { data: coupon, error: lookupError } = await supabase
    .from('coupons')
    .select('id, code, amount, discount_type, expiry_date, stripe_coupon_id')
    .eq('code', code)
    .maybeSingle()

  if (lookupError) {
    throw new HTTPException(500, { message: 'Failed to validate promo code' })
  }
  if (!coupon) {
    throw new HTTPException(400, { message: 'Invalid promo code' })
  }
  if (coupon.expiry_date && new Date(coupon.expiry_date).getTime() < Date.now()) {
    throw new HTTPException(400, { message: 'Promo code has expired' })
  }

  // Reuse the cached Stripe coupon when we already created one for this code
  if (coupon.stripe_coupon_id) return coupon.stripe_coupon_id

  const isPercent = coupon.discount_type === 'percent'
  const amount = Number(coupon.amount)

  if (isPercent) {
    if (!Number.isFinite(amount) || amount < 1 || amount > 99) {
      throw new HTTPException(400, { message: 'Invalid promo code configuration' })
    }
  } else if (!Number.isFinite(amount) || amount <= 0) {
    throw new HTTPException(400, { message: 'Invalid promo code configuration' })
  }

  // Idempotent creation — a retried request reuses the same coupon, never
  // proliferates new ones per checkout.
  const stripeCoupon = await stripe.coupons.create(
    {
      ...(isPercent
        ? { percent_off: amount }
        : { amount_off: Math.round(amount * 100), currency: 'nzd' }),
      duration: 'once',
      name: code,
    },
    { idempotencyKey: `coupon_${code}` },
  )

  await supabase.from('coupons').update({ stripe_coupon_id: stripeCoupon.id }).eq('id', coupon.id)
  return stripeCoupon.id
}

// ---------------------------------------------------------------------------
// Resolve authenticated user from JWT
// ---------------------------------------------------------------------------
async function resolveUser(authHeader: string | undefined) {
  if (!authHeader) return { userEmail: undefined, userId: undefined }

  try {
    const client = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await client.auth.getUser()
    return { userEmail: user?.email, userId: user?.id }
  } catch {
    return { userEmail: undefined, userId: undefined }
  }
}
