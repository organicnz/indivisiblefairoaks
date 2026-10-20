import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source-level guards on `merge_crm_contacts`.
 *
 * The merge is plpgsql inside the database (migration 20261005030000), and it
 * became one statement precisely because four PostgREST statements could not be
 * atomic. That makes its behaviour invisible to every test in this repo: the
 * action suite mocks the client, and a row-based mock cannot execute SQL. The
 * combination rules — union the tags, sum the donations, OR the opt-out — are
 * exactly the ones a chapter would notice being wrong, and they are exactly the
 * ones nothing here can observe.
 *
 * So this reads the migration and asserts the properties that make it correct.
 * It is weaker than executing it, and deliberately so: a text assertion cannot
 * prove the function works, and the honest statement is that the function is
 * covered by `bun scripts/hooks/migration-dryrun.mjs` against a real database.
 * What this file does is make the *failure modes* fail loudly when someone edits
 * the SQL, which is the realistic regression — a deleted `FOR UPDATE`, a `DELETE`
 * reordered above the child `UPDATE`s, a dropped `REVOKE`.
 *
 * A test against a real Postgres belongs in the dry-run hook or a CI job with a
 * database service, not here pretending to be one.
 */
const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261005030000_merge_crm_contacts.sql'
);
const SQL = await Bun.file(MIGRATION).text();

/** The body of one function, so an assertion cannot match the wrong function. */
function bodyOf(name: string): string {
  const start = SQL.indexOf(`FUNCTION public.${name}(`);
  expect(start, `${name} is not defined in the migration`).toBeGreaterThan(-1);
  const end = SQL.indexOf('$$;', start);
  expect(end, `${name} has no terminating $$`).toBeGreaterThan(start);
  return SQL.slice(start, end);
}

const FN = bodyOf('merge_crm_contacts');

describe('merge_crm_contacts: privilege boundary', () => {
  it('is SECURITY DEFINER with an empty search_path', () => {
    // `SECURITY DEFINER` runs as the table owner and bypasses RLS, which is why
    // it needs `search_path = ''` with every relation qualified — the reasoning
    // is spelled out at length in 20261005010000.
    expect(FN).toMatch(/SECURITY DEFINER/);
    expect(FN).toMatch(/SET search_path = ''/);
  });

  it('qualifies every relation it names', () => {
    // A bare `crm_contacts` inside an ON CONFLICT DO UPDATE is resolved through
    // search_path, and with the path pinned to '' it would resolve to nothing —
    // which is the failure mode the qualified names prevent.
    //
    // Comments are stripped first: the function's prose names the same tables
    // unqualified while explaining why they must be qualified, and matching
    // inside a comment would report a function that is entirely correct as one
    // that is not.
    const code = FN.replace(/--[^\n]*/g, '');
    const bare = code.match(/(?<!public\.)\b(crm_contacts|crm_activities|crm_tasks|profiles)\b/g);
    expect(bare ?? []).toEqual([]);
  });

  it('is granted to service_role only', () => {
    // The real authorization boundary is `requireAdmin()` in the action. The
    // REVOKE is defence in depth: `PUBLIC` includes `anon`, and this function
    // folds one person's record into another's.
    expect(SQL).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.merge_crm_contacts\(uuid, uuid, uuid\) FROM PUBLIC, anon, authenticated;/
    );
    expect(SQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.merge_crm_contacts\(uuid, uuid, uuid\) TO service_role;/
    );
  });
});

describe('merge_crm_contacts: atomicity and concurrency', () => {
  it('locks both rows before writing anything', () => {
    // Two organizers merging the same pair both read, both wrote, and both added
    // `total_donated_cents` to the same pre-merge value — inflating the survivor's
    // giving total by one copy. The lock is what serialises them.
    expect(FN).toMatch(
      /SELECT \* INTO v_keep FROM public\.crm_contacts WHERE id = p_keep_id FOR UPDATE;/
    );
    expect(FN).toMatch(
      /SELECT \* INTO v_remove FROM public\.crm_contacts WHERE id = p_remove_id FOR UPDATE;/
    );
  });

  it('locks the survivor first, so concurrent merges take one order', () => {
    // Two merges grabbing the rows in opposite orders would deadlock. Postgres
    // would abort one, but an aborted merge reported as "could not merge" is a
    // worse answer than one that waits.
    const keepLock = FN.indexOf('v_keep FROM public.crm_contacts WHERE id = p_keep_id FOR UPDATE');
    const removeLock = FN.indexOf(
      'v_remove FROM public.crm_contacts WHERE id = p_remove_id FOR UPDATE'
    );
    expect(keepLock).toBeGreaterThan(-1);
    expect(removeLock).toBeGreaterThan(-1);
    expect(keepLock).toBeLessThan(removeLock);
  });

  it('moves the children before deleting the duplicate', () => {
    // `crm_activities` and `crm_tasks` both reference `crm_contacts(id)` with ON
    // DELETE CASCADE, so a DELETE above these two UPDATEs destroys the timeline
    // and the follow-ups outright rather than moving them.
    const moveActivities = FN.indexOf('UPDATE public.crm_activities');
    const moveTasks = FN.indexOf('UPDATE public.crm_tasks');
    const deleteDuplicate = FN.indexOf('DELETE FROM public.crm_contacts');

    expect(moveActivities).toBeGreaterThan(-1);
    expect(moveTasks).toBeGreaterThan(-1);
    expect(deleteDuplicate).toBeGreaterThan(-1);
    expect(moveActivities).toBeLessThan(deleteDuplicate);
    expect(moveTasks).toBeLessThan(deleteDuplicate);
  });

  it('writes the audit row before the delete, so the merge is always recorded', () => {
    const audit = FN.indexOf("'merge'");
    const deleteDuplicate = FN.indexOf('DELETE FROM public.crm_contacts');
    expect(audit).toBeGreaterThan(-1);
    expect(audit).toBeLessThan(deleteDuplicate);
  });

  it('refuses a merge into itself and a missing survivor', () => {
    expect(FN).toMatch(/cannot merge a contact into itself/);
    expect(FN).toMatch(/the contact being kept does not exist/);
    // And re-checks the duplicate after the lock, for a merge that lost the race
    // to another one between the action's read and this call.
    expect(FN).toMatch(/already have been merged/);
  });
});

describe('merge_crm_contacts: combination rules', () => {
  it('sums donations with coalesce, so a null total is not a zeroed survivor', () => {
    expect(FN).toMatch(
      /total_donated_cents = coalesce\(v_keep\.total_donated_cents, 0\)\s*\+\s*coalesce\(v_remove\.total_donated_cents, 0\)/
    );
  });

  /**
   * The rule that matters legally. The inverse mistake — taking the survivor's
   * `false` over a duplicate's `true` — would put somebody who unsubscribed back
   * into a broadcast audience.
   */
  it('ORs the opt-out flag rather than preferring the survivor', () => {
    expect(FN).toMatch(
      /do_not_email = CASE\s+WHEN coalesce\(v_keep\.do_not_email, false\)\s*OR coalesce\(v_remove\.do_not_email, false\) THEN true/
    );
    expect(FN).toMatch(
      /WHEN v_keep\.do_not_email IS NOT NULL\s*OR v_remove\.do_not_email IS NOT NULL THEN false/
    );
    expect(FN).toMatch(/ELSE NULL/);
  });

  /**
   * The bug a plain OR would introduce, stated so it cannot be reintroduced by
   * "simplifying" the CASE back.
   *
   * `do_not_email` was NOT NULL when this function was first written, which is
   * what made `coalesce(…, false) OR coalesce(…, false)` correct. Migration
   * 20261005020000 makes the column nullable to express "never asked", and the
   * coalesce collapses two unknowns into a `false` — an explicit yes. Merging two
   * contacts who were never asked would then opt the survivor into broadcast
   * mail that neither of them agreed to.
   */
  it('does not coalesce a null consent into a false one', () => {
    const assignment = /do_not_email = ([\s\S]*?),\n/.exec(FN)?.[1] ?? '';
    expect(assignment).not.toMatch(
      /coalesce\(v_keep\.do_not_email, false\) OR coalesce\(v_remove\.do_not_email, false\)$/
    );
    // The last branch has to be the null case, or one of the three states
    // collapses into another. It reads `ELSE NULL … END`, not `ELSE false`.
    expect(assignment.trimEnd()).toMatch(/ELSE NULL\s*END$/);
  });

  it('preserves the earliest unsubscribe timestamp rather than clearing it', () => {
    // `crm.ts`'s `setCRMEmailConsent` deliberately leaves `unsubscribed_at` in
    // place when consent is restored — restoring consent is not erasing the
    // evidence that somebody once unsubscribed. The merge used to do the
    // opposite: `ELSE NULL` wiped the survivor's timestamp whenever merged
    // consent was `false` or `NULL`. Two deliberate policies, and the one that
    // lost information was the merge. A past unsubscribe is a historical fact:
    // it records when they opted out regardless of current consent, and a
    // re-subscribe that later flips consent back overwrites the timestamp on
    // whichever row it hits. So the merge keeps the earliest one and never
    // clears it.
    expect(FN).toMatch(/unsubscribed_at = CASE/);
    expect(FN).toMatch(/least\(v_keep\.unsubscribed_at, v_remove\.unsubscribed_at\)/);
    // The old rule gated the timestamp on the merged consent — clearing it
    // whenever consent ended up `false` or `NULL`. That is the version that
    // lost information; the new one keys only on the two timestamps.
    const unsubAssignment = /unsubscribed_at = ([\s\S]*?),\n\s*updated_at/.exec(FN)?.[1] ?? '';
    expect(unsubAssignment).not.toMatch(/do_not_email/);
  });

  it('carries the duplicate scalar fields forward when the survivor is blank', () => {
    // The old UPDATE set five columns and dropped the rest: a second phone,
    // address, city, zip, district or a `donor` status on the duplicate all
    // disappeared silently. `status` is the sharp one — `crm_stats()` counts
    // donors by `total_donated_cents > 0`, so the merged contact still
    // *counted* as a donor while no `status`-filtered audience could select
    // them again. COALESCE survivor-first, duplicate brought forward.
    for (const field of ['phone', 'address', 'city', 'zip_code', 'district', 'status']) {
      expect(FN).toMatch(new RegExp(`${field} = coalesce\\(`));
    }
    expect(FN).toMatch(/status = coalesce\(v_keep\.status, v_remove\.status\)/);
  });

  it("never copies the duplicate's unsubscribe token", () => {
    // One-click unsubscribe URLs are already in inboxes. The survivor keeps its
    // own; the duplicate's stops working rather than silently retargeting, which
    // is the correct direction for an unsubscribe URL to fail in.
    expect(FN).not.toMatch(/unsubscribe_token\s*=/);
  });

  it('normalises the tag union, so a merge does not add mixed-case rows', () => {
    // Follow-up #6 is still waiting to clean up mixed-case tags. A merge that
    // concatenated them would keep adding rows that cleanup has to remove.
    expect(FN).toMatch(/array_agg\(DISTINCT lower\(btrim\(t\)\)/);
  });

  it('joins both notes rather than letting one replace the other', () => {
    expect(FN).toMatch(/concat_ws\(/);
    expect(FN).toMatch(/---\\n\\n/);
  });

  it('records the acting admin and the merged amounts on the audit row', () => {
    expect(FN).toMatch(/p_actor_id/);
    expect(FN).toMatch(/'removed_id', p_remove_id/);
    expect(FN).toMatch(/'merged_donations_cents'/);
  });
});
