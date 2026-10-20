// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source-level guards on the tri-state consent migration.
 *
 * The migration's job is to make "we never asked them" a state the database can
 * hold, and then to make sure nothing quietly converts it back. Almost every
 * interesting failure in it is a *default* or an *overload*, which is to say a
 * failure that produces no error, no failed build and no failing test — the wrong
 * value simply lands in a column, and the audit that exists to catch exactly that
 * reports on the wrong set of people.
 *
 * Three of those are asserted here:
 *
 *   * the column has no default, because the old `false` default opted in
 *     everybody the code did not think about;
 *   * the four-argument RPC is dropped, because `CREATE OR REPLACE` with a
 *     different parameter count defines a *second* function rather than
 *     replacing the first, and the old one keeps its grants;
 *   * the `ON CONFLICT` branch fills in consent only when the row has no answer
 *     yet, so a form submission can record a first answer without being able to
 *     resubscribe somebody who unsubscribed.
 *
 * A test that reads SQL is not a test that runs it. Nothing here executes the
 * function; `migration-dryrun.mjs` is a `db push --dry-run`, which diffs and does
 * not apply, so these are guards against editing the SQL rather than evidence the
 * SQL works. The plpgsql that runs them is asserted the same way in
 * `merge-crm-contacts-migration.test.ts`.
 */
const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261005020000_contact_consent_tri_state.sql'
);
const SQL = await Bun.file(MIGRATION).text();

/** The earlier migration that created the consent indexes. */
const INDEX_MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261005000000_crm_segments_consent_and_stranded_broadcasts.sql'
);

/** The statements, with `--` comments stripped so the assertions match code only. */
const CODE = SQL.replace(/--[^\n]*/g, '');
const INDEX_CODE = (await Bun.file(INDEX_MIGRATION).text()).replace(/--[^\n]*/g, '');

function bodyOf(needle: string): string {
  const start = SQL.indexOf(needle);
  expect(start, `${needle} is not in the migration`).toBeGreaterThan(-1);
  const end = SQL.indexOf('$$;', start);
  expect(end, `${needle} has no terminating $$`).toBeGreaterThan(start);
  return SQL.slice(start, end);
}

const SUBMIT = 'FUNCTION public.submit_contact_submission(';
const TRIGGER = 'FUNCTION public.fn_sync_contact_submission_to_crm(';

describe('tri-state consent column', () => {
  it('drops the default that opted in everybody the code did not think about', () => {
    // `false` is "agreed". As a column default it meant any INSERT that did not
    // name the column — an import, an admin action, a future table — recorded a
    // consent the person never gave. The absence of a default is what makes
    // `NULL` reachable at all, so this is the load-bearing statement of the
    // migration rather than a detail.
    expect(CODE).toMatch(
      /ALTER (?:COLUMN )?do_not_email DROP DEFAULT|ALTER COLUMN do_not_email DROP DEFAULT/
    );
  });

  it('keeps the column NOT NULL-able by NOT adding NOT NULL', () => {
    // Explicitly: the column must stay nullable, or the third state cannot be
    // stored and the whole migration is theatre. Asserted as an absence because
    // an `ADD COLUMN ... NOT NULL` here would be the failure.
    const addColumn = CODE.match(/ADD COLUMN[^;]*do_not_email[^;]*/i);
    if (addColumn) expect(addColumn[0]).not.toMatch(/NOT\s+NULL/i);
  });

  /**
   * The two partial indexes the queries depend on, asserted in the migration that
   * actually creates them.
   *
   * This migration deliberately creates none, and the reason is worth guarding: it
   * makes `NULL` expressible, which is exactly the change that would invalidate a
   * partial index predicate if any of these had been written as `= true` / `= false`.
   * They were written as `IS NOT FALSE` and `IS FALSE`, so they were already
   * correct for a nullable column and mean the same thing before and after.
   *
   * A future edit that "simplifies" either predicate to `= false` breaks the
   * exclusion count's index while leaving every test and the build green, because
   * the query still returns the right rows — just from a sequential scan, and
   * only once the table is big enough to feel it.
   */
  it('has an index for the "not in the audience" population, predicate-shaped for NULLs', () => {
    // `IS NOT FALSE` is what covers `true` *and* NULL in one index — the same
    // population `not('do_not_email', 'is', false)` filters for.
    expect(INDEX_CODE).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_crm_contacts_do_not_email[\s\S]*?WHERE do_not_email IS NOT FALSE/i
    );
  });

  it('has a separate index for the audience the resolver pages', () => {
    // `IS FALSE` rather than `= false`, so the predicate is null-safe by
    // construction. Written as `= false` it would be equally valid SQL and would
    // quietly stop matching a nullable column.
    expect(INDEX_CODE).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_crm_contacts_opted_in_id[\s\S]*?WHERE do_not_email IS FALSE/i
    );
  });
});

describe('submit_contact_submission overload', () => {
  it('drops the four-argument version rather than leaving it callable', () => {
    // The single most consequential line in the migration.
    //
    // `CREATE OR REPLACE` cannot change a function's arity. Given a different
    // parameter count it defines a second function next to the first, so the
    // four-argument original would survive — still holding
    // `GRANT EXECUTE ... TO anon, authenticated` from the canonical schema, and
    // outside every `REVOKE` below, which names only the five-argument
    // signature. `anon` is the contact form's own role, so that is a reachable
    // RPC that no revocation in this migration covers.
    expect(CODE).toMatch(
      /DROP FUNCTION IF EXISTS public\.submit_contact_submission\(text, text, text, boolean\)/
    );
  });

  it('drops the old signature before defining the new one', () => {
    // Order, because it is the difference between the grant below covering every
    // function of this name and covering half of them.
    expect(CODE.indexOf('DROP FUNCTION IF EXISTS public.submit_contact_submission(')).toBeLessThan(
      CODE.indexOf(SUBMIT)
    );
  });

  it('grants exactly one arity, and it is the one it defines', () => {
    const signatures = [
      ...CODE.matchAll(
        /(?:REVOKE EXECUTE ON|GRANT\s+EXECUTE ON) FUNCTION public\.submit_contact_submission\(([^)]*)\)/g
      ),
    ].map((m) => m[1]);
    expect(new Set(signatures).size).toBe(1);
    expect(signatures[0]).toBe('text, text, text, boolean, boolean');
  });

  it('revokes from PUBLIC before granting to anon', () => {
    // Revoke-then-grant, in that order. The reverse leaves a window in which the
    // function is executable by `PUBLIC`, which includes every role in the
    // project including ones added later.
    //
    // `PUBLIC` is granted `EXECUTE` on new functions by default in Postgres, so
    // the revoke is not optional — it is the statement that stops the contact
    // form's RPC being callable by every role the project will ever have.
    const revoke = CODE.search(/REVOKE EXECUTE ON FUNCTION public\.submit_contact_submission\(/);
    const grant = CODE.search(/GRANT\s+EXECUTE ON FUNCTION public\.submit_contact_submission\(/);
    expect(revoke, 'the revoke from PUBLIC is missing').toBeGreaterThan(-1);
    expect(grant, 'the grant to anon is missing').toBeGreaterThan(-1);
    expect(revoke).toBeLessThan(grant);
  });

  it('records a decline, not an absence, when the caller omits the answer', () => {
    // `COALESCE(..., false)` on the consent parameter: a caller that sends no
    // fifth argument is unknown, and unknown is resolved to the answer that keeps
    // the person out of the audience. The opposite default would treat a stale
    // caller as opt-in.
    expect(bodyOf(SUBMIT)).toMatch(/COALESCE\(p_consent_to_email, false\)/);
  });

  it('keeps search_path empty', () => {
    // Same reasoning as the other definer functions: `anon` can insert into
    // `contact_submissions`, and this RPC runs with the owner's privileges.
    expect(bodyOf(SUBMIT)).toMatch(/SET search_path = ''/);
  });
});

describe('contact sync trigger and existing contacts', () => {
  it('writes the answer into the INSERT so the column default cannot win', () => {
    // The trigger names `do_not_email` explicitly. It did not before this
    // migration, so it took the column default — which meant every contact-form
    // submitter was opted in regardless of the checkbox, because the checkbox
    // was not there to be read.
    const body = bodyOf(TRIGGER);
    expect(body).toMatch(/NOT COALESCE\(NEW\.consent_to_email, false\)/);
  });

  it('fills in consent on conflict only when no answer was recorded', () => {
    // `IS NULL`, not `IS NOT TRUE`. The distinction is the whole safety argument:
    //
    //   existing true  — declined, maybe by unsubscribing. Untouched. A repeat
    //                    form visit is not consent.
    //   existing false — already agreed. Untouched.
    //   existing NULL  — never asked. This is the only case that changes, and it
    //                    has to: a resident whose record predates the migration
    //                    who ticks the box has answered the question, and
    //                    discarding the answer keeps them in the unasked pool for
    //                    ever.
    //
    // `IS NOT TRUE` instead would overwrite a decline, which resubscribes people
    // who opted out — the failure that gets a chapter in trouble.
    const conflict = bodyOf(TRIGGER).match(/ON CONFLICT \(email\) DO UPDATE[\s\S]*?RETURNING/s);
    expect(conflict).not.toBeNull();
    expect(conflict?.[0]).toMatch(
      /do_not_email = CASE\s+WHEN public\.crm_contacts\.do_not_email IS NULL THEN EXCLUDED\.do_not_email\s+ELSE public\.crm_contacts\.do_not_email\s+END/
    );
  });

  it('never clears the unsubscribe timestamp from the form', () => {
    // A decline is not an unsubscribe. Setting `unsubscribed_at` here would put a
    // "clicked unsubscribe at" timestamp on somebody who never saw a campaign.
    expect(bodyOf(TRIGGER)).not.toMatch(/unsubscribed_at\s*=/);
  });

  it('keeps the trigger attached to the table', () => {
    // A trigger that failed to re-attach leaves submissions un-synced, which is
    // the failure this migration exists to prevent, and it is silent.
    expect(CODE).toMatch(/trg_sync_contact_submission_to_crm/);
  });
});
