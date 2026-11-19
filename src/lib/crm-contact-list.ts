import type { ConsentDecision, CRMSegment } from '@/types/crm';
import {
  CRM_CONTACT_DISTRICT_OPTIONS,
  CRM_CONTACT_QUICK_DISTRICT_VALUES,
  CRM_CONTACT_QUICK_STATUS_VALUES,
  CRM_CONTACT_STATUS_OPTIONS,
} from './crm-contact-options';
import { type ContactFilters, parseConsentFilter, splitActiveValues } from './crm-filters';

/**
 * The pure state rules behind the CRM directory's filter and selection controls.
 *
 * The component used to spell these out inline: which filters a quick pill
 * keeps, which filters a segment save writes, and which ids a page checkbox
 * adds or removes. They are separated here so the failure modes — dropping an
 * applied filter, saving a segment from an unsubmitted draft, or clearing an
 * off-page selection — can be tested without rendering the page.
 */

export interface QuickContactFilter {
  label: string;
  status: string;
  district: string;
}

/**
 * Quick pills are a curated shortcut, not a second option list. The labels come
 * from the shared status/district options, while the narrower set of values is
 * deliberate: the directory has six statuses and four districts, and a row of
 * ten pills would stop being quick.
 */
export const CRM_CONTACT_QUICK_FILTERS: readonly QuickContactFilter[] = [
  { label: 'All', status: 'all', district: 'all' },
  ...CRM_CONTACT_QUICK_STATUS_VALUES.map((value) => ({
    label: CRM_CONTACT_STATUS_OPTIONS.find((option) => option.value === value)?.quickLabel ?? value,
    status: value,
    district: 'all',
  })),
  ...CRM_CONTACT_QUICK_DISTRICT_VALUES.map((value) => ({
    label: `${CRM_CONTACT_DISTRICT_OPTIONS.find((option) => option.value === value)?.label ?? value} Local`,
    status: 'all',
    district: value,
  })),
];

/** The neutral draft and reset state. */
export function neutralContactFilters(): ContactFilters {
  return {
    query: '',
    status: 'all',
    district: 'all',
    tag: 'all',
    consent: 'all',
  };
}

/**
 * Build the editable draft from the filter set the server ran.
 *
 * This is intentionally a copy: the applied filters belong to the rendered
 * result set, so typing in the form must not mutate the object the pager and
 * export use. Empty URL values become the neutral `all`, as the old five
 * state initializers did.
 */
export function initialContactFilters(current: ContactFilters): ContactFilters {
  return {
    query: current.query,
    status: current.status || 'all',
    district: current.district || 'all',
    tag: current.tag || 'all',
    consent: current.consent || 'all',
  };
}

/**
 * A quick pill changes status and district and leaves the rest of the filter
 * alone. It is built from the *applied* filters, not the draft, so clicking a
 * pill cannot smuggle an unsubmitted search term into the result set.
 */
export function quickFilterFilters(
  applied: ContactFilters,
  quick: QuickContactFilter
): ContactFilters {
  return {
    ...applied,
    status: quick.status,
    district: quick.district,
  };
}

/**
 * Whether a pill is highlighted.
 *
 * The status/district pills show as active when their own value matches even if
 * the other dimension is filtered. "All" is different: it only means "no
 * status and no district filter", not "no filters at all" — a search term or a
 * tag can still be active.
 */
export function isQuickFilterActive(filters: ContactFilters, quick: QuickContactFilter): boolean {
  const matchesStatus = quick.status === 'all' || filters.status === quick.status;
  const matchesDistrict = quick.district === 'all' || filters.district === quick.district;
  if (!matchesStatus || !matchesDistrict) return false;
  return (
    quick.status !== 'all' ||
    quick.district !== 'all' ||
    (filters.status === 'all' && filters.district === 'all')
  );
}

/** The filter fields a saved segment stores. */
export interface CRMSegmentFilterInput {
  query: string;
  statuses: string[];
  districts: string[];
  tags: string[];
  consent?: ConsentDecision;
}

export interface SaveSegmentInput extends CRMSegmentFilterInput {
  name: string;
}

export interface UpdateSegmentInput extends CRMSegmentFilterInput {
  id: string;
  name: string;
}

/**
 * Convert the applied filter set into the shape `saveCRMSegment` accepts.
 *
 * Consent is left off when it is neutral rather than sent as `"all"`; the
 * action's schema has no neutral value for a persisted segment.
 */
export function segmentFilterInput(filters: ContactFilters): CRMSegmentFilterInput {
  return {
    query: filters.query.trim(),
    statuses: splitActiveValues(filters.status),
    districts: splitActiveValues(filters.district),
    tags: splitActiveValues(filters.tag),
    consent: filters.consent === 'all' ? undefined : filters.consent,
  };
}

/** Save the applied filter set as a new named segment. */
export function saveSegmentInput(name: string, filters: ContactFilters): SaveSegmentInput {
  return {
    name: name.trim(),
    ...segmentFilterInput(filters),
  };
}

/** Replace an existing segment's stored filter set in place, keeping its name. */
export function updateSegmentInput(
  segment: CRMSegment,
  filters: ContactFilters
): UpdateSegmentInput {
  return {
    id: segment.id,
    name: segment.name,
    ...segmentFilterInput(filters),
  };
}

/**
 * Rename a segment without rewriting what it selects.
 *
 * Stored rows predate the consent column and the column has no CHECK
 * constraint, so an absent or unknown consent is parsed to neutral rather than
 * passed through. The rest of the stored filter set rides through untouched.
 */
export function renameSegmentInput(segment: CRMSegment, name: string): UpdateSegmentInput {
  const consent = parseConsentFilter(segment.consent);
  return {
    id: segment.id,
    name: name.trim(),
    query: segment.query ?? '',
    statuses: segment.statuses ?? [],
    districts: segment.districts ?? [],
    tags: segment.tags ?? [],
    consent: consent === 'all' ? undefined : consent,
  };
}

export interface SelectableContact {
  id: string;
}

/** A page counts as selected only when it has rows and every row is selected. */
export function allContactsSelected(
  contacts: readonly SelectableContact[],
  selectedIds: ReadonlySet<string>
): boolean {
  return contacts.length > 0 && contacts.every((contact) => selectedIds.has(contact.id));
}

/**
 * Toggle the page checkbox.
 *
 * Off-page selections survive both directions: the caller may have selected a
 * contact on page 1 and then selected all of page 2. Neither input set is
 * mutated.
 */
export function togglePageSelection(
  contacts: readonly SelectableContact[],
  selectedIds: ReadonlySet<string>
): Set<string> {
  const next = new Set(selectedIds);
  if (allContactsSelected(contacts, selectedIds)) {
    for (const contact of contacts) next.delete(contact.id);
  } else {
    for (const contact of contacts) next.add(contact.id);
  }
  return next;
}

/** Toggle one row, leaving every other selection alone. */
export function toggleContactSelection(
  selectedIds: ReadonlySet<string>,
  contactId: string
): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(contactId)) next.delete(contactId);
  else next.add(contactId);
  return next;
}
