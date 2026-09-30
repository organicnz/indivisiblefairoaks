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
  kind: 'eq' | 'is' | 'like';
  column: string;
  value: unknown;
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
    if (kind === 'eq') {
      if (value === null || value === undefined) return false;
      return actual === value;
    }
    if (value === null) return actual === null || actual === undefined;
    return actual === value;
  });
}

class MockQueryBuilder {
  private filters: Filter[] = [];
  private columns: string | null = null;
  private limitCount: number | null = null;
  private payload: Record<string, unknown> | null = null;
  private mode: 'select' | 'update' | 'insert' | 'delete' = 'select';

  constructor(private readonly config: MockTableConfig) {}

  select(columns = '') {
    this.columns = columns;
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

  like(column: string, pattern: string) {
    this.filters.push({ kind: 'like', column, value: pattern });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ kind: 'is', column, value });
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.payload = payload;
    this.mode = 'update';
    return this;
  }

  insert(payload: Record<string, unknown>) {
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

    if (this.mode === 'delete') {
      const found = config.rows ?? [];
      const affected = found.filter((row) => matches(row, this.filters));
      // Removed from the backing array rather than blanked: a caller that
      // re-reads the row afterwards must not find it still there.
      for (const row of affected) {
        const at = found.indexOf(row);
        if (at >= 0) found.splice(at, 1);
      }
      // No `.select()` on a delete in PostgREST, so there is no row to return.
      return { error: null, count: affected.length, data: null };
    }

    if (this.mode === 'insert') {
      const row = { ...config.insert, ...this.payload };
      config.onInsert?.(row);
      config.rows?.push(row);
      const projected = this.#project(row);
      return { error: null, count: 1, data: this.columns === null ? null : projected };
    }

    if (this.mode === 'update') {
      const affected = (config.rows ?? []).filter((row) => matches(row, this.filters));
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

    let found = (config.rows ?? []).filter((row) => matches(row, this.filters));
    if (this.limitCount !== null) found = found.slice(0, this.limitCount);
    const projected = found.map((row) => this.#project(row));
    return { error: null, count: found.length, data: projected };
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
   */
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable, see above
  then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
    return Promise.resolve(this.terminal()).then(onFulfilled, onRejected);
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
export function createMockAdminClient(tables: Record<string, MockTableConfig>): {
  from: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => new MockQueryBuilder(tables[table] ?? {})),
  };
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
