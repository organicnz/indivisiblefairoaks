import { expect, test } from '@playwright/test';

/**
 * Next.js API route contract tests.
 *
 * Exercises every /api route's validation path WITHOUT side effects:
 * no Stripe sessions are created (all payloads fail validation first),
 * no emails are sent, no rows are written (report-error's valid case
 * inserts one telemetry row by design — that is its contract).
 *
 * Rate-limit headroom: report-error allows 5/10min/IP, checkout 10/min/IP.
 * This file stays well under both even with CI retries (2).
 */

test.describe('GET /api/health', () => {
  test('returns live status shape (200 ok or 503 degraded)', async ({ request }) => {
    const res = await request.get('/api/health');
    expect([200, 503], `unexpected health status ${res.status()}`).toContain(res.status());

    const body = (await res.json()) as {
      status?: unknown;
      checks?: { database?: unknown };
      latencyMs?: unknown;
      timestamp?: unknown;
    };
    expect(typeof body.status).toBe('string');
    expect(['ok', 'degraded']).toContain(body.status);
    expect(body.checks).toBeDefined();
    expect(['up', 'degraded', 'down']).toContain(body.checks?.database);
    expect(typeof body.latencyMs).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });
});

test.describe('POST /api/report-error', () => {
  test('accepts a well-formed telemetry report with 204', async ({ request }) => {
    const res = await request.post('/api/report-error', {
      data: {
        message: 'e2e health probe — benign telemetry write',
        path: '/e2e/api-health',
        category: 'other',
      },
    });
    expect(res.status()).toBe(204);
  });

  test('rejects an invalid payload with 400, never 500', async ({ request }) => {
    const res = await request.post('/api/report-error', {
      data: { message: '   ' },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('POST /api/checkout', () => {
  test('rejects an empty cart without crashing (400 validation, or 500 when Stripe is unconfigured in test env)', async ({
    request,
  }) => {
    const res = await request.post('/api/checkout', {
      data: { items: [] },
    });
    // Validation path (Stripe configured) → 400. Test env without
    // STRIPE_SECRET_KEY → 500 config error. Both prove the route is
    // alive; a 404/HTML crash would fail here.
    expect([400, 500], `unexpected checkout status ${res.status()}`).toContain(res.status());
    const body = (await res.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
  });

  test('rejects malformed items without crashing', async ({ request }) => {
    const res = await request.post('/api/checkout', {
      data: { items: [{ id: -1, quantity: 9999 }] },
    });
    expect([400, 500], `unexpected checkout status ${res.status()}`).toContain(res.status());
  });
});

test.describe('POST /api/webhooks/stripe', () => {
  test('rejects a missing stripe-signature without crashing', async ({ request }) => {
    const res = await request.post('/api/webhooks/stripe', {
      data: 'not-a-real-event',
      headers: { 'Content-Type': 'text/plain' },
    });
    // 400 = signature validation (Stripe configured), 500 = Stripe
    // secret unconfigured in test env. Both prove the route is alive.
    expect([400, 500], `unexpected webhook status ${res.status()}`).toContain(res.status());
  });
});

test.describe('POST /api/auth/logout', () => {
  test('redirects to home without crashing', async ({ request }) => {
    const res = await request.post('/api/auth/logout', { maxRedirects: 0 });
    expect([302, 307], `unexpected logout status ${res.status()}`).toContain(res.status());
    const location = res.headers().location ?? '';
    expect(location).toMatch(/\/$/);
  });
});
