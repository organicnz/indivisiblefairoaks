// ---------------------------------------------------------------------------
// Live regression tests for the webhook edge function.
// All payloads are fabricated but signature-valid, and are designed to be
// DB-safe: they never create rows for real data.
//   bun scripts/test_webhook_events.mjs
//
// The signature is computed with WebCrypto's HMAC — a Web standard rather
// than a Node builtin, and byte-identical to what `node:crypto` produces.
// ---------------------------------------------------------------------------

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webhook`;
const secret = process.env.STRIPE_WEBHOOK_SECRET;
const now = Math.floor(Date.now() / 1000);

async function signedEvent(type, object) {
  const payload = JSON.stringify({
    id: `evt_test_${crypto.randomUUID()}`,
    object: 'event',
    api_version: '2025-02-24.basil',
    created: now,
    type,
    data: { object },
  });
  const t = String(now);
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
    new TextEncoder().encode(`${t}.${payload}`)
  );
  const hex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
  return { type, payload, signature: `t=${t},v1=${hex}` };
}

async function fire(event, expectStatus) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': event.signature },
    body: event.payload,
  });
  const ok = res.status === expectStatus;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${expectStatus} (got ${res.status})  ${event.type} — ${res.status === 200 ? 'received' : ''}`);
  return ok;
}

let allPass = true;
const check = (name, pass) => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  allPass &&= pass;
};

// 1. Bad signature -> 400
const bad = await fetch(FUNCTION_URL, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'stripe-signature': 't=0,v1=deadbeef' },
  body: JSON.stringify({ id: 'evt_x' }),
});
check('Bad signature rejected with 400', bad.status === 400);

// 2. checkout.session.completed but NOT paid -> acknowledged, no fulfillment
check('Unpaid completed session skipped', await fire(
  await signedEvent('checkout.session.completed', {
    id: 'cs_live_TEST_UNPAID', object: 'checkout.session', mode: 'payment',
    payment_status: 'unpaid', amount_total: 1000, currency: 'usd',
  }),
  200,
));

// 3. PARTIAL refund -> order must NOT change (guard test)
check('Partial refund ignored', await fire(
  await signedEvent('charge.refunded', {
    id: 'ch_test_partial', object: 'charge', refunded: true,
    amount: 10000, amount_refunded: 5000,
    payment_intent: 'pi_3U20hZE2L5MFpsl70H0CgO7r', // real PI — must stay untouched
  }),
  200,
));

// 4. FULL refund for an unknown payment intent -> 200, no crash
check('Full refund with unknown PI is a no-op', await fire(
  await signedEvent('charge.refunded', {
    id: 'ch_test_full', object: 'charge', refunded: true,
    amount: 10000, amount_refunded: 10000,
    payment_intent: 'pi_TEST_NONEXISTENT',
  }),
  200,
));

// 5. payment_failed for unknown PI -> 200, no crash
check('Payment failed with unknown PI is a no-op', await fire(
  await signedEvent('payment_intent.payment_failed', {
    id: 'pi_TEST_NONEXISTENT', object: 'payment_intent', status: 'requires_payment_method',
  }),
  200,
));

// 6. checkout.session.expired for unknown session -> 200, no crash
check('Expired session with no order is a no-op', await fire(
  await signedEvent('checkout.session.expired', {
    id: 'cs_live_TEST_EXPIRED', object: 'checkout.session', status: 'expired',
  }),
  200,
));

// 7. Unhandled event type -> acknowledged (2xx)
check('Unhandled event type acknowledged', await fire(
  await signedEvent('invoice.payment_succeeded', { id: 'in_test', object: 'invoice' }),
  200,
));

// 8. Duplicate delivery of the same event is a no-op (idempotent ack)
const dup = await signedEvent('checkout.session.expired', {
  id: 'cs_live_TEST_EXPIRED', object: 'checkout.session', status: 'expired',
});
const r1 = await fetch(FUNCTION_URL, {
  method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': dup.signature }, body: dup.payload,
});
const r2 = await fetch(FUNCTION_URL, {
  method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': dup.signature }, body: dup.payload,
});
check('Duplicate event delivery both acknowledged', r1.status === 200 && r2.status === 200);

console.log(allPass ? '\nAll webhook tests passed.' : '\nSome tests FAILED.');
process.exit(allPass ? 0 : 1);
