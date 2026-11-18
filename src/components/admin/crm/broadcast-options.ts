export const AVAILABLE_STATUSES = [
  { id: 'active_volunteer', label: 'Active Volunteers' },
  { id: 'choir', label: 'Resistance Choir' },
  { id: 'donor', label: 'Donors' },
  { id: 'organizer', label: 'Organizers' },
  { id: 'supporter', label: 'Supporters' },
  { id: 'inactive', label: 'Inactive' },
];

export const AVAILABLE_DISTRICTS = [
  { id: 'CA-06', label: 'CA-06 (Sacramento/Carmichael)' },
  { id: 'CA-03', label: 'CA-03 (Fair Oaks/Sierra)' },
  { id: 'CA-07', label: 'CA-07' },
];

// Fallback when the directory has no tags yet (fresh install / empty CRM).
export const FALLBACK_TAGS = ['contact-form', 'registered-member', 'donor', 'organizer'];
