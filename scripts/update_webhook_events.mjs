import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' });

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webhook`;
const EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
  'charge.refunded',
];

const { data: endpoints } = await stripe.webhookEndpoints.list({ limit: 100 });
const ep = endpoints.find((e) => e.url === FUNCTION_URL && e.status === 'enabled');
if (!ep) {
  console.error('No active webhook endpoint found for', FUNCTION_URL);
  process.exit(1);
}

const updated = await stripe.webhookEndpoints.update(ep.id, { enabled_events: EVENTS });
console.log('endpoint', updated.id, updated.url);
console.log('events:', updated.enabled_events.join(', '));