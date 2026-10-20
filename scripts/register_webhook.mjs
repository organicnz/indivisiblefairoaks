import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const argUrl = process.argv[2];
const appUrl = argUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

if (!stripeKey || stripeKey.includes('placeholder')) {
  console.error('\n❌ Missing STRIPE_SECRET_KEY in .env.local');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' });

async function registerWebhook() {
  const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/webhooks/stripe`;

  if (webhookUrl.includes('localhost')) {
    console.log('\n⚠️ Localhost detected. Stripe cannot register webhooks to local URLs.');
    console.log('To test locally, use the Stripe CLI:');
    console.log('  stripe listen --forward-to localhost:3000/api/webhooks/stripe\n');
    return;
  }

  console.log(`🚀 Registering webhook for: ${webhookUrl}`);

  try {
    // Check if endpoint already exists
    const existingEndpoints = await stripe.webhookEndpoints.list();
    const existing = existingEndpoints.data.find(ep => ep.url === webhookUrl);

    if (existing) {
      console.log(`ℹ️ Webhook already exists for this URL (ID: ${existing.id})`);
      console.log(`🔑 Webhook Secret: ${existing.secret} (Keep this private!)`);
      return;
    }

    const webhookEndpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: [
        'checkout.session.completed',
        'checkout.session.expired',
        'payment_intent.payment_failed',
        'charge.refunded',
      ],
      description: 'Main Webhook for Indivisible Fair Oaks-Carmichael Order Fulfillment',
    });

    console.log('\n✅ Webhook Registered Successfully!');
    console.log(`ID: ${webhookEndpoint.id}`);
    console.log(`URL: ${webhookEndpoint.url}`);
    console.log(`\n🔑 STRIPE_WEBHOOK_SECRET=${webhookEndpoint.secret}`);
    console.log('\nAdd the above line to your .env.local or production environment variables.\n');

  } catch (error) {
    console.error('❌ Failed to register webhook:', error.message);
  }
}

registerWebhook();
