import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

// All paid sessions in Stripe
const sessions = [];
let startingAfter;
for (let i = 0; i < 100; i++) {
  const list = await stripe.checkout.sessions.list({ limit: 100, starting_after: startingAfter });
  sessions.push(...list.data);
  if (!list.has_more) break;
  startingAfter = list.data[list.data.length - 1].id;
}
console.log('Total Stripe sessions:', sessions.length);

// All orders with a stripe_session_id
const { data: orders } = await supabase.from('orders').select('id, stripe_session_id, status').not('stripe_session_id', 'is', null);
const bySession = new Map(orders.map((o) => [o.stripe_session_id, o]));
console.log('Orders with stripe_session_id:', orders.length);

const paidMissing = [];
const unpaidWithOrder = [];
for (const s of sessions) {
  const order = bySession.get(s.id);
  if (s.payment_status === 'paid' && !order) {
    paidMissing.push({ id: s.id, created: new Date(s.created * 1000).toISOString(), total: s.amount_total, email: s.customer_details?.email ?? s.customer_email });
  }
  if (s.payment_status !== 'paid' && order && order.status !== 'cancelled') {
    unpaidWithOrder.push({ session: s.id, order: order.id, orderStatus: order.status, sessionStatus: s.status });
  }
}

// Stripe sessions referenced by orders but not found in Stripe
const stripeIds = new Set(sessions.map((s) => s.id));
const missingInStripe = orders.filter((o) => !stripeIds.has(o.stripe_session_id));

console.log('\nPAID sessions missing an order (' + paidMissing.length + '):');
for (const m of paidMissing) console.log('  ', m.id, m.created, '$' + (m.total / 100), m.email ?? '');
console.log('\nUNPAID sessions that have an order (' + unpaidWithOrder.length + '):');
for (const m of unpaidWithOrder) console.log('  ', m.session, '-> order', m.order.id, m.status);
console.log('\nOrders referencing sessions missing in Stripe (' + missingInStripe.length + '):');
for (const m of missingInStripe) console.log('  ', m.id, m.stripe_session_id, m.status);