/* oxlint-disable no-thenable -- models supabase-js's thenable builder; see `then` below. */
import { vi } from 'vitest';

/**
 * A faithful stand-in for a supabase-js query builder.
 *
 * ## Why this exists
 *
 * Every action test in this repo mocks the Supabase client, and each file
 * hand-rolled the smallest slice of the API its assertions needed. That is how
 * `saveContent` could call `.update().eq().select().maybeSingle()` — the shape
 * PostgREST actually requires to report whether an UPDATE matched a row — while
 * a test's `update()` returned `{ eq: () => Promise.resolve(...) }` and the
 * suite stayed green.
 *
 * The failure is symmetric and it cuts both ways:
 *
 *   - a mock **narrower** than the real client fails on correct code, which is
 *     how a real bug gets "fixed" by rewriting working code to match a toy;
 *   - a mock **wider** than the real client passes on code that would 4xx in
 *     production, which is the more expensive direction.
 *
 * So this models the parts of the builder the actions rely on, including the
 * behaviour that actually matters and is easy to get wrong:
 *
 *   - `.select()` is chainable after `.update()` / `.insert()` and is what makes
 *     the outcome observable at all. An UPDATE matching no rows returns
 *     `error: null, data: null`, indistinguishable from success without it.
 *   - Filters accumulate. `.eq('col', null)` must NOT match a null value — in
 *     PostgREST it produces `col=eq.null` and matches nothing — whereas `.is()`
 *     is the null-aware form. Actions that guess this write a precondition that
 *     silently never fires.
 *   - `maybeSingle()` returns `null` for zero rows and the row for one.
 *   - A row's `updated_at` moves on update only if the table says so, which is
 *     how a `BEFORE UPDATE` trigger is modelled.
 *
 * ## What it is not
 *
 * Not a database. No joins, no aggregates, no RLS, no `count`, no transactions,
 * no ordering or range filters. It models *the builder's chaining and filtering
 * semantics* so that action code can be tested against the API it will really
 * call — not Postgres. A test that needs real SQL belongs against a real
 * database, and pretending otherwise is how a `CHECK` constraint ships broken.
 */

/** A filter recorded by `.eq()` / `.is()` / `.like()`, applied by the terminal. */
interface Filter {
  kind: 'eq' | 'is' | 'like' | 'neq' | 'lt' | 'in' | 'notIs';
  column: string;
  value: unknown;
}

/** One `.order()` clause, in the order it was declared. */
interface Order {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
}

/**
 * SQL `LIKE` with `%` as the multi-character wildcard, and nothing else
 * wildcard-shaped.
 *
 * Regex metacharacters in the pattern are escaped so they match literally,
 * which leaves `%` as the only wildcard — the only one the reference queries in
 * this codebase use: all of them are `.like('body', '%<path>%')`, asking "does
 * any row's body mention this file". SQL's `_` single-character wildcard is
 * deliberately **not** implemented. Half-supporting a wildcard would let
 * `.like('body', '%a_b%')` match where Postgres would not, which turns a real
 * reference check into a false pass — the exact failure this file exists to
 * prevent.
 */
function likeMatches(actual: unknown, pattern: string): boolean {
  if (typeof actual !== 'string') return false;
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = escaped.split('%').join('.*');
  return new RegExp(`^${body}$`, 's').test(actual);
}

export interface MockTableConfig {
  /** Rows to serve. Mutated in place by updates, so assert on the result. */
  rows?: Record<string, unknown>[];
  /**
   * Run after the payload is merged, before the row is returned. This is where
   * a `BEFORE UPDATE` trigger is modelled:
   *
   * ```ts
   * onUpdate: (row) => { row.updated_at = new Date().toISOString(); }
   * ```
   */
  onUpdate?: (row: Record<string, unknown>) => void;
  /** Rows returned by `.insert()`, minus whatever the trigger set. */
  insert?: Record<string, unknown>;
  onInsert?: (row: Record<string, unknown>) => void;
  /** Force an error for the terminal operation, to exercise the failure path. */
  error?: { message: string; code?: string } | null;
  /**
   * Errors keyed on the *filter* that triggers them.
   *
   * `error` fails every query against the table, which is right for a single read
   * and useless for a function that issues several against one table and reports
   * each separately — `getBroadcastRecipientCount` is exactly that: an audience
   * count and an exclusion count over the same column, and a failure in one must
   * not be reported as the other.
   *
   * Matching on the operator as well as the column is what makes that possible:
   * both queries filter `do_not_email`, and they do it differently.
   *
   * ```ts
   * errors: [
   *   { kind: 'notIs', column: 'do_not_email', error: { message: 'scan failed' } },
   * ]
   * ```
   *
   * A list rather than a record so two entries can name the same column with
   * different operators. First match wins, so order is the precedence.
   */
  errors?: { kind: Filter['kind']; column: string; error: { message: string; code?: string } }[];
  /**
   * `.or()` / `.contains()` / `.textSearch()` are not modelled.
   *
   * They are PostgREST *query-string* languages — `email.ilike.%x%,due_at.is.null`
   * with parenthesised grouping — and reproducing them means reimplementing
   * PostgREST's parser, at which point this file is no longer "a stand-in for
   * the builder's chaining semantics" and is a database with none of a
   * database's guarantees. A filter that silently matched everything would be
   * worse than an absent one, so a test that reaches one must say so: set
   * `filterRows` to the rows that filter actually selects, and the mock serves
   * exactly those.
   *
   * It is a list rather than a predicate so the intent stays legible in the
   * test — "this contact matched the search" — instead of becoming an
   * `unfilteredPredicate` that passes on a filter which matches nothing.
   */
  filterRows?: Record<string, unknown>[];
}

/** Whether a row satisfies every recorded filter. */
function matches(row: Record<string, unknown>, filters: readonly Filter[]): boolean {
  return filters.every(({ kind, column, value }) => {
    const actual = row[column];
    // `.eq(col, null)` does not match null in PostgREST — it stringifies to
    // `col=eq.null`. `.is(col, null)` is the form that does. Reproducing the
    // difference is the point; a mock that treats them alike would let a
    // null-precondition bug pass.
    if (kind === 'like') return likeMatches(actual, String(value));
    if (kind === 'in') {
      // A null *inside* the list is the trap, not a null list: `in.(null,'CA-03')`
      // still matches the non-null entries, but the null entry compares as
      // unknown and matches nothing. So the row's own value is what has to be
      // non-null here — guarding the list instead would let a null column satisfy
      // a membership test, which is the bug the guard was meant to catch.
      if (!Array.isArray(value)) return false;
      if (actual === null || actual === undefined) return false;
      return value.includes(actual);
    }
    if (kind === 'neq') {
      // Same shape, opposite sign: `s <> 'active'` is UNKNOWN — not true — when
      // `s` is null, so a null row is excluded rather than kept as "different".
      // It is a NULL operand (`col=neq.null`) that matches nothing at all.
      if (value === null || value === undefined) return false;
      if (actual === null || actual === undefined) return false;
      return actual !== value;
    }
    if (kind === 'lt') {
      // Both sides are `unknown` on the row and the filter, but `lt` is only
      // ever applied to ordered scalars here — an ISO timestamp or a number —
      // and `a < b` is exactly Postgres's comparison for those. A null operand
      // is UNKNOWN and therefore not true, on either side.
      if (actual === null || actual === undefined) return false;
      if (value === null || value === undefined) return false;
      return (actual as number | string) < (value as number | string);
    }
    if (kind === 'eq') {
      if (value === null || value === undefined) return false;
      return actual === value;
    }
    // `IS NOT FALSE` / `IS DISTINCT FROM false`: true for `NULL` as well as for
    // every non-false value. The explicit null branch is what makes this differ
    // from `neq`, which drops a null row entirely.
    if (kind === 'notIs') {
      return actual !== value;
    }
    if (value === null) return actual === null || actual === undefined;
    return actual === value;
  });
}

/**
 * Apply the `.order()` clauses in declaration order.
 *
 * A stable sort is required, not a stylistic choice: `.range()` pages by offset,
 * so a query that orders on a column with ties — `created_at` across a hundred
 * rows inserted in one CSV import — must fall back to the previous clause's
 * order or two identical `.range()` calls return different rows. That
 * instability is what `applyAudienceFilters` was fixed for.
 */
function applyOrder<T extends Record<string, unknown>>(rows: T[], orders: readonly Order[]): T[] {
  if (orders.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { column, ascending, nullsFirst } of orders) {
      const left = a[column];
      const right = b[column];
      const leftNull = left === null || left === undefined;
      const rightNull = right === null || right === undefined;
      // Postgres defaults to NULLS LAST for ASC and NULLS FIRST for DESC; the
      // mock follows that default and honours an explicit override.
      if (leftNull || rightNull) {
        if (leftNull && rightNull) continue;
        const nullsLast = ascending;
        const nullIsFirst = nullsFirst ?? !nullsLast;
        return leftNull ? (nullIsFirst ? -1 : 1) : nullIsFirst ? 1 : -1;
      }
      if (left === right) continue;
      const cmp = left < right ? -1 : 1;
      return ascending ? cmp : -cmp;
    }
    return 0;
  });
}

export class MockQueryBuilder {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private columns: string | null = null;
  private limitCount: number | null = null;
  private rangeBounds: { from: number; to: number } | null = null;
  private headOnly = false;
  /** An insert takes one object or a chunk of them, as PostgREST does. */
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private mode: 'select' | 'update' | 'insert' | 'delete' = 'select';
  /** True once `.or()` / `.contains()` / `.textSearch()` has been called. */
  private unmodelledFilter = false;

  constructor(private readonly config: MockTableConfig) {}

  select(columns = '', options?: { count?: string; head?: boolean }) {
    this.columns = columns;
    if (options?.head) this.headOnly = true;
    // `count: 'exact'` makes PostgREST report the number of rows the *filters*
    // matched, which is not the number of rows returned once `.range()` has sliced
    // them. That distinction is the whole basis of a pager: a caller rendering
    // `data.length` as the total tells a chapter with 72 campaigns it has 25, and
    // the older 47 become unreachable with nothing on screen saying why.
    //
    // Modelled as the pre-slice count, which the terminal already computes.
    // (`filtered.length` below is already the pre-slice count — exactly what
    // PostgREST returns. No flag needed, and no empty branch either: the note
    // that used to sit in an `if (options?.count) {}` read as an unfinished
    // implementation, so it lives here as prose instead.)
    void options?.count;
    // `select` after `update`/`insert` is what asks for the affected rows back.
    // It must not reset the operation, or a chain like
    // `.update(row).eq(id, 1).select('id')` would become a read.
    if (this.mode === 'select') this.mode = 'select';
    this.columns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ kind: 'neq', column, value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ kind: 'lt', column, value });
    return this;
  }

  in(column: string, values: readonly unknown[]) {
    this.filters.push({ kind: 'in', column, value: values });
    return this;
  }

  like(column: string, pattern: string) {
    this.filters.push({ kind: 'like', column, value: pattern });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ kind: 'is', column, value });
    return this;
  }

  /**
   * `.not(column, operator, value)` — the PostgREST `not.<op>.<value>` form.
   *
   * Only `is` is modelled, because only `is` is used with it:
   * `not.is.false` is SQL `IS NOT FALSE`, which is true for `NULL` as well as for
   * `true`. That is the one that matters — it is how a query says "every state
   * except this one", which `.neq` cannot express at all.
   *
   * `.neq` and this are genuinely different, which is the trap:
   * `.neq(col, false)` is `col <> false`, and a NULL row is UNKNOWN rather than
   * true, so it is **excluded** — the opposite of what "everything except opted
   * in" means. Getting that backwards turns a consent audit into a mail run.
   */
  not(column: string, operator: string, value: unknown) {
    /*
     * Unmodelled operators fail loudly rather than degrading. The old code set
     * `unmodelledFilter` *and* pushed the filter as `notIs`, so
     * `.not('x','eq','y')` against a declared `filterRows` silently got `IS
     * NOT` semantics — the exact inversion the `neq`-vs-`not` note above
     * warns about, manufactured by the mock itself.
     */
    if (operator !== 'is') {
      this.unmodelledFilter = true;
      return this;
    }
    this.filters.push({ kind: 'notIs', column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({
      column,
      ascending: options?.ascending ?? true,
      ...(options?.nullsFirst === undefined ? {} : { nullsFirst: options.nullsFirst }),
    });
    return this;
  }

  /**
   * `.range(from, to)` is an **inclusive** 0-indexed slice, as in PostgREST —
   * `.range(0, 49)` is fifty rows, and `.range(50, 99)` the next fifty.
   *
   * Off-by-one here is invisible in a test that reads one page and invisible in
   * a test that asserts a total, so it is modelled explicitly rather than left
   * to whichever arithmetic the mock happened to use.
   */
  range(from: number, to: number) {
    this.rangeBounds = { from, to };
    return this;
  }

  /**
   * The three filter languages this mock does not implement.
   *
   * Recording that they were called is what stops `filterRows` being silently
   * ignored: a test that forgot to declare the result set gets **no rows**,
   * which fails loudly, rather than every row, which would pass without ever
   * exercising the filter.
   */
  or(_filter: string): this {
    this.unmodelledFilter = true;
    return this;
  }

  contains(_column: string, _values: readonly unknown[]): this {
    this.unmodelledFilter = true;
    return this;
  }

  textSearch(_column: string, _query: string, _options?: unknown): this {
    this.unmodelledFilter = true;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.payload = payload;
    this.mode = 'update';
    return this;
  }

  insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
    this.payload = payload;
    this.mode = 'insert';
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  /**
   * `.limit(n)` is a terminal *and* a filter.
   *
   * It is terminal because `deleteContentImage` awaits
   * `.select('id').like('body', '%…%').limit(1)` directly with no
   * `.maybeSingle()`, so the promise has to come from here. It is also a filter,
   * because ignoring the number would let a row past a `limit(1)` that Postgres
   * would never return — and a reference check that finds a row it should not
   * is a false *refusal*, which blocks a legitimate delete.
   */
  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  private terminal() {
    const config = this.config;
    if (config.error) return { error: config.error, count: null, data: null };
    if (config.errors) {
      for (const { kind, column, error } of config.errors) {
        if (this.filters.some((f) => f.kind === kind && f.column === column)) {
          return { error, count: null, data: null };
        }
      }
    }

    if (this.mode === 'delete') {
      const found = config.rows ?? [];
      const affected = found.filter((row) => matches(row, this.filters));
      // Removed from the backing array rather than blanked: a caller that
      // re-reads the row afterwards must not find it still there.
      for (const row of affected) {
        const at = found.indexOf(row);
        if (at >= 0) found.splice(at, 1);
      }
      // Without a `.select()` there is no row to return — but *with* one there
      // is. supabase-js sends `Prefer: return=representation` for
      // `.delete().select(...)`, which PostgREST honours, and
      // `deleteCRMTask` depends on it: it chains `.select('contact_id')` and
      // needs the deleted row to write an activity against. Returning `null`
      // unconditionally made `.single()` a PGRST116 and the action reported
      // failure for a delete that had worked — a mock narrower than the client
      // failing correct code, which is the failure mode this file exists to
      // prevent.
      if (this.columns === null) return { error: null, count: affected.length, data: null };
      return {
        error: null,
        count: affected.length,
        data: affected.map((row) => this.#project(row)),
      };
    }

    if (this.mode === 'insert') {
      // `.insert()` takes an object *or* an array, and PostgREST answers an
      // insert that asked for the rows back with an array either way — a
      // chunked CSV import does `(created || []).map(...)` on the result, so a
      // single-row reply here would break a correct caller with
      // `map is not a function`. `.single()` unwraps the one-element array, so
      // returning an array does not disturb the `.insert().select().single()`
      // chains elsewhere.
      const payloads = Array.isArray(this.payload)
        ? this.payload
        : [this.payload ?? ({} as Record<string, unknown>)];
      const inserted: Record<string, unknown>[] = [];
      for (const entry of payloads) {
        const row = { ...config.insert, ...entry };
        config.onInsert?.(row);
        config.rows?.push(row);
        inserted.push(row);
      }
      if (this.columns === null) return { error: null, count: inserted.length, data: null };
      return {
        error: null,
        count: inserted.length,
        data: inserted.map((row) => this.#project(row)),
      };
    }

    // `.or()` / `.contains()` / `.textSearch()` narrow the result set to
    // `filterRows`, but they compose with the filters the mock *does* model: a
    // search narrowed to one contact must still honour the `.eq('id', …)` the
    // code put in front of it, or the test would pass a query that returns
    // every row.
    const base = this.unmodelledFilter ? config.filterRows : config.rows;

    if (this.mode === 'update') {
      const affected = (base ?? []).filter((row) => matches(row, this.filters));
      for (const row of affected) {
        Object.assign(row, this.payload ?? {});
        config.onUpdate?.(row);
      }
      // No `.select()`: PostgREST returns nothing, and the caller cannot tell a
      // no-match write from a successful one. That is precisely why the actions
      // ask for the row back.
      if (this.columns === null) return { error: null, count: affected.length, data: null };
      return {
        error: null,
        count: affected.length,
        data: affected.length === 0 ? null : this.#project(affected[0] as Record<string, unknown>),
      };
    }

    const ordered = applyOrder(base ?? [], this.orders);
    const filtered = ordered.filter((row) => matches(row, this.filters));

    // `.range()` and `.limit()` are both slice operators and both apply *after*
    // ordering; `.range()` wins when both are present because it is the more
    // specific of the two in the chains this codebase writes.
    //
    // Both counts below come from `filtered`, never from `page`. That is the
    // distinction a pager depends on: `count: 'exact'` reports how many rows the
    // *filters* matched, while `data` holds the slice. A mock returning the slice
    // length would make `totalCount === data.length` always true, and a test
    // asserting a pager would pass while the real UI told a chapter with 72
    // campaigns it had 25 and made the other 47 unreachable.
    let page = filtered;
    if (this.rangeBounds) {
      const { from, to } = this.rangeBounds;
      page = page.slice(from, to + 1);
    } else if (this.limitCount !== null) {
      page = page.slice(0, this.limitCount);
    }

    // `head: true` asks for the count and no rows — which is how the KPI cards
    // are read. Returning rows there would let a test pass against a page of
    // data the real query never fetches.
    if (this.headOnly) return { error: null, count: filtered.length, data: null };

    const projected = page.map((row) => this.#project(row));
    return { error: null, count: filtered.length, data: projected };
  }

  /** Narrow to the requested columns, leaving `*` and `''` as the whole row. */
  #project(row: Record<string, unknown>): Record<string, unknown> {
    const columns = this.columns;
    if (!columns || columns === '*') return { ...row };
    const wanted = columns
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const out: Record<string, unknown> = {};
    for (const column of wanted) out[column] = row[column];
    return out;
  }

  async maybeSingle() {
    const { error, data } = this.terminal();
    if (error) return { error, data: null };
    if (data === null) return { error: null, data: null };
    const rows = Array.isArray(data) ? data : [data];
    return { error: null, data: rows[0] ?? null };
  }

  async single() {
    const { error, data } = this.terminal();
    if (error) return { error, data: null };
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    if (rows.length !== 1) {
      return {
        error: {
          message: 'JSON object requested, multiple (or no) rows returned',
          code: 'PGRST116',
        },
        data: null,
      };
    }
    return { error: null, data: rows[0] };
  }

  /**
   * The builder is a thenable, because supabase-js's is.
   *
   * `deleteContent` awaits `adminClient.from('content').delete().eq('id', id)`
   * with no terminal method at all, so a mock without this throws `TypeError:
   * not a function` on a line that is correct. Modelling the thenable is the
   * whole reason this file exists.
   *
   * `PostgrestSingleResponse` is the resolved type, and the signature is a real
   * `PromiseLike` rather than a hand-rolled `(value) => unknown`. The looser
   * shape did not merely read worse: it made the builder unassignable to
   * `PromiseLike<T>`, so a test could not await one without a cast.
   */
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable, see above
  then<TResult1 = PostgrestSingleResponse, TResult2 = never>(
    onfulfilled?: ((value: PostgrestSingleResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.terminal()).then(onfulfilled, onrejected);
  }
}

/**
 * Build an `adminClient`-shaped object for `requireAdmin` to return.
 *
 * ```ts
 * requireAdmin.mockResolvedValue({
 *   adminClient: createMockAdminClient({
 *     content: { rows: [{ id: 7, slug: 'x', updated_at: 'T0' }] },
 *   }),
 * });
 * ```
 */
export interface MockAdminClient {
  // A plain function type rather than a bare `vi.fn()`: tests legitimately wrap
  // `from` to make a row appear or vanish between a read and the write that
  // follows it, and Vitest's untyped `Mock<Procedure | Constructable>` is not
  // assignable to a callable signature.
  from: (table: string) => MockQueryBuilder;
  /**
   * Every `.or()` / `.contains()` / `.textSearch()` the client was asked for, in
   * order. Empty unless `recordFilters` was requested.
   *
   * There is a narrow class of test a row-based mock cannot serve: one about the
   * *contents of the filter* rather than the rows it selects. The CRM search is
   * built by stripping `,`, `(` and `)` out of the user's term before it becomes
   * `email.ilike.%…%`, and a term that produced a 400 instead of a result would
   * pass every assertion about rows. So those tests need the arguments.
   *
   * It lives here rather than in each suite because it is a property of the
   * builder, and two copies of a recorder is one more thing to keep in step.
   */
  filterCalls: { method: UnmodelledFilterMethod; args: unknown[] }[];
  /**
   * Every `.order(column, options)` the client was asked for, in order. Empty
   * unless `recordFilters` was requested.
   *
   * `.order()` **is** evaluated by this mock — it has to be, or offset paging
   * would be untestable. So why record it? For the case where the rows a query
   * selects cannot show whether the query *ordered* them.
   * `resolveBroadcastRecipients` pages with `.range()` and hands its result
   * straight to the caller: the resolved audience is never returned by any
   * action, only counted, and a count is identical whether the pages were taken
   * in primary-key order or in whatever order the rows arrived. Deleting
   * `.order('id', …)` — the fix for a contact being mailed twice across a page
   * boundary — therefore fails no assertion about rows anywhere in the suite.
   */
  orderCalls: { column: string; ascending: boolean }[];
}

/** The three PostgREST filter languages this mock records but does not evaluate. */
export type UnmodelledFilterMethod = 'or' | 'contains' | 'textSearch';

/** The shape every terminal operation resolves to, as `PostgrestFilterResponse`. */
export interface PostgrestSingleResponse {
  error: { message: string; code?: string } | null;
  count: number | null;
  data: unknown;
}

export function createMockAdminClient(
  tables: Record<string, MockTableConfig>,
  options?: { recordFilters?: boolean }
): MockAdminClient {
  const filterCalls: { method: UnmodelledFilterMethod; args: unknown[] }[] = [];
  const orderCalls: { column: string; ascending: boolean }[] = [];
  const from = vi.fn((table: string) => {
    const builder = new MockQueryBuilder(tables[table] ?? {});
    if (!options?.recordFilters) return builder;
    // Each wrapper must return the builder (not an opaque `unknown`) so the
    // chain keeps type-checking after it has been wrapped — a recorder that
    // broke `.select()` on every call would be worse than no recorder.
    const record =
      <A extends unknown[], R>(method: UnmodelledFilterMethod, inner: (...args: A) => R) =>
      (...args: A): R => {
        filterCalls.push({ method, args });
        return inner(...args);
      };
    builder.or = record('or', builder.or.bind(builder));
    builder.contains = record('contains', builder.contains.bind(builder));
    builder.textSearch = record('textSearch', builder.textSearch.bind(builder));
    const innerOrder = builder.order.bind(builder);
    builder.order = (column: string, orderOptions?: { ascending?: boolean }) => {
      orderCalls.push({ column, ascending: orderOptions?.ascending ?? true });
      return innerOrder(column, orderOptions);
    };
    return builder;
  });
  return { from, filterCalls, orderCalls };
}

/**
 * A `BEFORE UPDATE` trigger that sets `updated_at`, matching
 * `public.touch_content_updated_at()`.
 *
 * Shared rather than re-written per test, because the value it produces is what
 * an optimistic-concurrency precondition is compared against — a test that
 * modelled it as "unchanged" would pass a guard that never fires.
 */
export function touchUpdatedAt(): (row: Record<string, unknown>) => void {
  let tick = 0;
  return (row) => {
    tick += 1;
    // Monotonic and distinct on every update: two writes inside the same
    // millisecond must still produce different versions, or the second save
    // would compare equal to the first and the guard would miss.
    row.updated_at = new Date(Date.UTC(2026, 0, 1, 0, 0, tick)).toISOString();
  };
}

/**
 * The `DEFAULT now()` on `content.updated_at`, for the insert path.
 *
 * Modelled next to `touchUpdatedAt` so both halves of the column's behaviour
 * live together. Without it an insert returns a row whose `updated_at` is
 * `undefined`, which reads as "the version is unknown" and quietly teaches a
 * test that the editor's first autosave after creating a page cannot conflict.
 */
export function defaultInsertedUpdatedAt(): (row: Record<string, unknown>) => void {
  return (row) => {
    row.updated_at ??= '2026-01-01T00:00:00.000Z';
  };
}
