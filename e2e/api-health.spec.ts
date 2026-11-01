import { expect, test } from '@playwright/test';

/**
 * Next.js API route contract tests.
 *
 * Exercises every /api route's validation path WITHOUT side effects:
 * all payloads fail validation first, no emails are sent, and no rows are
 * written (report-error's valid case inserts one telemetry row by design —
 * that is its contract).
 *
 * Rate-limit headroom: report-error allows 5/10min/IP. This file stays well
 * under it even with CI retries (2).
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

test.describe('POST /api/auth/logout', () => {
  test('redirects to home without crashing', async ({ request }) => {
    const res = await request.post('/api/auth/logout', { maxRedirects: 0 });
    expect([302, 307], `unexpected logout status ${res.status()}`).toContain(res.status());
    const location = res.headers().location ?? '';
    expect(location).toMatch(/\/$/);
  });
});
