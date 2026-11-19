'use client';

import { Check, Loader2, Trash2 } from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CRMPanelContactFilters } from '@/components/visual-edit/CRMPanelContactFilters';
import { CONSENT_COLORS, STATUS_COLORS } from '@/components/visual-edit/crm-panel-styles';
import {
  CRM_CONTACT_BULK_CONSENT_OPTIONS,
  CRM_CONTACT_BULK_STATUS_OPTIONS,
  CRM_CONTACT_CONSENT_OPTIONS,
  CRM_CONTACT_STATUS_OPTIONS,
  crmContactConsentValue,
} from '@/lib/crm-contact-options';
import type { ConsentDecision, ConsentFilter, CRMContact, CRMContactStatus } from '@/types/unified';

/** The directory read and the pagination controls must agree on this size. */
export const CRM_CONTACT_PAGE_SIZE = 25;

type CRMPanelContactListProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  consentFilter: ConsentFilter;
  onConsentChange: (value: ConsentFilter) => void;
  statusFilter: CRMContact['status'] | 'all';
  onStatusChange: (value: CRMContact['status'] | 'all') => void;
  selectedTag: string;
  onTagChange: (value: string) => void;
  districtFilter: string;
  onDistrictChange: (value: string) => void;
  availableTags: string[];
  appliedSegment: { name: string } | null;
  hasActiveFilters: boolean;
  onClearSegment: () => void;
  onResetFilters: () => void;
  contacts: CRMContact[];
  selectedContact: CRMContact | null;
  onSelectContact: (contact: CRMContact) => void;
  showSegments: boolean;
  loading: boolean;
  totalCount: number;
  page: number;
  onPageChange: (page: number) => void;
  selectedContactIds: Set<string>;
  onSelectedContactIdsChange: Dispatch<SetStateAction<Set<string>>>;
  isBulkUpdating: boolean;
  bulkTagInput: string;
  onBulkTagInputChange: (value: string) => void;
  bulkDistrictInput: string;
  onBulkDistrictInputChange: (value: string) => void;
  onBulkStatus: (status: CRMContactStatus) => void;
  onBulkConsent: (consent: ConsentDecision) => void;
  onBulkAddTag: () => void;
  onBulkDistrict: () => void;
  onBulkDelete: () => void;
};

type CRMPanelContactRowProps = {
  contact: CRMContact;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onToggleSelection: (checked: boolean) => void;
};

function CRMPanelContactRow({
  contact,
  isSelected,
  isChecked,
  onSelect,
  onToggleSelection,
}: CRMPanelContactRowProps) {
  const currentConsent = crmContactConsentValue(contact.do_not_email);
  const statusLabel =
    CRM_CONTACT_STATUS_OPTIONS.find((option) => option.value === contact.status)?.compactLabel ??
    contact.status.replace('_', ' ');

  return (
    <li
      className={`flex items-start gap-2.5 px-3 py-2 transition-colors ${
        isSelected ? 'bg-primary/10' : 'hover:bg-background/50'
      }`}
    >
      <input
        type="checkbox"
        aria-label={`Select ${contact.first_name} ${contact.last_name}`}
        checked={isChecked}
        onChange={(event) => {
          event.stopPropagation();
          onToggleSelection(event.target.checked);
        }}
        className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 mt-1 shrink-0 cursor-pointer"
      />
      <button
        type="button"
        className="flex-1 min-w-0 text-left cursor-pointer focus:outline-none"
        onClick={onSelect}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-foreground text-sm">
              {contact.first_name} {contact.last_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                STATUS_COLORS[contact.status] || 'bg-muted text-muted-foreground'
              }`}
            >
              {statusLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          {contact.district && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20">
              {contact.district}
            </span>
          )}
          {CRM_CONTACT_CONSENT_OPTIONS.map((opt) => (
            <span
              key={opt.value}
              title={opt.label}
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                currentConsent === opt.value
                  ? CONSENT_COLORS[opt.value]
                  : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              {opt.icon}
              <span className="sr-only"> {opt.label}</span>
            </span>
          ))}
        </div>
      </button>
    </li>
  );
}

export function CRMPanelContactList({
  searchInputRef,
  searchQuery,
  onSearchChange,
  consentFilter,
  onConsentChange,
  statusFilter,
  onStatusChange,
  selectedTag,
  onTagChange,
  districtFilter,
  onDistrictChange,
  availableTags,
  appliedSegment,
  hasActiveFilters,
  onClearSegment,
  onResetFilters,
  contacts,
  selectedContact,
  onSelectContact,
  showSegments,
  loading,
  totalCount,
  page,
  onPageChange,
  selectedContactIds,
  onSelectedContactIdsChange,
  isBulkUpdating,
  bulkTagInput,
  onBulkTagInputChange,
  bulkDistrictInput,
  onBulkDistrictInputChange,
  onBulkStatus,
  onBulkConsent,
  onBulkAddTag,
  onBulkDistrict,
  onBulkDelete,
}: CRMPanelContactListProps) {
  const allOnPageSelected =
    contacts.length > 0 && contacts.every((contact) => selectedContactIds.has(contact.id));

  const setPageSelection = (checked: boolean) => {
    onSelectedContactIdsChange((previous) => {
      const next = new Set(previous);
      for (const contact of contacts) {
        if (checked) {
          next.add(contact.id);
        } else {
          next.delete(contact.id);
        }
      }
      return next;
    });
  };

  const toggleSelection = (contactId: string, checked: boolean) => {
    onSelectedContactIdsChange((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(contactId);
      } else {
        next.delete(contactId);
      }
      return next;
    });
  };

  return (
    <div
      className={`w-full md:w-96 flex flex-col border-r border-border bg-muted/30 shrink-0 ${
        selectedContact || showSegments ? 'hidden md:flex' : 'flex'
      }`}
    >
      <CRMPanelContactFilters
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        consentFilter={consentFilter}
        onConsentChange={onConsentChange}
        statusFilter={statusFilter}
        onStatusChange={onStatusChange}
        selectedTag={selectedTag}
        onTagChange={onTagChange}
        districtFilter={districtFilter}
        onDistrictChange={onDistrictChange}
        availableTags={availableTags}
        appliedSegment={appliedSegment}
        hasActiveFilters={hasActiveFilters}
        onClearSegment={onClearSegment}
        onResetFilters={onResetFilters}
      />

      {/* Select All & Multi-Select Toolbar */}
      {contacts.length > 0 && (
        <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              aria-label="Select all constituents on page"
              checked={allOnPageSelected}
              onChange={(event) => setPageSelection(event.target.checked)}
              className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-muted-foreground font-medium">
              {selectedContactIds.size > 0
                ? `${selectedContactIds.size} selected`
                : `Select all (${contacts.length})`}
            </span>
          </label>
          {selectedContactIds.size > 0 && (
            <button
              type="button"
              onClick={() => onSelectedContactIdsChange(new Set())}
              className="text-muted-foreground hover:text-foreground text-[11px] underline"
              aria-label="Clear selection"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {selectedContactIds.size > 0 && (
        <div className="p-2.5 bg-primary/5 border-b border-primary/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-primary">
            <span className="flex items-center gap-1.5">
              <Check size={13} className="text-primary" />
              <span>Bulk Actions ({selectedContactIds.size})</span>
            </span>
            {isBulkUpdating && <Loader2 size={12} className="animate-spin text-primary" />}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <select
              onChange={(event) => {
                if (event.target.value) {
                  onBulkStatus(event.target.value as CRMContactStatus);
                  event.target.value = '';
                }
              }}
              defaultValue=""
              disabled={isBulkUpdating}
              aria-label="Bulk update status"
              className="px-2 py-1 rounded bg-background border border-border text-[11px] font-medium focus:ring-1 focus:ring-primary truncate disabled:opacity-50"
            >
              <option value="" disabled>
                Change status…
              </option>
              {CRM_CONTACT_BULK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.compactLabel}
                </option>
              ))}
            </select>
            <select
              onChange={(event) => {
                if (event.target.value) {
                  onBulkConsent(event.target.value as ConsentDecision);
                  event.target.value = '';
                }
              }}
              defaultValue=""
              disabled={isBulkUpdating}
              aria-label="Bulk update consent"
              className="px-2 py-1 rounded bg-background border border-border text-[11px] font-medium focus:ring-1 focus:ring-primary truncate disabled:opacity-50"
            >
              <option value="" disabled>
                Change consent…
              </option>
              {CRM_CONTACT_BULK_CONSENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.bulkLabel}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={bulkTagInput}
              onChange={(event) => onBulkTagInputChange(event.target.value)}
              placeholder="Add tag to selected…"
              disabled={isBulkUpdating}
              aria-label="Bulk tag name input"
              className="w-full px-2 py-1 text-[11px] rounded bg-background border border-border focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onBulkAddTag();
                }
              }}
            />
            <button
              type="button"
              onClick={onBulkAddTag}
              disabled={!bulkTagInput.trim() || isBulkUpdating}
              aria-label="Apply bulk tag"
              className="px-2 py-1 text-[11px] font-bold rounded bg-primary text-white hover:bg-primary-light disabled:opacity-50 shrink-0 transition-colors"
            >
              Tag
            </button>
            <ConfirmAction
              label={`Delete ${selectedContactIds.size} constituents`}
              message={`Delete ${selectedContactIds.size} selected constituents? This cannot be undone.`}
              confirmLabel="Delete all"
              danger
              onConfirm={onBulkDelete}
              idleClassName="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs transition-colors shrink-0 disabled:opacity-50"
            >
              <Trash2 size={13} />
            </ConfirmAction>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={bulkDistrictInput}
              onChange={(event) => onBulkDistrictInputChange(event.target.value)}
              placeholder="Assign district (e.g. CA-06)…"
              disabled={isBulkUpdating}
              aria-label="Bulk district input"
              className="w-full px-2 py-1 text-[11px] rounded bg-background border border-border focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onBulkDistrict();
                }
              }}
            />
            <button
              type="button"
              onClick={onBulkDistrict}
              disabled={!bulkDistrictInput.trim() || isBulkUpdating}
              aria-label="Apply bulk district"
              className="px-2 py-1 text-[11px] font-bold rounded bg-primary text-white hover:bg-primary-light disabled:opacity-50 shrink-0 transition-colors"
            >
              District
            </button>
          </div>
        </div>
      )}

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="font-medium">No constituents found</p>
            <p className="text-xs mt-1">Adjust your search or create a new constituent</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {contacts.map((contact) => (
              <CRMPanelContactRow
                key={contact.id}
                contact={contact}
                isSelected={selectedContact?.id === contact.id}
                isChecked={selectedContactIds.has(contact.id)}
                onSelect={() => onSelectContact(contact)}
                onToggleSelection={(checked) => toggleSelection(contact.id, checked)}
              />
            ))}
          </ul>
        )}

        {/* Pagination */}
        {totalCount > CRM_CONTACT_PAGE_SIZE && (
          <div className="p-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {page} of {Math.ceil(totalCount / CRM_CONTACT_PAGE_SIZE)} ({totalCount} total)
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page === 1 || loading}
                onClick={() => onPageChange(page - 1)}
                className="px-2 py-1 text-xs rounded border border-border hover:bg-muted disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page * CRM_CONTACT_PAGE_SIZE >= totalCount || loading}
                onClick={() => onPageChange(page + 1)}
                className="px-2 py-1 text-xs rounded border border-border hover:bg-muted disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
