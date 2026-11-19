// @vitest-environment node
import { describe, expect, it } from 'vitest';
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

const STATUS_SURFACES = [
  ['status directory', CRM_CONTACT_STATUS_OPTIONS],
  ['status editor', CRM_CONTACT_EDITOR_STATUS_OPTIONS],
  ['status bulk bar', CRM_CONTACT_BULK_STATUS_OPTIONS],
  ['status broadcast audience', CRM_CONTACT_BROADCAST_STATUS_OPTIONS],
] as const;

const CONSENT_SURFACES = [
  ['consent directory', CRM_CONTACT_CONSENT_OPTIONS],
  ['consent bulk bar', CRM_CONTACT_BULK_CONSENT_OPTIONS],
] as const;

const CONSENT_MAPPINGS = [
  { decision: 'unasked', stored: null },
  { decision: 'opted_in', stored: false },
  { decision: 'opted_out', stored: true },
] as const satisfies readonly {
  decision: 'unasked' | 'opted_in' | 'opted_out';
  stored: boolean | null;
}[];

function expectComplete(
  name: string,
  values: readonly string[],
  options: readonly { value: string }[]
) {
  expect(new Set(values).size, `${name} has duplicate values`).toBe(values.length);
  expect(
    options.map((option) => option.value).sort(),
    `${name} does not cover its vocabulary exactly once`
  ).toEqual([...values].sort());
}

function expectDistinctText(name: string, values: readonly string[]) {
  for (const value of values) {
    expect(value, `${name} contains an empty value`).not.toBe('');
    expect(value, `${name} contains an untrimmed value`).toBe(value.trim());
  }
  expect(new Set(values).size, `${name} contains duplicate values`).toBe(values.length);
}

describe('CRM contact options', () => {
  it('covers every value exactly once on every surface', () => {
    for (const [name, options] of STATUS_SURFACES) {
      expectComplete(name, CRM_CONTACT_STATUS_VALUES, options);
    }
    expectComplete('district directory', CRM_CONTACT_DISTRICT_VALUES, CRM_CONTACT_DISTRICT_OPTIONS);
    for (const [name, options] of CONSENT_SURFACES) {
      expectComplete(name, CRM_CONTACT_CONSENT_VALUES, options);
    }
  });

  /*
   * The completeness test is deliberately order-insensitive. These orders are
   * user-visible product decisions, so the surfaces that do not use the
   * canonical order pin their own sequence here.
   */
  it('preserves the intentional order of each surface', () => {
    expect(CRM_CONTACT_EDITOR_STATUS_OPTIONS.map(({ value }) => value)).toEqual([
      'supporter',
      'active_volunteer',
      'choir',
      'donor',
      'organizer',
      'inactive',
    ]);
    expect(CRM_CONTACT_BULK_STATUS_OPTIONS.map(({ value }) => value)).toEqual([
      'active_volunteer',
      'organizer',
      'choir',
      'donor',
      'supporter',
      'inactive',
    ]);
    expect(CRM_CONTACT_BROADCAST_STATUS_OPTIONS.map(({ value }) => value)).toEqual([
      'active_volunteer',
      'choir',
      'donor',
      'organizer',
      'supporter',
      'inactive',
    ]);
    expect(CRM_CONTACT_BULK_CONSENT_OPTIONS.map(({ value }) => value)).toEqual([
      'opted_in',
      'opted_out',
      'unasked',
    ]);
  });

  it('gives every status a usable, distinct label on every surface', () => {
    for (const field of STATUS_LABEL_FIELDS) {
      expectDistinctText(
        `status.${field}`,
        CRM_CONTACT_STATUS_OPTIONS.map((option) => option[field])
      );
    }
  });

  it('gives every district a usable, distinct label on every surface', () => {
    for (const field of DISTRICT_LABEL_FIELDS) {
      expectDistinctText(
        `district.${field}`,
        CRM_CONTACT_DISTRICT_OPTIONS.map((option) => option[field])
      );
    }
  });

  it('gives every consent state a usable, distinct label on every surface', () => {
    for (const field of CONSENT_LABEL_FIELDS) {
      expectDistinctText(
        `consent.${field}`,
        CRM_CONTACT_CONSENT_OPTIONS.map((option) => option[field])
      );
    }
  });

  it('gives every consent state its own visible marker', () => {
    expectDistinctText(
      'consent.icon',
      CRM_CONTACT_CONSENT_OPTIONS.map((option) => option.icon)
    );
  });

  it.each(CONSENT_MAPPINGS)(
    'round-trips the $decision consent state through $stored',
    ({ decision, stored }) => {
      expect(crmContactDoNotEmail(decision)).toBe(stored);
      expect(crmContactConsentValue(stored)).toBe(decision);
    }
  );

  it('gives new contacts valid defaults and never implies consent', () => {
    expect(CRM_CONTACT_STATUS_VALUES).toContain(CRM_CONTACT_DEFAULTS.status);
    expect(CRM_CONTACT_DISTRICT_VALUES).toContain(CRM_CONTACT_DEFAULTS.district);
    expect(crmContactConsentValue(CRM_CONTACT_DEFAULTS.doNotEmail)).toBe('unasked');
  });
});
