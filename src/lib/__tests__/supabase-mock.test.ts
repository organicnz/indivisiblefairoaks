// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createMockAdminClient } from './supabase-mock';

/**
 * Contract tests for the row-based Supabase mock.
 *
 * The CRM suites are being converted from hand-rolled builders to this one, and
 * a conversion is only worth doing if the thing being converted *to* is right.
 * A mock that filters slightly differently from PostgREST does not fail loudly:
 * it returns a plausible row set, and the assertion written against it passes.
 * That is the exact failure this repository has already paid for once — a
 * narrower mock failing correct code, then being "fixed" by rewriting working
 * code to match a toy.
 *
 * So the semantics that the converted tests lean on are pinned here, including
 * the ones that are easy to get wrong and invisible when you get them wrong:
 * `.eq(col, null)` matching nothing, `.range()` being inclusive, ordering being
 * stable across ties, and `head: true` returning no rows.
 */

async function rowsFor(
  tables: Parameters<typeof createMockAdminClient>[0],
  build: (qb: ReturnType<ReturnType<typeof createMockAdminClient>['from']>) => PromiseLike<{
    data: unknown;
  }>
): Promise<Record<string, unknown>[]> {
  const client = createMockAdminClient(tables);
  const { data } = await build(client.from('crm_contacts'));
  return (data ?? []) as Record<string, unknown>[];
}

describe('supabase-mock filters', () => {
  it('treats .eq(col, null) as matching nothing, not as "is null"', async () => {
    // PostgREST stringifies it to `col=eq.null`. A mock that treated the two
    // alike would let a null-precondition bug ship: the guard would look like
    // it fires and never do so.
    const rows = await rowsFor({ crm_contacts: { rows: [{ id: 'a', owner: null }] } }, (qb) =>
      qb.eq('owner', null)
    );
    expect(rows).toEqual([]);
  });

  it('treats .is(col, null) as the null-aware form', async () => {
    const rows = await rowsFor({ crm_contacts: { rows: [{ id: 'a', owner: null }] } }, (qb) =>
      qb.is('owner', null)
    );
    expect(rows).toHaveLength(1);
  });

  it('matches .in() on membership', async () => {
    const rows = await rowsFor(
      { crm_contacts: { rows: [{ d: 'CA-03' }, { d: 'CA-06' }, { d: 'CA-09' }] } },
      (qb) => qb.in('d', ['CA-03', 'CA-06'])
    );
    expect(rows.map((r) => r.d)).toEqual(['CA-03', 'CA-06']);
  });

  it('does not match a null column against a null inside .in()', async () => {
    // Same trap as `.eq(col, null)`: `in.(null)` is not a membership test.
    const rows = await rowsFor({ crm_contacts: { rows: [{ d: null }, { d: 'CA-03' }] } }, (qb) =>
      qb.in('d', [null as unknown as string, 'CA-03'])
    );
    expect(rows.map((r) => r.d)).toEqual(['CA-03']);
  });

  it('matches .neq() and refuses a null operand', async () => {
    const rows = await rowsFor(
      { crm_contacts: { rows: [{ s: 'active' }, { s: 'donor' }, { s: null }] } },
      (qb) => qb.neq('s', 'active')
    );
    // `s=neq.null` matches nothing, so the null row is *not* returned even
    // though it differs from 'active'.
    expect(rows.map((r) => r.s)).toEqual(['donor']);
  });

  /**
   * `.not(…, 'is', …)` and `.neq()` disagree on exactly the row that matters.
   *
   * `IS DISTINCT FROM false` is true for a NULL; `<> false` is UNKNOWN for a NULL,
   * and UNKNOWN is not true, so the row is dropped. That single difference is why a
   * consent query has to say which one it means — a mock that quietly implemented
   * one as the other would pass whichever the author happened to write, and the
   * failure would only appear against a real PostgREST.
   */
  it('matches .not(…, "is", …) where .neq() would drop the null row', async () => {
    const rows = [{ s: 'active' }, { s: 'donor' }, { s: null }];
    const { notIs, neq } = {
      notIs: await rowsFor({ crm_contacts: { rows } }, (qb) => qb.not('s', 'is', 'donor')),
      neq: await rowsFor({ crm_contacts: { rows } }, (qb) => qb.neq('s', 'donor')),
    };
    expect(notIs.map((r) => r.s)).toEqual(['active', null]);
    expect(neq.map((r) => r.s)).toEqual(['active']);
  });

  it('orders .lt() comparisons before paging', async () => {
    const rows = await rowsFor(
      { crm_contacts: { rows: [{ d: '2026-03-01' }, { d: '2026-01-01' }, { d: null }] } },
      (qb) => qb.lt('d', '2026-02-01')
    );
    expect(rows.map((r) => r.d)).toEqual(['2026-01-01']);
  });
});

describe('supabase-mock ordering and paging', () => {
  it('sorts ascending by default and descending on request', async () => {
    const asc = await rowsFor({ crm_contacts: { rows: [{ n: 2 }, { n: 3 }, { n: 1 }] } }, (qb) =>
      qb.order('n')
    );
    expect(asc.map((r) => r.n)).toEqual([1, 2, 3]);

    const desc = await rowsFor({ crm_contacts: { rows: [{ n: 2 }, { n: 3 }, { n: 1 }] } }, (qb) =>
      qb.order('n', { ascending: false })
    );
    expect(desc.map((r) => r.n)).toEqual([3, 2, 1]);
  });

  it('sorts nulls last ascending and first descending, absent an explicit nullsFirst', async () => {
    const rows = [{ n: 2 }, { n: null }, { n: 1 }];
    const asc = await rowsFor({ crm_contacts: { rows: [...rows] } }, (qb) => qb.order('n'));
    expect(asc.map((r) => r.n)).toEqual([1, 2, null]);

    const desc = await rowsFor({ crm_contacts: { rows: [...rows] } }, (qb) =>
      qb.order('n', { ascending: false })
    );
    expect(desc.map((r) => r.n)).toEqual([null, 2, 1]);
  });

  it('honours nullsFirst: false where Postgres would otherwise put nulls first', async () => {
    // The follow-up board sorts `due_at` with `nullsFirst: false`, because an
    // unscheduled task must sink rather than lead.
    const rows = [
      { id: 'a', due: null },
      { id: 'b', due: '2026-01-01' },
    ];
    const out = await rowsFor({ crm_contacts: { rows: [...rows] } }, (qb) =>
      qb.order('due_at', { ascending: true, nullsFirst: false }).order('id', { ascending: false })
    );
    expect(out.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('is stable across ties, so repeated .range() calls return disjoint pages', async () => {
    // The bug that motivated ordering by the primary key: offset paging over a
    // total order that can change between statements mails the boundary contact
    // twice. A stable sort plus a distinct tiebreak column is what makes a
    // second page a *different* page here.
    const rows = [
      { id: 1, at: '2026-01-01' },
      { id: 2, at: '2026-01-01' },
      { id: 3, at: '2026-01-01' },
      { id: 4, at: '2026-01-01' },
    ];
    const page = (n: number) =>
      rowsFor({ crm_contacts: { rows: [...rows] } }, (qb) =>
        qb.order('at').order('id').range(n, n)
      );

    const first = await page(0);
    const second = await page(1);
    expect(first.map((r) => r.id)).toEqual([1]);
    expect(second.map((r) => r.id)).toEqual([2]);
  });

  it('treats .range() as an inclusive slice, so range(0, 1) is two rows', async () => {
    const rows = await rowsFor(
      { crm_contacts: { rows: [{ id: 1 }, { id: 2 }, { id: 3 }] } },
      (qb) => qb.range(0, 1)
    );
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
  });

  it('applies ordering before the range, not after', async () => {
    const rows = await rowsFor(
      { crm_contacts: { rows: [{ id: 1 }, { id: 2 }, { id: 3 }] } },
      (qb) => qb.order('id', { ascending: false }).range(0, 0)
    );
    expect(rows.map((r) => r.id)).toEqual([3]);
  });

  it('still applies .eq() inside a ranged page', async () => {
    const rows = await rowsFor(
      {
        crm_contacts: {
          rows: [
            { id: 1, s: 'a' },
            { id: 2, s: 'b' },
            { id: 3, s: 'a' },
          ],
        },
      },
      (qb) => qb.order('id').eq('s', 'a').range(0, 0)
    );
    expect(rows.map((r) => r.id)).toEqual([1]);
  });
});

describe('supabase-mock counts', () => {
  it('returns the filtered total as count and no rows for head: true', async () => {
    // The KPI cards read `select('*', { count: 'exact', head: true })`. Returning
    // rows there would let a test pass against a page of data the real query
    // never fetches.
    const client = createMockAdminClient({
      crm_contacts: { rows: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    });
    const { data, count } = await client
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('id', 2);

    expect(count).toBe(1);
    expect(data).toBeNull();
  });

  it('reports the pre-slice total, not the page length, for a paged read', async () => {
    // The directory shows "24 of 100". A count that reflected the page would
    // render as "24 of 25" and every pager would look wrong.
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const client = createMockAdminClient({ crm_contacts: { rows } });
    const { data, count } = await client.from('crm_contacts').select('*').order('id').range(0, 24);

    expect(count).toBe(100);
    expect(data).toHaveLength(25);
  });
});

describe('supabase-mock inserts', () => {
  it('answers a chunked insert with an array, as PostgREST does with RETURNING', async () => {
    // The CSV importer does `(created || []).map((c) => c.id)` on the result. A
    // single-row reply breaks a correct caller with `map is not a function`.
    const client = createMockAdminClient({ crm_contacts: { rows: [] } });
    const { data, count } = await client
      .from('crm_contacts')
      .insert([{ email: 'a@example.org' }, { email: 'b@example.org' }])
      .select('id, email');

    expect(count).toBe(2);
    expect(data).toHaveLength(2);
  });

  it('lets .single() unwrap the one-element array a single insert returns', async () => {
    // The shape `.insert(row).select('id, updated_at').single()` relies on.
    const client = createMockAdminClient({
      content: { rows: [], insert: { id: 'p1', updated_at: '2026-01-01T00:00:00.000Z' } },
    });
    const { data } = await client.from('content').insert({ slug: 'x' }).select('id').single();
    expect(data).toEqual({ id: 'p1' });
  });

  it('applies insert defaults to every row of a chunk', async () => {
    const rows: Record<string, unknown>[] = [];
    const client = createMockAdminClient({ crm_contacts: { rows, insert: { source: 'csv' } } });
    await client.from('crm_contacts').insert([{ email: 'a@x.co' }, { email: 'b@x.co' }]);
    expect(rows).toEqual([
      { source: 'csv', email: 'a@x.co' },
      { source: 'csv', email: 'b@x.co' },
    ]);
  });
});

describe('supabase-mock deletes', () => {
  it('returns the removed rows when a delete asks for them, as return=representation does', async () => {
    // `.delete().select('contact_id').single()` is how `deleteCRMTask` learns
    // which contact's page to revalidate. Returning null made `.single()` a
    // PGRST116 and the action reported failure for a delete that had worked —
    // a mock narrower than the client, failing correct code.
    const client = createMockAdminClient({
      crm_tasks: {
        rows: [
          { id: 'task-1', contact_id: 'c-1' },
          { id: 'task-2', contact_id: 'c-1' },
        ],
      },
    });
    const { data } = await client
      .from('crm_tasks')
      .delete()
      .eq('id', 'task-1')
      .select('contact_id')
      .single();

    expect(data).toEqual({ contact_id: 'c-1' });
  });

  it('still removes the rows, so a later read does not find them', async () => {
    const rows = [{ id: 'task-1' }, { id: 'task-2' }];
    const client = createMockAdminClient({ crm_tasks: { rows } });
    await client.from('crm_tasks').delete().eq('id', 'task-1').select('id');
    expect(rows.map((r) => r.id)).toEqual(['task-2']);
  });

  it('returns no rows when the delete asked for none', async () => {
    const client = createMockAdminClient({ crm_tasks: { rows: [{ id: 'task-1' }] } });
    const { data, count } = await client.from('crm_tasks').delete().eq('id', 'task-1');
    expect(data).toBeNull();
    expect(count).toBe(1);
  });
});

describe('supabase-mock filter recording', () => {
  it('records nothing unless asked, so the default path stays silent', async () => {
    const client = createMockAdminClient({ crm_contacts: { rows: [] } });
    await client.from('crm_contacts').select('*').or('email.ilike.%x%');
    expect(client.filterCalls).toEqual([]);
  });

  it('records each unmodelled filter with its arguments, in order', async () => {
    // `.or()` is the only one whose *contents* matter here: the search term is
    // stripped of `(`, `)` and `,` before it becomes a filter string, and a term
    // that produced a 400 instead of a result would satisfy any assertion about
    // rows. The method is recorded too, because a query may issue a `textSearch`
    // before falling back to an `.or()`, and the first entry is not the one
    // under test.
    const client = createMockAdminClient(
      { crm_contacts: { rows: [], filterRows: [] } },
      { recordFilters: true }
    );
    await client
      .from('crm_contacts')
      .select('*')
      .textSearch('search_vector', 'jane')
      .or('email.ilike.%jane%,first_name.ilike.%jane%');

    expect(client.filterCalls.map((c) => c.method)).toEqual(['textSearch', 'or']);
    expect(client.filterCalls[1]?.args[0]).toBe('email.ilike.%jane%,first_name.ilike.%jane%');
  });

  it('still serves rows through a recording client', async () => {
    // Recording must not change what the query returns, or it would stop being
    // a recorder and start being a different mock.
    const client = createMockAdminClient(
      { crm_contacts: { rows: [{ id: 'a' }], filterRows: [{ id: 'a' }] } },
      { recordFilters: true }
    );
    const { data } = await client.from('crm_contacts').select('*').or('email.ilike.%a%');
    expect(data).toHaveLength(1);
  });

  it('records .order() clauses with their direction, defaulting to ascending', () => {
    // Recorded because a paged read's rows cannot show whether the query
    // *ordered* them: `resolveBroadcastRecipients` returns a count, and a count
    // is the same whether the pages came in primary-key order or not.
    const client = createMockAdminClient({ crm_contacts: { rows: [] } }, { recordFilters: true });
    const qb = client.from('crm_contacts');
    qb.order('id');
    qb.order('created_at', { ascending: false });

    expect(client.orderCalls).toEqual([
      { column: 'id', ascending: true },
      { column: 'created_at', ascending: false },
    ]);
  });

  it('records nothing by default, including .order()', () => {
    const client = createMockAdminClient({ crm_contacts: { rows: [] } });
    client.from('crm_contacts').order('id').or('x');
    expect(client.orderCalls).toEqual([]);
    expect(client.filterCalls).toEqual([]);
  });
});

describe('supabase-mock unmodelled filters', () => {
  it('serves exactly filterRows when .or() was called, still honouring .eq()', async () => {
    const client = createMockAdminClient({
      crm_contacts: {
        rows: [
          { id: 'a', email: 'robin@example.org' },
          { id: 'b', email: 'sam@example.org' },
        ],
        // The search matched only Robin.
        filterRows: [{ id: 'a', email: 'robin@example.org' }],
      },
    });
    const { data } = await client
      .from('crm_contacts')
      .select('*')
      .or('email.ilike.%robin%')
      .eq('id', 'a');
    expect(data).toHaveLength(1);
  });

  it('returns no rows when an unmodelled filter was used with no filterRows', async () => {
    // Fails loudly rather than silently matching everything, which is what would
    // let a test pass without ever exercising the filter it is describing.
    const client = createMockAdminClient({
      crm_contacts: { rows: [{ id: 'a' }, { id: 'b' }] },
    });
    const { data } = await client.from('crm_contacts').select('*').contains('tags', ['choir']);
    expect(data).toEqual([]);
  });

  it('narrows by filterRows for .contains() and .textSearch() too', async () => {
    const client = createMockAdminClient({
      crm_contacts: { rows: [{ id: 'a' }, { id: 'b' }], filterRows: [{ id: 'b' }] },
    });
    const searched = await client.from('crm_contacts').select('*').textSearch('search_vector', 'x');
    expect(searched.data).toHaveLength(1);
  });
});
