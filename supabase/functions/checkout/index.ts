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

const REQUIRED_ENV: [string, string][] = [
  ['STRIPE_SECRET_KEY', Deno.env.get('STRIPE_SECRET_KEY') ?? ''],
  ['SUPABASE_URL', Deno.env.get('SUPABASE_URL') ?? ''],
  ['SUPABASE_SERVICE_ROLE_KEY', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''],
  ['SUPABASE_ANON_KEY', Deno.env.get('SUPABASE_ANON_KEY') ?? ''],
]

const STRIPE_SECRET_KEY = REQUIRED_ENV[0][1]
const SUPABASE_URL = REQUIRED_ENV[1][1]
const SUPABASE_SERVICE_ROLE_KEY = REQUIRED_ENV[2][1]
const SUPABASE_ANON_KEY = REQUIRED_ENV[3][1]
let stripeClient: Stripe | undefined

function assertRuntimeConfig(): void {
  const missing = REQUIRED_ENV.filter(([, value]) => !value).map(([name]) => name)
  if (missing.length > 0) {
    throw new HTTPException(503, { message: `Checkout is not configured: ${missing.join(', ')}` })
  }
}

function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) throw new HTTPException(503, { message: 'Checkout is not configured' })
  stripeClient ??= new Stripe(STRIPE_SECRET_KEY, {
    // @ts-ignore — acacia is a valid API version
    apiVersion: '2025-02-24.acacia',
  })
  return stripeClient
}

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

// ---------------------------------------------------------------------------
// Limits — defence in depth against abuse / API abuse
// ---------------------------------------------------------------------------
const MAX_LINE_ITEMS = 50
const MAX_QUANTITY_PER_ITEM = 50

type NormalizedItem = { id: number; variationId?: number; quantity: number }

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
  let body: { items?: unknown; promoCode?: unknown }
  try {
    body = await c.req.json<{ items?: unknown; promoCode?: unknown }>()
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON payload' })
  }

  // 1. Normalize + validate the cart strictly (no client-supplied prices/names)
  const items = normalizeCart(body.items)

  // 2. Validate the promo code shape up front
  const promoCode = normalizePromoCode(body.promoCode)

  assertRuntimeConfig()
  const supabase = supabaseAdmin()

  const variationIds = items
    .map((item) => item.variationId)
    .filter((variationId): variationId is number => variationId !== undefined)
  const [userResult, productResult, variationResult] = await Promise.all([
    resolveUser(c.req.header('Authorization')),
    supabase.from('products').select('id, name, price, stock_status').in('id', items.map((i) => i.id)),
    variationIds.length > 0
      ? supabase
          .from('product_variations')
          .select('id, product_id, price, stock_status')
          .in('id', variationIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const { userEmail, userId } = userResult
  const { data: dbProducts, error: dbError } = productResult
  const { data: dbVariations, error: variationError } = variationResult

  if (dbError || variationError || !dbProducts) {
    throw new HTTPException(500, { message: 'Failed to validate cart items' })
  }

  const productMap = new Map(dbProducts.map((product) => [product.id, product]))
  const variationMap = new Map((dbVariations ?? []).map((variation) => [variation.id, variation]))
  const lineItems = items.map(({ id, variationId, quantity }) => {
    const dbProduct = productMap.get(id)
    if (!dbProduct) {
      throw new HTTPException(400, { message: `Product not found: ${id}` })
    }

    const variation = variationId === undefined ? null : variationMap.get(variationId)
    if (variationId !== undefined && (!variation || variation.product_id !== id)) {
      throw new HTTPException(400, { message: `Variation not found: ${variationId}` })
    }

    const stockStatus = variation?.stock_status ?? dbProduct.stock_status
    if (stockStatus !== 'instock') {
      throw new HTTPException(409, { message: `Product is out of stock: ${id}` })
    }

    const serverPrice = Number(variation?.price ?? dbProduct.price)
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
  const session = await getStripe().checkout.sessions.create({
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

  const merged = new Map<string, NormalizedItem>()
  for (const rawItem of raw) {
    if (typeof rawItem !== 'object' || rawItem === null) {
      throw new HTTPException(400, { message: 'Invalid item entry' })
    }
    const item = rawItem as Record<string, unknown>
    const id = item.id
    const variationId = item.variationId
    const quantity = item.quantity

    if (!Number.isInteger(id) || (id as number) <= 0) {
      throw new HTTPException(400, { message: 'Invalid item id' })
    }
    if (
      variationId !== undefined &&
      (!Number.isInteger(variationId) || (variationId as number) <= 0)
    ) {
      throw new HTTPException(400, { message: 'Invalid item variation' })
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

    const key = `${id as number}:${(variationId as number | undefined) ?? ''}`
    const previous = merged.get(key)
    const normalized: NormalizedItem = {
      id: id as number,
      ...(variationId === undefined ? {} : { variationId: variationId as number }),
      quantity: Math.min((previous?.quantity ?? 0) + (quantity as number), MAX_QUANTITY_PER_ITEM),
    }
    merged.set(key, normalized)
  }

  return Array.from(merged.values())
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
  supabase: ReturnType<typeof supabaseAdmin>,
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
  const stripeCoupon = await getStripe().coupons.create(
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
