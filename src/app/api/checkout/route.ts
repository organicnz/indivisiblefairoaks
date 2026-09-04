import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeShippingOptions } from '@/config/shipping';
import { validateCartItems, validatePromoCode } from '@/lib/checkout-validation';
import { env } from '@/lib/env';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { createServerClient } from '@/lib/supabase-server';

const STRIPE_API_VERSION = '2026-07-29.dahlia' as const;

/**
 * Success/cancel redirects must be absolute HTTPS URLs or the Stripe SDK
 * rejects the session ("An explicit scheme must be provided"). The Origin
 * header is unreliable (proxies, privacy modes, non-browser clients), so
 * validate it against known-good hosts and fall back to the canonical site.
 */
function resolveReturnOrigin(req: Request): string {
  const raw = req.headers.get('origin');
  if (
    raw &&
    (/^https:\/\/([\w-]+\.)*indivisiblefairoaks\.org$/.test(raw) ||
      /^https:\/\/[\w-]+\.vercel\.app$/.test(raw) ||
      /^http:\/\/localhost:\d+$/.test(raw))
  ) {
    return raw;
  }
  return env.NEXT_PUBLIC_SITE_URL || 'https://indivisiblefairoaks.org';
}

export async function POST(req: Request) {
  // 10 checkout sessions / minute / IP — session creation is not free
  // (Stripe API quota + email/payment pressure). In-memory per isolate.
  const gate = rateLimit(clientKey(req.headers, 'checkout'), 10, 60_000);
  if (!gate.ok) {
    return NextResponse.json(
      { error: 'Too many checkout attempts. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfterSec) } }
    );
  }

  try {
    const stripeKey = env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: STRIPE_API_VERSION,
    });

    // Malformed JSON must fail fast with a 400 — letting req.json() throw
    // would fall through to the 500 handler and misreport a client error.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Envelope shape check before destructuring: null, arrays, and primitives
    // would otherwise throw a TypeError into the 500 path.
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }
    const { items: rawItems, promoCode } = body as {
      items?: unknown;
      promoCode?: unknown;
    };

    const cartCheck = validateCartItems(rawItems);
    if (!cartCheck.ok) {
      return NextResponse.json({ error: cartCheck.failure.message }, { status: 400 });
    }
    const items = cartCheck.items;

    const promoCheck = validatePromoCode(promoCode);
    if (!promoCheck.ok) {
      return NextResponse.json({ error: promoCheck.failure.message }, { status: 400 });
    }
    // validatePromoCode accepts only undefined, empty, or a short string —
    // narrow the unknown envelope value to what Stripe metadata requires.
    const promoCodeValue = typeof promoCode === 'string' ? promoCode : '';

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Fetch product details from Supabase to ensure price integrity
    const productIds = items.map((item) => item.id);
    const { data: dbProducts, error: dbError } = await supabase
      .from('products')
      .select('id, name, price, slug, stock_status')
      .in('id', productIds);

    if (dbError || !dbProducts) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Failed to verify products' }, { status: 500 });
    }

    // Map database products for easy lookup
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // Validate all requested products exist and are purchasable
    for (const item of items) {
      const dbProduct = productMap.get(item.id);
      if (!dbProduct) {
        return NextResponse.json({ error: `Product not found: ${item.id}` }, { status: 400 });
      }
      if (dbProduct.stock_status !== 'instock') {
        return NextResponse.json(
          { error: `Out of stock: ${dbProduct.name}`, productId: item.id },
          { status: 409 }
        );
      }
    }

    // Build line items for Stripe
    const lineItems = items.map((item) => {
      const dbProduct = productMap.get(item.id);
      if (!dbProduct) throw new Error(`Product not found: ${item.id}`);

      return {
        price_data: {
          currency: 'nzd',
          product_data: {
            name: dbProduct.name,
            metadata: {
              slug: dbProduct.slug,
              // The webhook maps line items back to catalog rows via this id.
              id: String(dbProduct.id),
            },
          },
          unit_amount: Math.round(dbProduct.price * 100), // Convert to cents
        },
        quantity: item.quantity,
      };
    });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      currency: 'nzd',
      locale: 'en',
      adaptive_pricing: {
        enabled: false,
      },
      success_url: `${resolveReturnOrigin(req)}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${resolveReturnOrigin(req)}/cart`,
      shipping_address_collection: {
        allowed_countries: ['NZ'],
      },
      shipping_options: getStripeShippingOptions(),
      // Allow promo codes if needed
      allow_promotion_codes: true,
      client_reference_id: user?.id,
      customer_email: user?.email || undefined,
      metadata: {
        promoCode: promoCodeValue,
        userId: user?.id || '',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    // Log the full error server-side, but return a generic message: Stripe
    // SDK errors can contain account internals that must never reach clients.
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Checkout failed. Please try again.' }, { status: 500 });
  }
}
