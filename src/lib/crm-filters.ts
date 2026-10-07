import type { CRMSegment } from '@/lib/actions/crm';

/**
 * The directory's filter state, and the two rules that were previously applied
 * by hand at three separate call sites.
 *
 * Both rules came from the same bug — a filter being silently dropped — and both
 * fail in the same way: the wrong *set of people* appears, with nothing on
 * screen saying so. A quick pill that forgets `consent` while an organiser audits
 * opt-outs puts every opted-out constituent back in front of them; a CSV export
 * that forgets it hands the chapter a file of the entire contact list from an
 * opt-out view. There is no error to notice in either case.
 *
 * Hence one function, and tests that assert on each path. The alternative — a
 * fourth hand-written `URLSearchParams` block — is exactly the thing that has to
 * be remembered.
 */

export type ConsentFilter = 'all' | 'opted_out' | 'opted_in' | 'unasked';

/**
 * The three stored states, and what each one is.
 *
 * `do_not_email` is tri-state since migration 20261005020000, and the distinction
 * between the last two is the whole point of that migration:
 *
 *   true  — asked, declined or unsubscribed
 *   false — asked, **agreed**
 *   null  — never asked
 *
 * Before it, `false` meant both "agreed" and "never asked", so the audience
 * resolver could only require "not opted out" and every contact who had never
 * heard of the question was in the next campaign. `'opted_in'` below is an
 * explicit *yes*, and `'unasked'` is what was previously unreachable.
 */
export const CONSENT_STATES = ['opted_out', 'opted_in', 'unasked'] as const;

export type ConsentState = (typeof CONSENT_STATES)[number];

/**
 * Whether a contact with this consent value is reachable by a broadcast.
 *
 * `false` only. A `null` row was never asked, and mailing somebody who was never
 * asked is the exact failure this tri-state migration closes.
 *
 * In SQL this is `.eq('do_not_email', false)`, which already excludes NULL —
 * `col = false` is NULL for a null row, and NULL is not true. That is why the
 * resolver needed no change: it was written correctly for a column that could
 * then not express its own third state.
 */
export function isInAudience(doNotEmail: boolean | null): boolean {
  return doNotEmail === false;
}

export interface ContactFilters {
  query: string;
  status: string;
  district: string;
  tag: string;
  consent: ConsentFilter;
}

/** The filter set the *server* ran, i.e. what is on screen. */
export type AppliedContactFilters = ContactFilters;

/**
 * Split a multi-value filter param into its parts.
 *
 * Named for what it does rather than which field it is applied to. The previous
 * name was `splitActiveTags` and it was called on `status` and `district` too,
 * which is what made a reader believe statuses were being tag-parsed.
 */
export function splitActiveValues(raw: string): string[] {
  if (!raw || raw === 'all') return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * A `consent` search param back into a filter value.
 *
 * This is the inverse of `filterParams`, and it has to exist as one function for
 * the same reason that one does: the page used to parse it inline as a nested
 * ternary over the two states that existed when it was written.
 *
 * The third state is what made that a bug rather than a style choice. A parser
 * written against `opted_out | opted_in` maps an unrecognised value to `'all'` —
 * which is the right *safe* fallback for a hostile URL, and completely wrong for
 * a value this same codebase emits. `filterParams` faithfully writes
 * `consent=unasked`, the parser discards it, and the organiser is shown the whole
 * directory while the URL says otherwise. Nothing errors; the list is just wrong.
 *
 * Unknown input still resolves to `'all'` rather than throwing, because a search
 * param is attacker-influenced and a 500 on `?consent=` is a worse outcome than
 * an unfiltered list. The distinction that matters is that every value this
 * module can *emit* must survive the round trip, and `isConsentFilter` is the
 * allowlist that says so.
 */
export function parseConsentFilter(raw: string | undefined | null): ConsentFilter {
  if (!raw) return 'all';
  return isConsentFilter(raw) ? raw : 'all';
}

/** The allowlist of values `parseConsentFilter` accepts — and that `filterParams` emits. */
export function isConsentFilter(value: string): value is ConsentFilter {
  return value === 'all' || CONSENT_STATES.includes(value as ConsentState);
}

/**
 * Every filter becomes a URL param except the neutral value of each.
 *
 * `'all'` is omitted rather than sent, so a URL is a statement about what is
 * filtered and an absent key means "no opinion".
 */
export function filterParams(filters: ContactFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set('q', filters.query.trim());
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.district && filters.district !== 'all') params.set('district', filters.district);
  if (filters.tag && filters.tag !== 'all') params.set('tag', filters.tag);
  if (filters.consent && filters.consent !== 'all') params.set('consent', filters.consent);
  return params;
}

/** The action's argument shape, with the neutral consent value erased. */
export function filterArgs(filters: ContactFilters): {
  query: string;
  status: string;
  district: string;
  tag: string;
  consent?: ConsentState;
} {
  return {
    query: filters.query,
    status: filters.status,
    district: filters.district,
    tag: filters.tag,
    consent: filters.consent === 'all' ? undefined : filters.consent,
  };
}

/**
 * A saved segment, as a filter set.
 *
 * Applied as a *replacement* for the current filter, not a merge. Merging is
 * what made applying a segment appear to do nothing whenever the search box
 * happened to hold something, and applying a second segment silently intersect
 * with the first.
 *
 * `consent ?? 'all'` rather than `consent || 'all'`: rows written before the
 * column existed come back with `null`, and a segment with no consent filter is
 * the neutral value, not "opted out".
 */
export function filtersFromSegment(segment: CRMSegment): ContactFilters {
  return {
    query: segment.query ?? '',
    status: segment.statuses?.length ? segment.statuses.join(',') : 'all',
    district: segment.districts?.length ? segment.districts.join(',') : 'all',
    tag: segment.tags?.length ? segment.tags.join(',') : 'all',
    consent: segment.consent ?? 'all',
  };
}

/**
 * Whether there is anything worth saving as a segment.
 *
 * Both the draft and the applied set count: either is a real filter the user
 * might want to keep. Consent is part of it — without it, a view filtered only
 * by opt-out status could not be saved at all, because the button sat disabled
 * beside four engaged controls.
 */
export function hasActiveFilters(draft: ContactFilters, applied: AppliedContactFilters): boolean {
  if (draft.query.trim() && draft.query.trim() !== applied.query) return true;
  if (draft.status !== 'all' && draft.status !== applied.status) return true;
  if (draft.district !== 'all' && draft.district !== applied.district) return true;
  if (draft.tag !== 'all' && draft.tag !== applied.tag) return true;
  if (draft.consent !== 'all' && draft.consent !== applied.consent) return true;
  return Boolean(
    applied.query ||
      (applied.status && applied.status !== 'all') ||
      (applied.district && applied.district !== 'all') ||
      (applied.tag && applied.tag !== 'all') ||
      (applied.consent && applied.consent !== 'all')
  );
}

/**
 * Page count for a result set, clamped so it is never below 1.
 *
 * Lives here rather than in the pager because `totalCount` and `pageSize` arrive
 * from two places — the page and the pager's own copy — and they disagreed.
 */
export function totalPages(totalCount: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

/** Alias for the pager, which has its own local `total` variable. */
export { totalPages as countPages };

/**
 * The row range a page covers, for "Showing 51–100 of 1,482".
 *
 * Zero contacts renders `0–0`, not `1–0`: the directory previously printed both
 * "Showing 50 of 1,482" above the table and "Showing 101–150 of 1,482" below it,
 * which is the same information twice and, on an empty result, two different
 * wrong versions of it.
 */
export function pageRange(page: number, pageSize: number, totalCount: number): [number, number] {
  if (totalCount <= 0) return [0, 0];
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalCount);
  return [first, last];
}

/**
 * Consent as a display value.
 *
 * Three states now, because the column stores three. The wording matters more
 * than usual here: "Never asked" is not a soft synonym for "Opted in", and
 * rendering a null row as "Opted in" is how an organiser auditing opt-outs ends up
 * believing a person agreed to hear from the chapter.
 */
export function consentLabel(doNotEmail: boolean | null): string {
  if (doNotEmail === null) return 'Never asked';
  return doNotEmail ? 'Opted out' : 'Opted in';
}
