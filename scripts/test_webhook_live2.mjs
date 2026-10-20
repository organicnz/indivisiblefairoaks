const FUNCTION_URL = `${Bun.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webhook`;
const PAYLOAD = JSON.stringify({
  id: 'evt_test_local_' + Date.now(),
  object: 'event',
  api_version: '2025-02-24.basil',
  created: Math.floor(Date.now() / 1000),
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_live_UNUSED_TEST', object: 'checkout.session', payment_status: 'paid', amount_total: 1000, currency: 'usd', metadata: {}, customer_details: { email: 'no-such-user@nowhere.invalid', address: {} } } },
});

/**
 * Stripe's signature scheme, over WebCrypto's HMAC.
 *
 * `crypto.subtle` is a Web standard rather than a Node builtin, and it
 * produces the same bytes `node:crypto`'s `createHmac` does. The
 * asynchronous signature is why this is a function and not an expression.
 */
async function sign(secret) {
  const t = Math.floor(Date.now() / 1000) + '';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${t}.${PAYLOAD}`)
  );
  const hex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
  return `t=${t},v1=${hex}`;
}

const secret = Bun.env.STRIPE_WEBHOOK_SECRET;
for (const contentType of ['application/json', 'text/plain', 'application/octet-stream']) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'content-type': contentType, 'stripe-signature': await sign(secret) },
    body: PAYLOAD,
  });
  const body = await res.text();
  console.log(contentType.padEnd(26), res.status, body.slice(0, 90));
}
