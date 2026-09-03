import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// ---------------------------------------------------------------------------
// Idempotent Stripe -> orders reconciliation.
// Run any time (cron, post-incident, post-webhook-outage):
//   bun scripts/reconcile_orders.mjs
// - creates orders for paid sessions that never landed in the DB
// - backfills stripe_payment_intent_id on existing orders
// - marks expired/failed sessions' orders as cancelled
// - marks fully-refunded orders as refunded
// Never touches 'completed' or admin-set states outside those rules.
// ---------------------------------------------------------------------------

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

function sessionError(session, msg) {
  console.warn(`  ⚠️ ${session.id}: ${msg}`);
}

async function sessionOrderKey(session) {
  const pi = await stripe.paymentIntents.retrieve(session.payment_intent).catch(() => null);
  return pi?.id ?? null;
}

function splitName(fullName) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') || null };
}

function buildAddresses(session) {
  const cust = session.customer_details;
  const ship = session.shipping_details;
  const billing = {
    ...(cust?.address ?? {}),
    ...splitName(cust?.name ?? ship?.name),
    ...(cust?.phone ? { phone: cust.phone } : {}),
    ...(cust?.email ? { email: cust.email } : {}),
  };
  const shipping = {
    ...(ship?.address ?? {}),
    ...splitName(ship?.name),
    ...(cust?.email && !cust?.name && !ship?.name ? { email: cust.email } : {}),
  };
  return [billing, shipping];
}

async function ensureOrderExists(session) {
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_session_id', session.id)
    .maybeSingle();
  if (existing) return existing.id;

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

  // Resolve customer id (mirrors webhook edge function)
  let customerId = null;
  const userId = session.metadata?.userId;
  if (userId && userId !== 'guest') {
    const { data } = await supabase.from('profiles').select('id').eq('user_id', userId).maybeSingle();
    if (data) customerId = data.id;
  }
  if (customerId === null && session.customer_details?.email) {
    const { data } = await supabase.from('profiles').select('id').eq('email', session.customer_details.email).maybeSingle();
    if (data) customerId = data.id;
  }

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      customer_id: customerId,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      status: 'processing',
      total_amount: (session.amount_total ?? 0) / 100,
      currency: session.currency?.toUpperCase() ?? 'NZD',
      payment_method: 'stripe',
      billing_address: buildAddresses(session)[0],
      shipping_address: buildAddresses(session)[1],
      created_at: new Date(session.created * 1000).toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    sessionError(session, `insert failed: ${error.message}`);
    return null;
  }

  const rows = lineItems.data.map((item) => ({
    order_id: order.id,
    product_name: item.description ?? 'Unknown item',
    quantity: item.quantity ?? 1,
    total: (item.amount_total ?? 0) / 100,
  }));
  const { error: itemsError } = await supabase.from('order_items').insert(rows);
  if (itemsError) sessionError(session, `order #${order.id} created but items failed: ${itemsError.message}`);

  console.log(`✅ Created order #${order.id} from session ${session.id} (${paymentIntentId ?? 'no PI'})`);
  return order.id;
}

async function reconcileOrder(order, session) {
  // Backfill payment intent id from Stripe when missing
  if (!order.stripe_payment_intent_id && session.payment_intent) {
    const pi = await sessionOrderKey(session);
    if (pi) {
      await supabase.from('orders').update({ stripe_payment_intent_id: pi }).eq('id', order.id);
      console.log(`  🔧 Order #${order.id}: backfilled PI ${pi}`);
    }
  }

  // Backfill customer contact details when missing (orders created before
  // customer_details were persisted)
  const storedBilling = order.billing_address ?? {};
  if (!storedBilling.email || (storedBilling.first_name ?? storedBilling.name) == null) {
    const [billing, shipping] = buildAddresses(session);
    await supabase.from('orders').update({ billing_address: billing, shipping_address: shipping }).eq('id', order.id);
    console.log(`  🔧 Order #${order.id}: backfilled customer contact`);
  }

  if (order.status === 'completed' || order.status === 'cancelled') return;

  const failed = session.status !== 'complete' || session.payment_status !== 'paid';
  if (failed) {
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    console.log(`  🔄 Order #${order.id} -> cancelled (session ${session.status}/${session.payment_status})`);
    return;
  }

  // Fully refunded?
  if (order.status !== 'refunded' && session.payment_intent) {
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent).catch(() => null);
    const fullyRefunded = pi?.charges?.data?.every((c) => c.refunded === true) && pi.charges.data.length > 0;
    if (fullyRefunded) {
      await supabase.from('orders').update({ status: 'refunded' }).eq('id', order.id);
      console.log(`  🔄 Order #${order.id} -> refunded (fully refunded in Stripe)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Walk all checkout sessions
// ---------------------------------------------------------------------------
const sessions = [];
let startingAfter;
for (let i = 0; i < 200; i++) {
  const list = await stripe.checkout.sessions.list({ limit: 100, starting_after: startingAfter });
  sessions.push(...list.data);
  if (!list.has_more) break;
  startingAfter = list.data[list.data.length - 1].id;
}
console.log(`Stripe sessions scanned: ${sessions.length}`);

const { data: orders } = await supabase
  .from('orders')
  .select('id, stripe_session_id, stripe_payment_intent_id, status, billing_address, shipping_address')
  .not('stripe_session_id', 'is', null);
const ordersBySession = new Map(orders.map((o) => [o.stripe_session_id, o]));
console.log(`Orders with stripe_session_id: ${orders.length}`);

for (const session of sessions) {
  if (session.payment_status !== 'paid' && !ordersBySession.has(session.id)) continue;
  const order = ordersBySession.get(session.id);
  if (order) {
    await reconcileOrder(order, session);
  } else if (session.payment_status === 'paid') {
    await ensureOrderExists(session);
  }
}

console.log('--- Reconciliation complete ---');