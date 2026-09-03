import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { env } from '@/lib/env';
import { buildOrderItems } from '@/lib/stripe-order-items';
import { createAdminClient } from '@/lib/supabase-server';

const STRIPE_API_VERSION = '2026-07-29.dahlia' as const;

function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
  });
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

  // Handle the event
  console.log(`🔔 Stripe Webhook Received: ${event.type}`);
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

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
      console.log(`⏭️ Order for session ${session.id} already exists — skipping duplicate delivery`);
      return;
    }
    // Orphan order from a partially-failed earlier delivery — backfill items.
    console.log(`⏭️ Order #${existing.id} exists without items — backfilling`);
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

  // 2. Find or create the customer profile
  const userId = session.client_reference_id || session.metadata?.userId;
  const customerDetails = session.customer_details as {
    email?: string;
    address?: Record<string, string>;
  } | null;
  const email = customerDetails?.email || session.customer_email;

  let profileId: number | null = null;

  if (userId || email) {
    const query = supabase.from('profiles').select('id');
    if (userId) {
      query.eq('user_id', userId);
    } else if (email) {
      query.eq('email', email);
    }

    const { data: profile } = await query.maybeSingle();
    if (profile) {
      profileId = profile.id;
    }
  }

  // 3. Create the order
  const collectedInfo = session.collected_information as {
    shipping_details?: { address?: Record<string, string> };
  } | null;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: profileId,
      status: 'processing',
      currency: session.currency || 'nzd',
      total_amount: (session.amount_total || 0) / 100,
      stripe_session_id: session.id,
      billing_address: customerDetails?.address,
      shipping_address: collectedInfo?.shipping_details?.address,
      payment_method: 'stripe',
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
      console.log(`⏭️ Order for session ${session.id} already exists (unique index) — skipping`);
      return;
    }
    throw orderError;
  }

  // 4. Create order items
  const orderItems = buildOrderItems(order.id, lineItems.data);

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) throw itemsError;

  // 5. Update profile with stripe_customer_id if available
  if (profileId && session.customer) {
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: session.customer as string })
      .eq('id', profileId);
  }
}
