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
    (/^https:\/\/([\w-]+\.)*catch-22\.co\.nz$/.test(raw) ||
      /^https:\/\/[\w-]+\.vercel\.app$/.test(raw))
  ) {
    return raw;
  }
  return env.NEXT_PUBLIC_SITE_URL || 'https://catch-22.co.nz';
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

    const body = await req.json();
    const { items: rawItems, promoCode } = body;

    const cartCheck = validateCartItems(rawItems);
    if (!cartCheck.ok) {
      return NextResponse.json({ error: cartCheck.failure.message }, { status: 400 });
    }
    const items = cartCheck.items;

    const promoCheck = validatePromoCode(promoCode);
    if (!promoCheck.ok) {
      return NextResponse.json({ error: promoCheck.failure.message }, { status: 400 });
    }

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
        promoCode: promoCode || '',
        userId: user?.id || '',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Checkout error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
