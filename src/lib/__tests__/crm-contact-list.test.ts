// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  allContactsSelected,
  CRM_CONTACT_QUICK_FILTERS,
  initialContactFilters,
  isQuickFilterActive,
  neutralContactFilters,
  type QuickContactFilter,
  quickFilterFilters,
  renameSegmentInput,
  saveSegmentInput,
  segmentFilterInput,
  toggleContactSelection,
  togglePageSelection,
  updateSegmentInput,
} from '@/lib/crm-contact-list';
import type { ContactFilters } from '@/lib/crm-filters';
import type { CRMSegment } from '@/types/crm';

const NEUTRAL: ContactFilters = {
  query: '',
  status: 'all',
  district: 'all',
  tag: 'all',
  consent: 'all',
};

const filters = (over: Partial<ContactFilters> = {}): ContactFilters => ({
  ...NEUTRAL,
  ...over,
});

const segment = (over: Partial<CRMSegment> = {}): CRMSegment =>
  ({
    id: 'seg-1',
    name: 'A segment',
    created_at: '2026-01-01T00:00:00Z',
    query: '',
    statuses: [],
    districts: [],
    tags: [],
    consent: null,
    ...over,
  }) as CRMSegment;

const quick = (over: Partial<QuickContactFilter> = {}): QuickContactFilter => ({
  label: 'A pill',
  status: 'all',
  district: 'all',
  ...over,
});

describe('CRM contact filter drafts', () => {
  it('starts neutral', () => {
    expect(neutralContactFilters()).toEqual(NEUTRAL);
  });

  it('copies every applied filter into the draft', () => {
    const applied = filters({
      query: 'alice',
      status: 'donor',
      district: 'CA-06',
      tag: 'choir',
      consent: 'opted_out',
    });
    expect(initialContactFilters(applied)).toEqual(applied);
    expect(initialContactFilters(applied)).not.toBe(applied);
  });

  it('normalizes empty applied values to the neutral draft values', () => {
    expect(
      initialContactFilters({
        query: '',
        status: '',
        district: '',
        tag: '',
        consent: 'all',
      })
    ).toEqual(NEUTRAL);
  });
});

describe('quick contact filters', () => {
  it('keeps the existing curated labels and order', () => {
    expect(CRM_CONTACT_QUICK_FILTERS.map((pill) => pill.label)).toEqual([
      'All',
      'Volunteers',
      'Resistance Choir',
      'Donors',
      'Organizers',
      'CA-06 Local',
      'CA-03 Local',
    ]);
  });

  it('applies only a pill status and district, preserving the other applied filters', () => {
    const applied = filters({
      query: 'alice',
      status: 'supporter',
      district: 'CA-03',
      tag: 'choir',
      consent: 'opted_out',
    });

    expect(quickFilterFilters(applied, quick({ status: 'donor' }))).toEqual({
      query: 'alice',
      status: 'donor',
      district: 'all',
      tag: 'choir',
      consent: 'opted_out',
    });
    expect(quickFilterFilters(applied, quick({ district: 'CA-06' }))).toEqual({
      query: 'alice',
      status: 'all',
      district: 'CA-06',
      tag: 'choir',
      consent: 'opted_out',
    });
  });

  it('does not mutate the applied filters', () => {
    const applied = filters({ status: 'donor' });
    const before = { ...applied };
    quickFilterFilters(applied, quick({ status: 'choir' }));
    expect(applied).toEqual(before);
  });

  it('highlights All only when status and district are both neutral', () => {
    const all = quick();
    expect(isQuickFilterActive(NEUTRAL, all)).toBe(true);
    expect(isQuickFilterActive(filters({ query: 'alice', tag: 'choir' }), all)).toBe(true);
    expect(isQuickFilterActive(filters({ status: 'donor' }), all)).toBe(false);
    expect(isQuickFilterActive(filters({ district: 'CA-06' }), all)).toBe(false);
  });

  it('highlights a status pill on its status regardless of the district filter', () => {
    const volunteer = quick({ label: 'Volunteers', status: 'active_volunteer' });
    expect(isQuickFilterActive(filters({ status: 'active_volunteer' }), volunteer)).toBe(true);
    expect(
      isQuickFilterActive(filters({ status: 'active_volunteer', district: 'CA-06' }), volunteer)
    ).toBe(true);
    expect(isQuickFilterActive(filters({ status: 'donor' }), volunteer)).toBe(false);
  });

  it('highlights a district pill on its district regardless of the status filter', () => {
    const ca06 = quick({ label: 'CA-06 Local', district: 'CA-06' });
    expect(isQuickFilterActive(filters({ district: 'CA-06' }), ca06)).toBe(true);
    expect(isQuickFilterActive(filters({ status: 'donor', district: 'CA-06' }), ca06)).toBe(true);
    expect(isQuickFilterActive(filters({ district: 'CA-03' }), ca06)).toBe(false);
  });
});

describe('saved segment inputs', () => {
  it('turns applied filters into a segment payload', () => {
    expect(
      segmentFilterInput(
        filters({
          query: '  alice  ',
          status: 'donor,choir',
          district: 'CA-06, CA-03',
          tag: 'choir',
          consent: 'opted_in',
        })
      )
    ).toEqual({
      query: 'alice',
      statuses: ['donor', 'choir'],
      districts: ['CA-06', 'CA-03'],
      tags: ['choir'],
      consent: 'opted_in',
    });
  });

  it('leaves neutral consent out rather than writing "all"', () => {
    expect(segmentFilterInput(NEUTRAL).consent).toBeUndefined();
  });

  it('trims the new segment name', () => {
    expect(saveSegmentInput('  CA-06 choir  ', filters({ district: 'CA-06' }))).toEqual({
      name: 'CA-06 choir',
      query: '',
      statuses: [],
      districts: ['CA-06'],
      tags: [],
      consent: undefined,
    });
  });

  it('updates a segment from the applied filters without changing its name', () => {
    expect(
      updateSegmentInput(segment({ id: 'seg-2', name: 'Donors' }), filters({ status: 'donor' }))
    ).toEqual({
      id: 'seg-2',
      name: 'Donors',
      query: '',
      statuses: ['donor'],
      districts: [],
      tags: [],
      consent: undefined,
    });
  });

  it('renames a segment while preserving its stored filters', () => {
    expect(
      renameSegmentInput(
        segment({
          query: 'alice',
          statuses: ['donor', 'choir'],
          districts: ['CA-06'],
          tags: ['choir'],
          consent: 'opted_out',
        }),
        '  Choir donors  '
      )
    ).toEqual({
      id: 'seg-1',
      name: 'Choir donors',
      query: 'alice',
      statuses: ['donor', 'choir'],
      districts: ['CA-06'],
      tags: ['choir'],
      consent: 'opted_out',
    });
  });

  it('renames a pre-column or malformed segment as consent-neutral', () => {
    expect(renameSegmentInput(segment({ consent: null }), 'Old segment').consent).toBeUndefined();
    expect(renameSegmentInput(segment({ consent: 'sometimes' }), 'Old segment').consent).toBe(
      undefined
    );
  });
});

describe('contact selection', () => {
  const page = [{ id: 'a' }, { id: 'b' }];

  it('does not call an empty page selected', () => {
    expect(allContactsSelected([], new Set())).toBe(false);
  });

  it('is selected only when every row on the page is selected', () => {
    expect(allContactsSelected(page, new Set(['a']))).toBe(false);
    expect(allContactsSelected(page, new Set(['a', 'b']))).toBe(true);
    expect(allContactsSelected(page, new Set(['a', 'b', 'off-page']))).toBe(true);
  });

  it('selects the page without disturbing off-page selections', () => {
    const selected = new Set(['off-page']);
    expect([...togglePageSelection(page, selected)].sort()).toEqual(['a', 'b', 'off-page']);
    expect([...selected]).toEqual(['off-page']);
  });

  it('clears the page without disturbing off-page selections', () => {
    const selected = new Set(['a', 'b', 'off-page']);
    expect([...togglePageSelection(page, selected)]).toEqual(['off-page']);
    expect([...selected].sort()).toEqual(['a', 'b', 'off-page']);
  });

  it('toggles one contact on and off without changing the input set', () => {
    const selected = new Set(['a']);
    expect([...toggleContactSelection(selected, 'b')].sort()).toEqual(['a', 'b']);
    expect([...toggleContactSelection(selected, 'a')]).toEqual([]);
    expect([...selected]).toEqual(['a']);
  });
});
