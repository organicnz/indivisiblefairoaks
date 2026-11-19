import {
  CRM_CONTACT_BROADCAST_STATUS_OPTIONS,
  CRM_CONTACT_DISTRICT_OPTIONS,
} from '@/lib/crm-contact-options';

export const AVAILABLE_STATUSES = CRM_CONTACT_BROADCAST_STATUS_OPTIONS.map((option) => ({
  id: option.value,
  label: option.broadcastLabel,
}));

/** Broadcasts keep their previous three-district scope; `Other` is directory-only. */
export const AVAILABLE_DISTRICTS = CRM_CONTACT_DISTRICT_OPTIONS.filter(
  (option) => option.value !== 'Other'
).map((option) => ({ id: option.value, label: option.filterLabel }));

// Fallback when the directory has no tags yet (fresh install / empty CRM).
export const FALLBACK_TAGS = ['contact-form', 'registered-member', 'donor', 'organizer'];
