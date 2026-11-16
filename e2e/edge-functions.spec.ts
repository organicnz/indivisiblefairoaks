import { expect, test } from '@playwright/test';

/**
 * Live Supabase edge-function deployment guards.
 *
 * Proves the deployed functions (health, notify-contact, search,
 * wall-e-chat, walle-refresh) are actually deployed to the canonical project
 * (configured in env) — the "forgot to deploy" class of bug.
 *
 * Strategy: send deliberately INVALID payloads and assert the function
 * answers with its own validation status. Any 4xx/5xx from the function
 * proves it exists; only HTTP 404 means "not deployed" and fails.
 * Nothing here has side effects (no emails, no orders, no charges).
 */

const SUPABASE_URL = Bun.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = Bun.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
// The config supplies loopback placeholders on a fresh checkout so the app can
// start without a Supabase project. Those are configuration values, not a
// deployed project: probing them would turn "no local env" into five red
// live-function tests. `E2E_PLACEHOLDER_ENV` is set only when a fallback was
// actually used; a real local Supabase (including a local stack) still runs.
const LIVE =
  Boolean(SUPABASE_URL && ANON_KEY) &&
  Bun.env.E2E_PLACEHOLDER_ENV !== '1' &&
  SUPABASE_URL !== 'http://127.0.0.1:9' &&
  ANON_KEY !== 'placeholder';

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
};

const edge = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;

test.describe('edge function liveness', () => {
  // Missing Supabase configuration is an environment state, not a deployed-
  // function regression. Skip the probes loudly instead of throwing in CI;
  // the separate Supabase deploy workflow is the gate that proves the live
  // project actually has these functions. When the two public values exist,
  // every assertion below still runs unchanged.
  test.skip(
    !LIVE,
    'Supabase URL and publishable key are not configured — live edge checks require a deployed project.'
  );

  test('health answers with a ready service envelope', async ({ request }) => {
    const res = await request.get(edge('health'), { headers });
    expect(res.status(), 'health function must be ready').toBe(200);

    const body = (await res.json()) as {
      service?: unknown;
      status?: unknown;
      checks?: unknown;
    };
    expect(body.service).toBe('health');
    expect(['ok', 'degraded']).toContain(body.status);
    expect(body.checks).toBeDefined();
  });

  test('notify-contact rejects empty body with 400', async ({ request }) => {
    const res = await request.post(edge('notify-contact'), { headers, data: {} });
    expect(res.status(), 'notify-contact must run its validation path').toBe(400);
  });

  test('search rejects empty query with 400', async ({ request }) => {
    const res = await request.post(edge('search'), { headers, data: { q: '' } });
    expect(res.status(), 'search must run its validation path').toBe(400);
  });

  for (const name of ['wall-e-chat', 'walle-refresh']) {
    test(`${name} rejects non-POST requests with 405`, async ({ request }) => {
      const res = await request.get(edge(name), { headers });
      expect(res.status()).toBe(405);
    });
  }
});
