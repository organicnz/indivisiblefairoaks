import type { ConsentDecision, CRMContactStatus } from '@/types/crm';

export type CRMContactStatusOption = {
  value: CRMContactStatus;
  /** Singular label for the table, profile, and bulk controls. */
  label: string;
  /** Plural label for directory filters. */
  filterLabel: string;
  /** Plural label for the broadcast audience chips. */
  broadcastLabel: string;
  /** Explanatory label for the full contact editor modal. */
  editorLabel: string;
  /** Short label for the compact visual-editor panel. */
  compactLabel: string;
  /** Curated label for the directory's quick-filter pills. */
  quickLabel: string;
};

const STATUS_LABELS: Record<CRMContactStatus, Omit<CRMContactStatusOption, 'value'>> = {
  active_volunteer: {
    label: 'Active Volunteer',
    filterLabel: 'Active Volunteers',
    broadcastLabel: 'Active Volunteers',
    editorLabel: 'Active Volunteer',
    compactLabel: 'Active volunteer',
    quickLabel: 'Volunteers',
  },
  supporter: {
    label: 'Supporter',
    filterLabel: 'Supporters',
    broadcastLabel: 'Supporters',
    editorLabel: 'Supporter (Standard Member)',
    compactLabel: 'Supporter',
    quickLabel: 'Supporters',
  },
  donor: {
    label: 'Donor',
    filterLabel: 'Grassroots Donors',
    // The broadcast audience has kept the shorter legacy label; the directory
    // filter names the same status more specifically.
    broadcastLabel: 'Donors',
    editorLabel: 'Grassroots Donor',
    compactLabel: 'Donor',
    quickLabel: 'Donors',
  },
  choir: {
    label: 'Resistance Choir',
    filterLabel: 'Resistance Choir',
    broadcastLabel: 'Resistance Choir',
    editorLabel: 'Resistance Choir Member',
    compactLabel: 'Choir',
    quickLabel: 'Resistance Choir',
  },
  organizer: {
    label: 'Organizer',
    filterLabel: 'Organizers',
    broadcastLabel: 'Organizers',
    editorLabel: 'Chapter Organizer / Board',
    compactLabel: 'Organizer',
    quickLabel: 'Organizers',
  },
  inactive: {
    label: 'Inactive',
    filterLabel: 'Inactive',
    broadcastLabel: 'Inactive',
    editorLabel: 'Inactive',
    compactLabel: 'Inactive',
    quickLabel: 'Inactive',
  },
};

export const CRM_CONTACT_STATUS_VALUES = [
  'active_volunteer',
  'supporter',
  'donor',
  'choir',
  'organizer',
  'inactive',
] as const satisfies readonly CRMContactStatus[];

function statusOptions(values: readonly CRMContactStatus[]): CRMContactStatusOption[] {
  return values.map((value) => ({ value, ...STATUS_LABELS[value] }));
}

export const CRM_CONTACT_STATUS_OPTIONS: readonly CRMContactStatusOption[] =
  statusOptions(CRM_CONTACT_STATUS_VALUES);

/**
 * Per-surface display orders, preserved from the pre-refactor controls.
 *
 * A single shared order cannot represent them: the editor put Supporter first,
 * while the bulk bar and broadcast audience deliberately led with volunteers
 * and choir respectively. Keeping the orders named here makes a later refactor
 * choose a surface's order explicitly rather than inheriting another one.
 */
export const CRM_CONTACT_EDITOR_STATUS_VALUES = [
  'supporter',
  'active_volunteer',
  'choir',
  'donor',
  'organizer',
  'inactive',
] as const satisfies readonly CRMContactStatus[];

export const CRM_CONTACT_EDITOR_STATUS_OPTIONS: readonly CRMContactStatusOption[] = statusOptions(
  CRM_CONTACT_EDITOR_STATUS_VALUES
);

export const CRM_CONTACT_BULK_STATUS_VALUES = [
  'active_volunteer',
  'organizer',
  'choir',
  'donor',
  'supporter',
  'inactive',
] as const satisfies readonly CRMContactStatus[];

export const CRM_CONTACT_BULK_STATUS_OPTIONS: readonly CRMContactStatusOption[] = statusOptions(
  CRM_CONTACT_BULK_STATUS_VALUES
);

export const CRM_CONTACT_BROADCAST_STATUS_VALUES = [
  'active_volunteer',
  'choir',
  'donor',
  'organizer',
  'supporter',
  'inactive',
] as const satisfies readonly CRMContactStatus[];

export const CRM_CONTACT_BROADCAST_STATUS_OPTIONS: readonly CRMContactStatusOption[] =
  statusOptions(CRM_CONTACT_BROADCAST_STATUS_VALUES);

export const CRM_CONTACT_QUICK_STATUS_VALUES = [
  'active_volunteer',
  'choir',
  'donor',
  'organizer',
] as const satisfies readonly CRMContactStatus[];

export type CRMContactDistrict = 'CA-06' | 'CA-03' | 'CA-07' | 'Other';

export type CRMContactDistrictOption = {
  value: CRMContactDistrict;
  /** Plain district code for compact controls. */
  label: string;
  /** Descriptive label for the directory filter and broadcast chips. */
  filterLabel: string;
  /** Explanatory label for the full contact editor modal. */
  editorLabel: string;
};

const DISTRICT_LABELS: Record<CRMContactDistrict, Omit<CRMContactDistrictOption, 'value'>> = {
  'CA-06': {
    label: 'CA-06',
    filterLabel: 'CA-06 (Sacramento/Carmichael)',
    editorLabel: 'CA-06 (Bera / Matsui)',
  },
  'CA-03': {
    label: 'CA-03',
    filterLabel: 'CA-03 (Fair Oaks/Sierra)',
    editorLabel: 'CA-03 (Kiley / Sierra)',
  },
  'CA-07': {
    label: 'CA-07',
    filterLabel: 'CA-07',
    editorLabel: 'CA-07',
  },
  Other: {
    label: 'Other',
    filterLabel: 'Other Districts',
    editorLabel: 'Other / Regional',
  },
};

export const CRM_CONTACT_DISTRICT_VALUES = [
  'CA-06',
  'CA-03',
  'CA-07',
  'Other',
] as const satisfies readonly CRMContactDistrict[];

export const CRM_CONTACT_DISTRICT_OPTIONS: readonly CRMContactDistrictOption[] =
  CRM_CONTACT_DISTRICT_VALUES.map((value) => ({ value, ...DISTRICT_LABELS[value] }));

export const CRM_CONTACT_QUICK_DISTRICT_VALUES = [
  'CA-06',
  'CA-03',
] as const satisfies readonly CRMContactDistrict[];

export type CRMContactConsentOption = {
  value: ConsentDecision;
  /** Single-character marker used by the compact 360 controls. */
  icon: string;
  /** Generic label used by chips and inline status badges. */
  label: string;
  /** Filter-bar and stored-segment label. */
  filterLabel: string;
  /** Compact bulk-action label. */
  bulkLabel: string;
  /** Consequence-first label for the profile editor. */
  profileLabel: string;
  /** Lowercase label for the directory table. */
  tableLabel: string;
};

const CONSENT_LABELS: Record<ConsentDecision, Omit<CRMContactConsentOption, 'value'>> = {
  opted_out: {
    icon: '✗',
    label: 'Opted out',
    filterLabel: 'Opted Out of Email',
    bulkLabel: 'Opt out',
    profileLabel: 'Opted out — not in the audience',
    tableLabel: 'opt-out',
  },
  opted_in: {
    icon: '✓',
    label: 'Opted in',
    filterLabel: 'Agreed to Email',
    bulkLabel: 'Opt in',
    profileLabel: 'Agreed — receives broadcasts',
    tableLabel: 'opted-in',
  },
  unasked: {
    icon: '?',
    label: 'Never asked',
    filterLabel: 'Never Asked',
    bulkLabel: 'Mark unasked',
    profileLabel: 'Never asked — not in the audience',
    tableLabel: 'unasked',
  },
};

export const CRM_CONTACT_CONSENT_VALUES = [
  'opted_out',
  'opted_in',
  'unasked',
] as const satisfies readonly ConsentDecision[];

function consentOptions(values: readonly ConsentDecision[]): CRMContactConsentOption[] {
  return values.map((value) => ({ value, ...CONSENT_LABELS[value] }));
}

export const CRM_CONTACT_CONSENT_OPTIONS: readonly CRMContactConsentOption[] = consentOptions(
  CRM_CONTACT_CONSENT_VALUES
);

/** The bulk control's pre-refactor order: opt in, opt out, then never asked. */
export const CRM_CONTACT_BULK_CONSENT_VALUES = [
  'opted_in',
  'opted_out',
  'unasked',
] as const satisfies readonly ConsentDecision[];

export const CRM_CONTACT_BULK_CONSENT_OPTIONS: readonly CRMContactConsentOption[] = consentOptions(
  CRM_CONTACT_BULK_CONSENT_VALUES
);

/** Field defaults shared by the contact editor, import path, and directory. */
export const CRM_CONTACT_DEFAULTS = {
  city: 'Fair Oaks',
  district: 'CA-06',
  status: 'supporter',
  doNotEmail: null,
} as const satisfies {
  city: string;
  district: CRMContactDistrict;
  status: CRMContactStatus;
  doNotEmail: boolean | null;
};

/**
 * The identity form of an email address. Every CRM write stores this form, so
 * the editor's duplicate preflight and the action that actually writes the row
 * must normalize the same way. The database's unique constraint remains the
 * authoritative backstop for a row created between the preflight and the write.
 */
export function normalizeCRMEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Map the tri-state database column back to the editor's consent option. */
export function crmContactConsentValue(doNotEmail: boolean | null): ConsentDecision {
  if (doNotEmail === null) return 'unasked';
  return doNotEmail ? 'opted_out' : 'opted_in';
}

/** Map the editor's consent option back to the tri-state database column. */
export function crmContactDoNotEmail(consent: ConsentDecision): boolean | null {
  if (consent === 'unasked') return null;
  return consent === 'opted_out';
}
