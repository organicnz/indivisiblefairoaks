// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  type ContactFilters,
  consentLabel,
  filterArgs,
  filterParams,
  filtersFromSegment,
  hasActiveFilters,
  isInAudience,
  pageRange,
  parseConsentFilter,
  splitActiveValues,
  totalPages,
} from '@/lib/crm-filters';

const NEUTRAL: ContactFilters = {
  query: '',
  status: 'all',
  district: 'all',
  tag: 'all',
  consent: 'all',
};

type Segment = Parameters<typeof filtersFromSegment>[0];

const segment = (over: Partial<Segment> = {}): Segment =>
  ({
    id: 'seg-1',
    name: 'A segment',
    created_at: '2026-01-01T00:00:00Z',
    query: '',
    statuses: [],
    districts: [],
    tags: [],
    ...over,
  }) as Segment;

describe('splitActiveValues', () => {
  it('treats empty and "all" as no filter', () => {
    expect(splitActiveValues('')).toEqual([]);
    expect(splitActiveValues('all')).toEqual([]);
  });

  it('splits a comma-separated list and trims', () => {
    expect(splitActiveValues('choir, organizer ,donor')).toEqual(['choir', 'organizer', 'donor']);
  });

  it('drops empty segments from a trailing comma', () => {
    expect(splitActiveValues('choir,,')).toEqual(['choir']);
  });
});

describe('filterParams', () => {
  it('emits nothing for a neutral filter set', () => {
    expect(filterParams(NEUTRAL).toString()).toBe('');
  });

  /**
   * The load-bearing assertion.
   *
   * Three call sites used to build their own `URLSearchParams`: the form's
   * submit (which included consent), the quick pills, and `handleApplySegment`
   * (which did not). So an organiser filtering for opt-outs and then clicking a
   * district pill got the whole contact list back, with no error and nothing on
   * screen to say the filter had gone. `consent` is the one that gets dropped,
   * because it is the one that is easy to forget: it is not a tag, not a status,
   * and not a district.
   */
  it('carries the consent filter into the URL', () => {
    expect(filterParams({ ...NEUTRAL, consent: 'opted_out' }).get('consent')).toBe('opted_out');
    expect(filterParams({ ...NEUTRAL, consent: 'opted_in' }).get('consent')).toBe('opted_in');
  });

  /**
   * The third state has to be reachable, not just storable.
   *
   * "Who have we never actually asked?" is the question a consent audit exists to
   * answer, and before the column became nullable the only two answers the
   * directory could give were "who said no" and "who said yes" — so a contact who
   * had never heard of the question was indistinguishable from one who had agreed.
   */
  it('carries the never-asked filter into the URL', () => {
    expect(filterParams({ ...NEUTRAL, consent: 'unasked' }).get('consent')).toBe('unasked');
  });

  it('omits consent when it is the neutral value', () => {
    expect(filterParams({ ...NEUTRAL, consent: 'all' }).has('consent')).toBe(false);
  });

  it('carries every filter at once', () => {
    const params = filterParams({
      query: '  alice ',
      status: 'donor',
      district: 'CA-06',
      tag: 'choir',
      consent: 'opted_out',
    });
    expect(Object.fromEntries(params)).toEqual({
      q: 'alice',
      status: 'donor',
      district: 'CA-06',
      tag: 'choir',
      consent: 'opted_out',
    });
  });

  it('trims the query and drops a whitespace-only one', () => {
    expect(filterParams({ ...NEUTRAL, query: '  alice  ' }).get('q')).toBe('alice');
    expect(filterParams({ ...NEUTRAL, query: '   ' }).has('q')).toBe(false);
  });

  /**
   * A quick pill changes status and district and leaves the rest alone, which is
   * what makes it a quick filter rather than a reset. The other three have to
   * survive it — including consent, which is what this function exists for.
   */
  it('preserves query, tag and consent when only status and district change', () => {
    const before = { query: 'alice', tag: 'choir', consent: 'opted_out' } as const;
    const after = filterParams({
      ...NEUTRAL,
      ...before,
      status: 'active_volunteer',
      district: 'CA-06',
    });
    expect(after.get('q')).toBe('alice');
    expect(after.get('tag')).toBe('choir');
    expect(after.get('consent')).toBe('opted_out');
  });
});

describe('filterArgs', () => {
  /**
   * The export path. `handleExportCSV` omitted `consent`, so exporting from the
   * "Opted Out of Email" view produced a CSV of *every* contact — wrong, and
   * the one export a chapter takes off-platform.
   */
  it('passes the consent filter to the export action', () => {
    expect(filterArgs({ ...NEUTRAL, consent: 'opted_out' }).consent).toBe('opted_out');
  });

  /**
   * The export has to carry it for the same reason the URL does, and it is the
   * one path whose failure takes the data off-platform. Exporting from a
   * never-asked view used to produce every contact in the chapter.
   */
  it('passes the never-asked filter to the export action', () => {
    expect(filterArgs({ ...NEUTRAL, consent: 'unasked' }).consent).toBe('unasked');
  });

  /**
   * The round trip, which is the property that actually matters.
   *
   * `filterParams` emits `consent=unasked` and the page's parser used to be a
   * ternary over the two states that existed when it was written. It therefore
   * read back `'all'`: an organiser asked for "never asked", got the entire
   * directory, and the only evidence of it anywhere was a URL they had clicked
   * and could not see. No error, wrong set of people.
   *
   * Asserting this for every emitted value is what stops the *next* state
   * repeating it.
   */
  it.each(['opted_out', 'opted_in', 'unasked'] as const)(
    'reads %s back out of the URL it wrote',
    (consent) => {
      expect(parseConsentFilter(filterParams({ ...NEUTRAL, consent }).get('consent'))).toBe(
        consent
      );
    }
  );

  it('reads an absent consent param as no opinion, not as a state', () => {
    expect(parseConsentFilter(filterParams(NEUTRAL).get('consent'))).toBe('all');
    expect(parseConsentFilter(undefined)).toBe('all');
    expect(parseConsentFilter('')).toBe('all');
  });

  it('falls back to no opinion on a param it does not recognise', () => {
    // A search param is attacker-influenced. An unfiltered list is the right
    // outcome for `?consent=nonsense`; a 500 is not.
    expect(parseConsentFilter('nonsense')).toBe('all');
    expect(parseConsentFilter('opted in')).toBe('all');
    expect(parseConsentFilter('OPTED_IN')).toBe('all');
  });

  it('erases the neutral consent value rather than sending "all"', () => {
    // `"all"` is not a value `getCRMContacts` accepts, so sending it would be a
    // 400 or — worse — a silent fallback to no filter.
    expect(filterArgs(NEUTRAL).consent).toBeUndefined();
  });

  it('carries the text filters through unchanged', () => {
    const args = filterArgs({
      query: 'alice',
      status: 'donor',
      district: 'CA-03',
      tag: 'choir',
      consent: 'all',
    });
    expect(args).toMatchObject({
      query: 'alice',
      status: 'donor',
      district: 'CA-03',
      tag: 'choir',
    });
  });
});

describe('filtersFromSegment', () => {
  it('round-trips a segment into a filter set', () => {
    expect(
      filtersFromSegment(
        segment({ query: 'alice', statuses: ['donor'], districts: ['CA-06'], tags: ['choir'] })
      )
    ).toEqual({
      query: 'alice',
      status: 'donor',
      district: 'CA-06',
      tag: 'choir',
      consent: 'all',
    });
  });

  /**
   * A segment is applied as a *replacement*, not a merge. Merging meant applying
   * a segment appeared to do nothing whenever the search box happened to hold
   * something, and applying a second segment silently intersected with the first.
   */
  it('clears every filter the segment does not set', () => {
    expect(filtersFromSegment(segment())).toEqual(NEUTRAL);
  });

  it('joins multi-value fields with commas', () => {
    expect(filtersFromSegment(segment({ statuses: ['donor', 'choir'] })).status).toBe(
      'donor,choir'
    );
  });

  /**
   * `consent ?? 'all'`, not `consent || 'all'`. Rows written before the column
   * existed come back `null`, and a segment with no consent filter means "no
   * opinion" — reading that as "opted out" would make applying an old segment
   * show the chapter its opt-out list, which is the opposite of what was asked.
   */
  it('reads a pre-column null consent as no filter, not as opted out', () => {
    expect(filtersFromSegment(segment({ consent: null })).consent).toBe('all');
  });

  it('carries a saved consent filter', () => {
    expect(filtersFromSegment(segment({ consent: 'opted_out' })).consent).toBe('opted_out');
  });

  /**
   * The column has no CHECK constraint, so a stored string is only usually one
   * of the three literals. An unknown value resolves to the neutral filter
   * rather than reaching a filter typed for the allowlist.
   */
  it('reads an unknown stored consent as no filter', () => {
    expect(filtersFromSegment(segment({ consent: 'sometimes' })).consent).toBe('all');
  });

  it('applies a consent-bearing segment without losing it', () => {
    const filters = filtersFromSegment(segment({ consent: 'opted_in', districts: ['CA-03'] }));
    expect(filterParams(filters).get('consent')).toBe('opted_in');
    expect(filterParams(filters).get('district')).toBe('CA-03');
  });
});

describe('hasActiveFilters', () => {
  it('is false when nothing is set', () => {
    expect(hasActiveFilters(NEUTRAL, NEUTRAL)).toBe(false);
  });

  it('is true for an applied filter', () => {
    expect(hasActiveFilters(NEUTRAL, { ...NEUTRAL, query: 'alice' })).toBe(true);
  });

  /**
   * This one left the Save button permanently disabled. Every visible control was
   * engaged, the filter was working, and the only way to keep it was to remember
   * the dropdown — because consent was the one field the check did not read.
   */
  it('is true for an applied consent filter alone', () => {
    expect(hasActiveFilters(NEUTRAL, { ...NEUTRAL, consent: 'opted_out' })).toBe(true);
  });

  it('is true for a consent filter typed but not yet applied', () => {
    const draft: ContactFilters = { ...NEUTRAL, consent: 'opted_in' };
    expect(hasActiveFilters(draft, NEUTRAL)).toBe(true);
  });

  /**
   * An engaged-but-unapplied draft is what the button is *for* — the volunteer
   * has changed a dropdown and is deciding whether to keep it. A draft that
   * differs from what is applied means there is something new worth saving.
   */
  it('is true for a draft that differs from the applied set', () => {
    const draft: ContactFilters = { ...NEUTRAL, query: 'alice' };
    expect(hasActiveFilters(draft, NEUTRAL)).toBe(true);
  });

  it('stays true when the applied filter alone is worth saving', () => {
    // The applied filter is on screen and working. Saving *that* is exactly what
    // the button offers, so a matching draft does not make it disappear.
    const set: ContactFilters = { ...NEUTRAL, query: 'alice' };
    expect(hasActiveFilters(set, set)).toBe(true);
  });

  it('is true when the draft differs from the applied set', () => {
    const draft: ContactFilters = { ...NEUTRAL, query: 'bob' };
    expect(hasActiveFilters(draft, { ...NEUTRAL, query: 'alice' })).toBe(true);
  });

  /**
   * The two functions have to agree. `filtersFromSegment` produces a draft and
   * `hasActiveFilters` reads one; if applying a segment produced a draft the
   * check considered inactive, the Save button would grey out the moment a
   * segment was clicked.
   */
  it('agrees with filtersFromSegment about what applying a segment activates', () => {
    const applied = filtersFromSegment(segment({ districts: ['CA-06'], consent: 'opted_out' }));
    expect(hasActiveFilters(applied, applied)).toBe(true);
    // An empty segment against an empty screen is the only genuinely inert case.
    expect(hasActiveFilters(filtersFromSegment(segment()), NEUTRAL)).toBe(false);
  });
});

describe('totalPages', () => {
  it('is at least 1 with no results', () => {
    expect(totalPages(0, 50)).toBe(1);
  });

  it('rounds up a partial page', () => {
    expect(totalPages(51, 50)).toBe(2);
  });

  it('is exact on a whole multiple', () => {
    expect(totalPages(100, 50)).toBe(2);
  });

  it('never divides by zero', () => {
    // A directory with no configured page size must not produce Infinity, which
    // renders as "page 1 of Infinity".
    expect(totalPages(10, 0)).toBe(1);
  });
});

describe('pageRange', () => {
  it('reports the first page', () => {
    expect(pageRange(1, 50, 1482)).toEqual([1, 50]);
  });

  it('reports a middle page', () => {
    expect(pageRange(3, 50, 1482)).toEqual([101, 150]);
  });

  it('clamps the last page to the total', () => {
    expect(pageRange(30, 50, 1482)).toEqual([1451, 1482]);
  });

  /**
   * Zero rendered as `1–0` before. The header and the pager each printed their
   * own count, so an empty directory showed "Showing 0 of 0" in one place and
   * "Showing 1–0 of 0" in the other.
   */
  it('reports 0–0 with no results rather than 1–0', () => {
    expect(pageRange(1, 50, 0)).toEqual([0, 0]);
  });
});

describe('consentLabel', () => {
  /**
   * Three states, and the middle one is the change.
   *
   * Rendering a `null` row as "Opted in" is how an organiser auditing opt-outs
   * comes to believe a person agreed to hear from the chapter when they were never
   * asked — and "Opted in" is also what tells a reader the contact *is* in the
   * broadcast audience, which a null row is not.
   */
  it('names all three states distinctly', () => {
    expect(consentLabel(true)).toBe('Opted out');
    expect(consentLabel(false)).toBe('Opted in');
    expect(consentLabel(null)).toBe('Never asked');
  });

  it('never renders a never-asked contact as opted in', () => {
    // The one assertion worth stating on its own: the whole tri-state migration
    // is undone at the display layer by this single string.
    expect(consentLabel(null)).not.toBe(consentLabel(false));
  });
});

describe('isInAudience', () => {
  /**
   * The rule every send path depends on, expressed once.
   *
   * It returns `false` for `null`, which is the entire point: before the column
   * could express "never asked", a `false` meant either "agreed" or "nobody has
   * asked", and this function could not tell them apart.
   */
  it('requires an explicit yes', () => {
    expect(isInAudience(false)).toBe(true);
    expect(isInAudience(true)).toBe(false);
    expect(isInAudience(null)).toBe(false);
  });
});
