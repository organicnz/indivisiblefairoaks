import { CRM_CONTACT_STATUS_VALUES } from './crm-contact-options';

/**
 * The one donor predicate, as stored in `crm_contacts.is_donor`.
 *
 * Donor had three independent representations in the CRM — a status, a tag and
 * a positive lifetime donation total — and different readers chose different
 * ones. The generated column (migration 20261119150000) combines all three at
 * the row level so stats, the directory, saved segments and both broadcast
 * resolvers cannot disagree.
 *
 * Query builders cannot compare a generated predicate to a status list in one
 * `.in()` call, so this adapter translates the donor member of a status filter
 * into `is_donor = true`. Every other status keeps the original `.eq()` /
 * `.in()` behavior.
 */
export const CRM_DONOR_STATUS = 'donor';
export const CRM_DONOR_COLUMN = 'is_donor';

const KNOWN_STATUSES = new Set<string>(CRM_CONTACT_STATUS_VALUES);

type StatusFilterBuilder = {
  eq: (column: string, value: string | boolean) => StatusFilterBuilder;
  in: (column: string, values: readonly string[]) => StatusFilterBuilder;
  or: (filter: string) => StatusFilterBuilder;
};

/**
 * Apply a contact-status filter through the canonical donor predicate.
 *
 * `status.eq.donor` alone used to mean "the survivor's primary status happens
 * to be donor". It now means "any donor signal", which is the same set
 * `crm_stats()` counts. When a segment or broadcast also asks for other
 * statuses, the donor clause is ORed with each known status rather than ANDed —
 * a donor who is also an organizer must match either label.
 */
export function applyCRMStatusFilter<Q>(qb: Q, statuses: readonly string[]): Q {
  /*
   * Supabase's builder type is generic over the whole generated schema and its
   * `eq` signature narrows the column to a huge union. A structural interface
   * cannot be assigned from it without reproducing that schema, so the one
   * cast lives here; the call sites still receive their own builder type back.
   */
  const builder = qb as unknown as StatusFilterBuilder;
  const unique = [...new Set(statuses.map((status) => status.trim()).filter(Boolean))];
  if (unique.length === 0) return qb;

  if (!unique.includes(CRM_DONOR_STATUS)) {
    return (
      unique.length === 1 ? builder.eq('status', unique[0]) : builder.in('status', unique)
    ) as Q;
  }

  /*
   * Only the fixed status vocabulary may enter the `.or()` string. A saved
   * segment can be hand-edited and `crm_segments.statuses` has no CHECK, so an
   * arbitrary value here would be PostgREST query syntax rather than a status.
   * Unknown values cannot match the column's CHECK anyway; dropping them leaves
   * the canonical donor clause intact.
   */
  const otherStatuses = unique.filter(
    (status) => status !== CRM_DONOR_STATUS && KNOWN_STATUSES.has(status)
  );

  if (otherStatuses.length === 0) return builder.eq(CRM_DONOR_COLUMN, true) as Q;

  return builder.or(
    [`${CRM_DONOR_COLUMN}.eq.true`, ...otherStatuses.map((status) => `status.eq.${status}`)].join(
      ','
    )
  ) as Q;
}
