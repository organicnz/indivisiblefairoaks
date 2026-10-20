import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Rotate the Stripe webhook endpoint + secret, printing the new secret for
// sync into Supabase function secrets:
//   bun scripts/rotate_webhook_secret.mjs
// Then: supabase secrets set STRIPE_WEBHOOK_SECRET=<printed value>
// ---------------------------------------------------------------------------

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' });
const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webhook`;
const PROJECT_REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
  'charge.refunded',
];

const old = await stripe.webhookEndpoints.list({ limit: 100 });
const endpoints = old.data.filter((e) => e.url === FUNCTION_URL);
console.log(`Found ${endpoints.length} webhook endpoint(s) for ${FUNCTION_URL}`);

const keep = [];
for (const ep of endpoints) {
  const sameEvents = EVENTS.every((e) => ep.enabled_events.includes(e));
  if (sameEvents) {
    keep.push(ep);
  } else {
    console.log(`Deleting stale endpoint ${ep.id} (events: ${ep.enabled_events.join(',')})`);
    await stripe.webhookEndpoints.del(ep.id);
  }
}

if (keep.length > 0) {
  console.log('Rotating the active endpoint...');
  await stripe.webhookEndpoints.del(keep[0].id);
}

const created = await stripe.webhookEndpoints.create({
  url: FUNCTION_URL,
  enabled_events: EVENTS,
  description: 'Main Webhook for Indivisible Fair Oaks-Carmichael Order Fulfillment',
});
console.log(`Created endpoint ${created.id}`);
console.log(`\n🔑 New STRIPE_WEBHOOK_SECRET=${created.secret}`);
console.log('\nSync it into Supabase:');
console.log('  bun x supabase@latest secrets set STRIPE_WEBHOOK_SECRET=<value> --project-ref ' + PROJECT_REF);
console.log('And add to .env.local: STRIPE_WEBHOOK_SECRET=<value>');
