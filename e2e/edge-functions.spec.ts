import { expect, test } from '@playwright/test';

/**
 * Live Supabase edge-function deployment guards.
 *
 * Proves all five functions (health, notify-contact, search, checkout,
 * webhook) are actually deployed to the canonical project
 * (mojsubkqjdruhpxbzgme) — the "forgot to deploy" class of bug.
 *
 * Strategy: send deliberately INVALID payloads and assert the function
 * answers with its own validation status. Any 4xx/5xx from the function
 * proves it exists; only HTTP 404 means "not deployed" and fails.
 * Nothing here has side effects (no emails, no orders, no charges).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const LIVE = Boolean(SUPABASE_URL && ANON_KEY);

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
};

const edge = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;

test.beforeEach(() => {
  test.skip(!LIVE, 'Supabase env not configured');
});

test.describe('edge function liveness', () => {
  test('health answers with service envelope (never 404)', async ({ request }) => {
    const res = await request.get(edge('health'), { headers });
    expect(res.status(), 'health function missing — not deployed?').not.toBe(404);
    expect([200, 503]).toContain(res.status());

    const body = (await res.json()) as {
      service?: unknown;
      status?: unknown;
      checks?: unknown;
    };
    expect(body.service).toBe('health');
    expect(['ok', 'degraded']).toContain(body.status);
    expect(body.checks).toBeDefined();
  });

  test('notify-contact rejects empty body with 400 (never 404)', async ({ request }) => {
    const res = await request.post(edge('notify-contact'), { headers, data: {} });
    expect(res.status(), 'notify-contact missing — not deployed?').not.toBe(404);
    // 400 when env vars are configured, 500 when RESEND_API_KEY is absent
    // (startup guard throws). Either proves the function is deployed.
    expect(res.status(), 'notify-contact missing — not deployed?').not.toBe(404);
    expect([400, 500]).toContain(res.status());
  });

  test('search rejects empty query with 400 (never 404)', async ({ request }) => {
    const res = await request.post(edge('search'), { headers, data: { q: '' } });
    expect(res.status(), 'search function missing — not deployed?').not.toBe(404);
    // 400 when env vars are configured, 500 when SEARCH_RATE_LIMIT_* are absent.
    // Either proves the function is deployed.
    expect([400, 500]).toContain(res.status());
  });

  test('checkout answers its gateway (never 404)', async ({ request }) => {
    // Deployed WITH jwt verification, so an anonymous probe may get 401
    // from the gateway — that still proves the function exists.
    const res = await request.post(edge('checkout'), { headers, data: {} });
    expect(res.status(), 'checkout function missing — not deployed?').not.toBe(404);
  });

  test('webhook answers its gateway (never 404)', async ({ request }) => {
    const res = await request.post(edge('webhook'), {
      headers,
      data: 'probe',
    });
    expect(res.status(), 'webhook function missing — not deployed?').not.toBe(404);
  });
});
