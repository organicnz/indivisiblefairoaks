// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AVAILABLE_DISTRICTS, AVAILABLE_STATUSES } from '@/components/admin/crm/broadcast-options';
import { CRM_CONTACT_QUICK_FILTERS } from '@/lib/crm-contact-list';
import {
  CRM_CONTACT_BROADCAST_STATUS_OPTIONS,
  CRM_CONTACT_BULK_CONSENT_OPTIONS,
  CRM_CONTACT_BULK_STATUS_OPTIONS,
  CRM_CONTACT_CONSENT_OPTIONS,
  CRM_CONTACT_CONSENT_VALUES,
  CRM_CONTACT_DEFAULTS,
  CRM_CONTACT_DISTRICT_OPTIONS,
  CRM_CONTACT_DISTRICT_VALUES,
  CRM_CONTACT_EDITOR_STATUS_OPTIONS,
  CRM_CONTACT_QUICK_DISTRICT_VALUES,
  CRM_CONTACT_QUICK_STATUS_VALUES,
  CRM_CONTACT_STATUS_OPTIONS,
  CRM_CONTACT_STATUS_VALUES,
  crmContactConsentValue,
  crmContactDoNotEmail,
} from '@/lib/crm-contact-options';

const STATUS_LABEL_FIELDS = [
  'label',
  'filterLabel',
  'broadcastLabel',
  'editorLabel',
  'compactLabel',
  'quickLabel',
] as const;

const DISTRICT_LABEL_FIELDS = ['label', 'filterLabel', 'editorLabel'] as const;

const CONSENT_LABEL_FIELDS = [
  'label',
  'filterLabel',
  'bulkLabel',
  'profileLabel',
  'tableLabel',
] as const;

function expectLabel(value: string, label: string) {
  expect(value, label).toBe(value.trim());
  expect(value.length, label).toBeGreaterThan(0);
}

function expectUnique(values: readonly string[]) {
  expect(new Set(values).size).toBe(values.length);
}

describe('CRM contact status options', () => {
  it('lists every status exactly once, in display order', () => {
    expect([...CRM_CONTACT_STATUS_VALUES]).toEqual([
      'active_volunteer',
      'supporter',
      'donor',
      'choir',
      'organizer',
      'inactive',
    ]);
    expectUnique(CRM_CONTACT_STATUS_VALUES);
    expect(CRM_CONTACT_STATUS_OPTIONS.map((option) => option.value)).toEqual([
      ...CRM_CONTACT_STATUS_VALUES,
    ]);
  });

  it('preserves the pre-refactor order and labels for the editor, bulk bar, and broadcast audience', () => {
    expect(
      CRM_CONTACT_EDITOR_STATUS_OPTIONS.map(({ value, editorLabel }) => [value, editorLabel])
    ).toEqual([
      ['supporter', 'Supporter (Standard Member)'],
      ['active_volunteer', 'Active Volunteer'],
      ['choir', 'Resistance Choir Member'],
      ['donor', 'Grassroots Donor'],
      ['organizer', 'Chapter Organizer / Board'],
      ['inactive', 'Inactive'],
    ]);

    expect(CRM_CONTACT_BULK_STATUS_OPTIONS.map(({ value, label }) => [value, label])).toEqual([
      ['active_volunteer', 'Active Volunteer'],
      ['organizer', 'Organizer'],
      ['choir', 'Resistance Choir'],
      ['donor', 'Donor'],
      ['supporter', 'Supporter'],
      ['inactive', 'Inactive'],
    ]);

    expect(
      CRM_CONTACT_BULK_CONSENT_OPTIONS.map(({ value, bulkLabel }) => [value, bulkLabel])
    ).toEqual([
      ['opted_in', 'Opt in'],
      ['opted_out', 'Opt out'],
      ['unasked', 'Mark unasked'],
    ]);

    expect(AVAILABLE_STATUSES).toEqual([
      { id: 'active_volunteer', label: 'Active Volunteers' },
      { id: 'choir', label: 'Resistance Choir' },
      { id: 'donor', label: 'Donors' },
      { id: 'organizer', label: 'Organizers' },
      { id: 'supporter', label: 'Supporters' },
      { id: 'inactive', label: 'Inactive' },
    ]);
    expect(CRM_CONTACT_BROADCAST_STATUS_OPTIONS.map((option) => option.value)).toEqual(
      AVAILABLE_STATUSES.map((option) => option.id)
    );

    expect(AVAILABLE_DISTRICTS).toEqual([
      { id: 'CA-06', label: 'CA-06 (Sacramento/Carmichael)' },
      { id: 'CA-03', label: 'CA-03 (Fair Oaks/Sierra)' },
      { id: 'CA-07', label: 'CA-07' },
    ]);

    expect(
      CRM_CONTACT_DISTRICT_OPTIONS.map(({ value, editorLabel }) => [value, editorLabel])
    ).toEqual([
      ['CA-06', 'CA-06 (Bera / Matsui)'],
      ['CA-03', 'CA-03 (Kiley / Sierra)'],
      ['CA-07', 'CA-07'],
      ['Other', 'Other / Regional'],
    ]);
  });

  it('gives every status a non-empty label for every surface', () => {
    for (const option of CRM_CONTACT_STATUS_OPTIONS) {
      for (const field of STATUS_LABEL_FIELDS) {
        expectLabel(option[field], `${option.value}.${field}`);
      }
    }
  });

  it('keeps each label variant unambiguous across statuses', () => {
    for (const field of STATUS_LABEL_FIELDS) {
      expectUnique(CRM_CONTACT_STATUS_OPTIONS.map((option) => option[field]));
    }
  });
});

describe('CRM contact district options', () => {
  it('lists every district exactly once, in display order', () => {
    expect([...CRM_CONTACT_DISTRICT_VALUES]).toEqual(['CA-06', 'CA-03', 'CA-07', 'Other']);
    expectUnique(CRM_CONTACT_DISTRICT_VALUES);
    expect(CRM_CONTACT_DISTRICT_OPTIONS.map((option) => option.value)).toEqual([
      ...CRM_CONTACT_DISTRICT_VALUES,
    ]);
  });

  it('gives every district a non-empty label for every surface', () => {
    for (const option of CRM_CONTACT_DISTRICT_OPTIONS) {
      for (const field of DISTRICT_LABEL_FIELDS) {
        expectLabel(option[field], `${option.value}.${field}`);
      }
    }
  });

  it('keeps each label variant unambiguous across districts', () => {
    for (const field of DISTRICT_LABEL_FIELDS) {
      expectUnique(CRM_CONTACT_DISTRICT_OPTIONS.map((option) => option[field]));
    }
  });
});

describe('CRM contact consent options', () => {
  it('lists every stored consent state exactly once, in display order', () => {
    expect([...CRM_CONTACT_CONSENT_VALUES]).toEqual(['opted_out', 'opted_in', 'unasked']);
    expectUnique(CRM_CONTACT_CONSENT_VALUES);
    expect(CRM_CONTACT_CONSENT_OPTIONS.map((option) => option.value)).toEqual([
      ...CRM_CONTACT_CONSENT_VALUES,
    ]);
    expect(CRM_CONTACT_CONSENT_OPTIONS.map((option) => option.label)).toEqual([
      'Opted out',
      'Opted in',
      'Never asked',
    ]);
  });

  it('gives every consent state its own compact icon', () => {
    expect(CRM_CONTACT_CONSENT_OPTIONS.map(({ value, icon }) => [value, icon])).toEqual([
      ['opted_out', '✗'],
      ['opted_in', '✓'],
      ['unasked', '?'],
    ]);
    expectUnique(CRM_CONTACT_CONSENT_OPTIONS.map((option) => option.icon));
  });

  it('gives every consent state a non-empty label for every surface', () => {
    for (const option of CRM_CONTACT_CONSENT_OPTIONS) {
      for (const field of CONSENT_LABEL_FIELDS) {
        expectLabel(option[field], `${option.value}.${field}`);
      }
    }
  });

  it('keeps each label variant unambiguous across consent states', () => {
    for (const field of CONSENT_LABEL_FIELDS) {
      expectUnique(CRM_CONTACT_CONSENT_OPTIONS.map((option) => option[field]));
    }
  });

  it('maps the stored tri-state to the option the editor selects', () => {
    expect(crmContactConsentValue(null)).toBe('unasked');
    expect(crmContactConsentValue(false)).toBe('opted_in');
    expect(crmContactConsentValue(true)).toBe('opted_out');

    const mapped = [
      crmContactConsentValue(true),
      crmContactConsentValue(false),
      crmContactConsentValue(null),
    ];
    expect(new Set(mapped).size).toBe(CRM_CONTACT_CONSENT_VALUES.length);
    for (const value of mapped) {
      expect(CRM_CONTACT_CONSENT_VALUES).toContain(value);
    }
  });

  it('maps each editor choice back to the stored tri-state', () => {
    expect(crmContactDoNotEmail('opted_out')).toBe(true);
    expect(crmContactDoNotEmail('opted_in')).toBe(false);
    expect(crmContactDoNotEmail('unasked')).toBeNull();

    for (const decision of CRM_CONTACT_CONSENT_VALUES) {
      expect(crmContactConsentValue(crmContactDoNotEmail(decision))).toBe(decision);
    }
    for (const stored of [true, false, null] as const) {
      expect(crmContactDoNotEmail(crmContactConsentValue(stored))).toBe(stored);
    }
  });
});

describe('CRM contact defaults', () => {
  it('pins the creation and import defaults', () => {
    expect(CRM_CONTACT_DEFAULTS).toEqual({
      city: 'Fair Oaks',
      district: 'CA-06',
      status: 'supporter',
      doNotEmail: null,
    });
  });

  it('uses values that exist in the shared option lists', () => {
    expect(CRM_CONTACT_DISTRICT_VALUES).toContain(CRM_CONTACT_DEFAULTS.district);
    expect(CRM_CONTACT_STATUS_VALUES).toContain(CRM_CONTACT_DEFAULTS.status);
    expect(
      CRM_CONTACT_DISTRICT_OPTIONS.some((option) => option.value === CRM_CONTACT_DEFAULTS.district)
    ).toBe(true);
    expect(
      CRM_CONTACT_STATUS_OPTIONS.some((option) => option.value === CRM_CONTACT_DEFAULTS.status)
    ).toBe(true);
    expect(CRM_CONTACT_DEFAULTS.city.trim()).not.toBe('');
  });

  it('defaults a new contact to never-asked, not opted in', () => {
    expect(CRM_CONTACT_DEFAULTS.doNotEmail).toBeNull();
    expect(crmContactConsentValue(CRM_CONTACT_DEFAULTS.doNotEmail)).toBe('unasked');
    expect(CRM_CONTACT_CONSENT_VALUES).toContain(
      crmContactConsentValue(CRM_CONTACT_DEFAULTS.doNotEmail)
    );
  });
});

describe('CRM contact quick-filter subsets', () => {
  it('keeps the quick statuses a curated subset of the status vocabulary', () => {
    expect([...CRM_CONTACT_QUICK_STATUS_VALUES]).toEqual([
      'active_volunteer',
      'choir',
      'donor',
      'organizer',
    ]);
    expectUnique(CRM_CONTACT_QUICK_STATUS_VALUES);
    expect(CRM_CONTACT_QUICK_STATUS_VALUES.length).toBeLessThan(CRM_CONTACT_STATUS_VALUES.length);
    for (const value of CRM_CONTACT_QUICK_STATUS_VALUES) {
      expect(CRM_CONTACT_STATUS_VALUES).toContain(value);
      expect(CRM_CONTACT_STATUS_OPTIONS.some((option) => option.value === value)).toBe(true);
    }
  });

  it('keeps the quick districts a local subset of the district vocabulary', () => {
    expect([...CRM_CONTACT_QUICK_DISTRICT_VALUES]).toEqual(['CA-06', 'CA-03']);
    expectUnique(CRM_CONTACT_QUICK_DISTRICT_VALUES);
    expect(CRM_CONTACT_QUICK_DISTRICT_VALUES.length).toBeLessThan(
      CRM_CONTACT_DISTRICT_VALUES.length
    );
    for (const value of CRM_CONTACT_QUICK_DISTRICT_VALUES) {
      expect(CRM_CONTACT_DISTRICT_VALUES).toContain(value);
      expect(CRM_CONTACT_DISTRICT_OPTIONS.some((option) => option.value === value)).toBe(true);
    }
    expect(new Set<string>(CRM_CONTACT_QUICK_DISTRICT_VALUES).has('Other')).toBe(false);
  });
});

describe('CRM directory quick filters', () => {
  const statusPills = CRM_CONTACT_QUICK_FILTERS.filter((pill) => pill.status !== 'all');
  const districtPills = CRM_CONTACT_QUICK_FILTERS.filter((pill) => pill.district !== 'all');

  it('starts with the unfiltered pill and contains one pill per quick subset value', () => {
    expect(CRM_CONTACT_QUICK_FILTERS[0]).toEqual({
      label: 'All',
      status: 'all',
      district: 'all',
    });
    expect(CRM_CONTACT_QUICK_FILTERS).toHaveLength(
      1 + CRM_CONTACT_QUICK_STATUS_VALUES.length + CRM_CONTACT_QUICK_DISTRICT_VALUES.length
    );
    expect(statusPills.map((pill) => pill.status)).toEqual([...CRM_CONTACT_QUICK_STATUS_VALUES]);
    expect(districtPills.map((pill) => pill.district)).toEqual([
      ...CRM_CONTACT_QUICK_DISTRICT_VALUES,
    ]);
  });

  it('labels every status pill from the shared quick label', () => {
    for (const value of CRM_CONTACT_QUICK_STATUS_VALUES) {
      const option = CRM_CONTACT_STATUS_OPTIONS.find((candidate) => candidate.value === value);
      if (!option) throw new Error(`Missing status option for ${value}`);
      const pill = statusPills.find((candidate) => candidate.status === value);
      if (!pill) throw new Error(`Missing status pill for ${value}`);
      expect(pill.label).toBe(option.quickLabel);
    }
  });

  it('labels every district pill from the shared district label', () => {
    for (const value of CRM_CONTACT_QUICK_DISTRICT_VALUES) {
      const option = CRM_CONTACT_DISTRICT_OPTIONS.find((candidate) => candidate.value === value);
      if (!option) throw new Error(`Missing district option for ${value}`);
      const pill = districtPills.find((candidate) => candidate.district === value);
      if (!pill) throw new Error(`Missing district pill for ${value}`);
      expect(pill.label).toBe(`${option.label} Local`);
    }
  });

  it('only uses values the shared option lists know', () => {
    const statuses = new Set<string>(CRM_CONTACT_STATUS_VALUES);
    const districts = new Set<string>(CRM_CONTACT_DISTRICT_VALUES);
    for (const pill of CRM_CONTACT_QUICK_FILTERS) {
      expect(pill.status === 'all' || statuses.has(pill.status), pill.label).toBe(true);
      expect(pill.district === 'all' || districts.has(pill.district), pill.label).toBe(true);
    }
    for (const pill of statusPills) expect(pill.district).toBe('all');
    for (const pill of districtPills) expect(pill.status).toBe('all');
  });

  it('does not repeat a status/district pair', () => {
    expectUnique(CRM_CONTACT_QUICK_FILTERS.map((pill) => `${pill.status}|${pill.district}`));
  });
});
