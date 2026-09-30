import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The unsubscribe endpoint, and specifically which HTTP method is allowed to
 * change state.
 *
 * ## Why this needed a test
 *
 * The handler's own docblock said "GET renders a tiny branded confirmation; POST
 * performs the opt-out", and the code did the opposite: the `do_not_email` write
 * and the `crm_activities` insert sat *above* the `req.method === 'POST'` branch,
 * so a GET opted the contact out and only differed in what it rendered
 * afterwards.
 *
 * A GET that writes is the classic unsafe-method violation, and here the blast
 * radius is the chapter's entire subscriber list. **Corporate mail security
 * products fetch every URL in an inbound message** — Proofpoint, Barracuda,
 * Microsoft Safe Links — and most web and chat clients prefetch on hover. Any of
 * them turns "the recipient clicked unsubscribe" into "the recipient's mail
 * gateway clicked unsubscribe". A 5,000-recipient chapter has 5,000 gateways
 * watching for that exact URL, and the outcome is a silent mass opt-out with
 * every recipient believing they are still subscribed.
 *
 * The comment asserting the safe behaviour, while the code did the unsafe thing,
 * is the part that made this expensive: a reader checking the comment would have
 * concluded the endpoint was fine.
 */

const createAdminClient = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase-server', () => ({ createAdminClient }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  // A stable key: these tests are about method semantics, not bucketing.
  clientKey: () => 'test-ip',
}));

const { GET, POST } = await import('@/app/api/crm/unsubscribe/route');

const TOKEN = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/** Records every write so "a GET must not write" is directly observable. */
let writes: { table: string; op: 'update' | 'insert'; payload: unknown }[];

type ContactRow = {
  id: string;
  email: string;
  first_name: string | null;
  do_not_email: boolean;
};

/** A tiny PostgREST builder that only models the three shapes the route uses. */
function fakeClient(contact: ContactRow | null) {
  return () => ({
    from(table: string) {
      const chain = {
        select: () => chain,
        single: async () => ({ data: contact, error: null }),
        eq: () => chain,
        update: (payload: unknown) => {
          writes.push({ table, op: 'update', payload });
          return { eq: async () => ({ error: null }) };
        },
        insert: (payload: unknown) => {
          writes.push({ table, op: 'insert', payload });
          return Promise.resolve({ error: null });
        },
      };
      return chain;
    },
  });
}

const request = (url: string, init?: RequestInit) => new Request(`https://site.test${url}`, init);

const formPost = (fields: Record<string, string>) =>
  new Request(`https://site.test/api/crm/unsubscribe?token=${TOKEN}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });

beforeEach(() => {
  vi.clearAllMocks();
  writes = [];
  rateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 });
  createAdminClient.mockImplementation(
    fakeClient({
      id: 'c-1',
      email: 'organizer@example.com',
      first_name: 'Robin',
      do_not_email: false,
    })
  );
});

describe('GET /api/crm/unsubscribe', () => {
  it('writes nothing at all', async () => {
    const res = await GET(request(`/api/crm/unsubscribe?token=${TOKEN}`));

    expect(res.status).toBe(200);
    // The whole point. A link scanner or a prefetcher hitting this URL must
    // leave the contact exactly as it found them.
    expect(writes).toEqual([]);
  });

  it('asks for confirmation rather than claiming it already happened', async () => {
    const res = await GET(request(`/api/crm/unsubscribe?token=${TOKEN}`));
    const html = await res.text();

    expect(html).toContain('Stop chapter emails?');
    // The old copy said "You're unsubscribed" on a GET that had, in fact,
    // unsubscribed them — and also on a GET that had not, which is worse.
    expect(html).not.toContain('You&rsquo;re unsubscribed');
  });

  it('offers a real form, because a link would be a GET and a GET must not write', async () => {
    const html = await (await GET(request(`/api/crm/unsubscribe?token=${TOKEN}`))).text();

    expect(html).toMatch(/<form[^>]+method="post"/i);
    expect(html).toContain('name="confirm" value="1"');
  });

  it('never indexes, and never caches', async () => {
    const res = await GET(request(`/api/crm/unsubscribe?token=${TOKEN}`));
    expect(res.headers.get('x-robots-tag')).toMatch(/noindex/);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('escapes the greeting rather than interpolating markup', async () => {
    createAdminClient.mockImplementation(
      fakeClient({
        id: 'c-1',
        email: 'x@example.com',
        first_name: '<script>alert(1)</script>',
        do_not_email: false,
      })
    );
    const html = await (await GET(request(`/api/crm/unsubscribe?token=${TOKEN}`))).text();

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('rejects a malformed token without touching the database', async () => {
    const res = await GET(request('/api/crm/unsubscribe?token=not-a-uuid'));
    expect(res.status).toBe(400);
    expect(writes).toEqual([]);
  });

  it('reports an unknown token as invalid, revealing nothing about the list', async () => {
    createAdminClient.mockImplementation(fakeClient(null));
    const res = await GET(request(`/api/crm/unsubscribe?token=${TOKEN}`));
    expect(res.status).toBe(404);
    expect(writes).toEqual([]);
  });
});

describe('POST /api/crm/unsubscribe', () => {
  it('performs the opt-out', async () => {
    const res = await POST(formPost({ token: TOKEN, confirm: '1' }));

    expect(res.status).toBe(200);
    const update = writes.find((w) => w.op === 'update');
    expect(update).toBeDefined();
    expect(update?.payload).toMatchObject({ do_not_email: true });
    // And it is recorded, so the organizer can see why a contact stopped
    // receiving mail.
    expect(writes.some((w) => w.table === 'crm_activities' && w.op === 'insert')).toBe(true);
  });

  it('answers an RFC 8058 auto-confirm with 204 and no body', async () => {
    // `List-Unsubscribe-Post` posts the same URL with an empty body and no
    // `confirm` marker. That absence is how the two POST shapes are told apart —
    // deliberately, rather than by sniffing `Accept` or a user-agent, which would
    // silently start returning 204 to a real person if a mail client changed a
    // header.
    const res = await POST(
      new Request(`https://site.test/api/crm/unsubscribe?token=${TOKEN}`, { method: 'POST' })
    );

    expect(res.status).toBe(204);
    expect(writes.some((w) => w.op === 'update')).toBe(true);
  });

  it('is idempotent, so a double click or a replayed auto-confirm writes once', async () => {
    createAdminClient.mockImplementation(
      fakeClient({
        id: 'c-1',
        email: 'organizer@example.com',
        first_name: 'Robin',
        do_not_email: true,
      })
    );

    await POST(formPost({ token: TOKEN, confirm: '1' }));

    // No second update and, more importantly, no second activity row — an
    // idempotent write that appended an audit row each time would make the
    // contact's timeline lie.
    expect(writes).toEqual([]);
  });

  it('rejects a malformed token without writing', async () => {
    const res = await POST(formPost({ token: 'nope', confirm: '1' }));
    expect(res.status).toBe(400);
    expect(writes).toEqual([]);
  });

  it('never indexes the confirmation', async () => {
    const res = await POST(formPost({ token: TOKEN, confirm: '1' }));
    expect(res.headers.get('x-robots-tag')).toMatch(/noindex/);
  });
});
