import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webhook`;
const PAYLOAD = JSON.stringify({
  id: 'evt_test_local_' + Date.now(),
  object: 'event',
  api_version: '2025-02-24.basil',
  created: Math.floor(Date.now() / 1000),
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_live_UNUSED_TEST', object: 'checkout.session', payment_status: 'paid', amount_total: 1000, currency: 'nzd', metadata: {}, customer_details: { email: 'no-such-user@nowhere.invalid', address: {} } } },
});

function sign(secret) {
  const t = Math.floor(Date.now() / 1000) + '';
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${PAYLOAD}`).digest('hex');
  return `t=${t},v1=${sig}`;
}

const secret = process.env.STRIPE_WEBHOOK_SECRET;
for (const contentType of ['application/json', 'text/plain', 'application/octet-stream']) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'content-type': contentType, 'stripe-signature': sign(secret) },
    body: PAYLOAD,
  });
  const body = await res.text();
  console.log(contentType.padEnd(26), res.status, body.slice(0, 90));
}
