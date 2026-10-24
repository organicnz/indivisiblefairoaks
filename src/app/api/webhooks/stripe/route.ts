import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { env } from '@/lib/env';
import { buildOrderItems } from '@/lib/stripe-order-items';
import { createAdminClient } from '@/lib/supabase-server';

function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-09-30.endive' as const,
  });
}

function getVerifiedUserId(session: Stripe.Checkout.Session): string | null {
  const userId = session.client_reference_id || session.metadata?.userId;
  if (!userId || userId === 'guest' || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  return userId;
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const endpointSecret = env.STRIPE_WEBHOOK_SECRET;

  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  let event: Stripe.Event;

  try {
    if (!sig || !endpointSecret) {
      throw new Error('Missing stripe-signature or STRIPE_WEBHOOK_SECRET');
    }
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Webhook Signature verification failed: ${message}`);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  // Handle the event — receipt is visible in platform request logs,
  // so no per-event trace line here (keeps log volume down on free tier).
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Parity with the Edge primary (supabase/functions/webhook): only fulfil
    // paid payment-mode sessions. Unpaid/expired sessions must never create orders.
    if (session.mode !== 'payment' || session.payment_status !== 'paid') {
      console.warn(`Ignoring unpaid checkout session ${session.id}`);
      return NextResponse.json({ received: true });
    }
    if (!session.amount_total || session.amount_total <= 0) {
      console.warn(`Ignoring zero-amount checkout session ${session.id}`);
      return NextResponse.json({ received: true });
    }

    try {
      await handleCheckoutSessionCompleted(session, stripe);
    } catch (error: unknown) {
      console.error('Error handling checkout.session.completed:', error);
      return NextResponse.json({ error: 'Failed to process order' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, stripe: Stripe) {
  const supabase = await createAdminClient();

  // ── Idempotency: handle retries + concurrent deliveries ────────────────
  // Edge function (supabase/functions/webhook) is the primary fulfilment
  // path; this Next route is the Vercel-hosted fallback. Both must converge
  // to a complete order even when a previous attempt left an orphan row
  // (order without items). The unique index on stripe_session_id handles
  // races; the item-count check heals partial failures on retry.
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_session_id', session.id)
    .maybeSingle();
  if (existing) {
    const { count } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', existing.id);
    if (count && count > 0) {
      console.warn(`Duplicate webhook delivery skipped for session ${session.id}`);
      return;
    }
    // Orphan order from a partially-failed earlier delivery — backfill items.
    console.warn(`Order #${existing.id} exists without items — backfilling`);
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ['data.price.product'],
    });
    const orderItems = buildOrderItems(existing.id, lineItems.data);
    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw itemsError;
    return;
  }

  // 1. Get line items with product details
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    expand: ['data.price.product'],
  });

  const userId = getVerifiedUserId(session);
  const customerDetails = session.customer_details as {
    email?: string;
    address?: Record<string, string>;
  } | null;

  // 2. Create the order
  const collectedInfo = session.collected_information as {
    shipping_details?: { address?: Record<string, string> };
  } | null;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      status: 'processing',
      currency: session.currency || 'usd',
      total: (session.amount_total || 0) / 100,
      stripe_session_id: session.id,
      metadata:
        typeof session.customer === 'string' ? { stripe_customer_id: session.customer } : {},
      billing_address: customerDetails?.address,
      shipping_address: collectedInfo?.shipping_details?.address,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (orderError) {
    // Concurrent duplicate delivery lost the race to the unique index —
    // backfill items if the winner left an orphan row, then treat as success.
    if (
      typeof orderError === 'object' &&
      orderError !== null &&
      'code' in orderError &&
      (orderError as { code?: string }).code === '23505'
    ) {
      const { data: raced } = await supabase
        .from('orders')
        .select('id')
        .eq('stripe_session_id', session.id)
        .maybeSingle();
      if (raced) {
        const { count } = await supabase
          .from('order_items')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', raced.id);
        if (!count || count === 0) {
          const racedItems = await stripe.checkout.sessions.listLineItems(session.id, {
            expand: ['data.price.product'],
          });
          const orderItems = buildOrderItems(raced.id, racedItems.data);
          const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
          if (itemsError) throw itemsError;
        }
      }
      console.warn(`Order for session ${session.id} already exists (unique index) — skipping`);
      return;
    }
    throw orderError;
  }

  // 3. Create order items
  const orderItems = buildOrderItems(order.id, lineItems.data);

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) throw itemsError;
}
