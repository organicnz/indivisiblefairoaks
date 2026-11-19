'use client';

import { MapPin, RotateCcw, Search, Tag, X } from 'lucide-react';
import type { RefObject } from 'react';
import { CRM_CONTACT_CONSENT_OPTIONS, CRM_CONTACT_STATUS_OPTIONS } from '@/lib/crm-contact-options';
import type { ConsentFilter, CRMContact } from '@/types/unified';

interface CRMPanelContactFiltersProps {
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
}

export function CRMPanelContactFilters({
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
}: CRMPanelContactFiltersProps) {
  return (
    <div className="p-3 border-b border-border space-y-2">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          size={16}
        />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search constituents… (/)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={appliedSegment !== null}
          title={appliedSegment ? 'Clear the applied segment to search manually' : undefined}
          className="w-full pl-10 pr-8 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              searchInputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={consentFilter}
          onChange={(e) => onConsentChange(e.target.value as ConsentFilter)}
          aria-label="Filter by email consent"
          disabled={appliedSegment !== null}
          title={appliedSegment ? 'Clear the applied segment to filter manually' : undefined}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary truncate disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="all">All consent</option>
          {CRM_CONTACT_CONSENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as CRMContact['status'] | 'all')}
          aria-label="Filter by constituent status"
          disabled={appliedSegment !== null}
          title={appliedSegment ? 'Clear the applied segment to filter manually' : undefined}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary truncate disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="all">All statuses</option>
          {CRM_CONTACT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.compactLabel}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          value={selectedTag}
          onChange={(e) => onTagChange(e.target.value)}
          aria-label="Filter by tag"
          disabled={appliedSegment !== null}
          title={appliedSegment ? 'Clear the applied segment to filter manually' : undefined}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary truncate disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">
            All tags{availableTags.length > 0 ? ` (${availableTags.length})` : ''}
          </option>
          {availableTags.map((tag) => (
            <option key={tag} value={tag}>
              #{tag}
            </option>
          ))}
        </select>
        {selectedTag && (
          <button
            type="button"
            onClick={() => onTagChange('')}
            className="px-2 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1 transition-colors"
            aria-label="Clear tag filter"
            title="Clear tag filter"
          >
            <X size={12} />
            <span>Clear</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="relative w-full">
          <MapPin
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={districtFilter}
            onChange={(e) => onDistrictChange(e.target.value)}
            placeholder="Filter by district (e.g. CA-06)…"
            aria-label="Filter by district"
            disabled={appliedSegment !== null}
            title={appliedSegment ? 'Clear the applied segment to filter manually' : undefined}
            className="w-full pl-7 pr-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        {districtFilter && (
          <button
            type="button"
            onClick={() => onDistrictChange('')}
            className="px-2 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1 transition-colors"
            aria-label="Clear district filter"
            title="Clear district filter"
          >
            <X size={12} />
            <span>Clear</span>
          </button>
        )}
      </div>
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {appliedSegment && (
            <div className="flex items-center justify-between gap-1 px-2 py-0.5 rounded-md bg-primary text-white text-xs max-w-full">
              <span className="font-semibold truncate">Segment: {appliedSegment.name}</span>
              <button
                type="button"
                onClick={onClearSegment}
                className="hover:text-white/70 p-0.5 rounded shrink-0"
                aria-label="Clear applied segment"
                title="Clear the applied segment and return to manual filters"
              >
                <X size={11} />
              </button>
            </div>
          )}
          {searchQuery.trim() && (
            <div className="flex items-center justify-between gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs max-w-full">
              <span className="flex items-center gap-1 truncate">
                <Search size={11} className="shrink-0" />
                <span className="font-semibold truncate">
                  Search: &ldquo;{searchQuery.trim()}&rdquo;
                </span>
              </span>
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="text-primary hover:text-primary-dark p-0.5 rounded shrink-0"
                aria-label="Remove search filter"
              >
                <X size={11} />
              </button>
            </div>
          )}
          {statusFilter !== 'all' && (
            <div className="flex items-center justify-between gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs">
              <span className="font-semibold truncate">
                Status:{' '}
                {CRM_CONTACT_STATUS_OPTIONS.find((option) => option.value === statusFilter)
                  ?.compactLabel ?? statusFilter}
              </span>
              <button
                type="button"
                onClick={() => onStatusChange('all')}
                className="text-primary hover:text-primary-dark p-0.5 rounded shrink-0"
                aria-label="Remove status filter"
              >
                <X size={11} />
              </button>
            </div>
          )}
          {consentFilter !== 'all' && (
            <div className="flex items-center justify-between gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs">
              <span className="font-semibold truncate">
                Consent:{' '}
                {CRM_CONTACT_CONSENT_OPTIONS.find((option) => option.value === consentFilter)
                  ?.label ?? consentFilter}
              </span>
              <button
                type="button"
                onClick={() => onConsentChange('all')}
                className="text-primary hover:text-primary-dark p-0.5 rounded shrink-0"
                aria-label="Remove consent filter"
              >
                <X size={11} />
              </button>
            </div>
          )}
          {selectedTag && (
            <div className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs">
              <span className="flex items-center gap-1.5 truncate">
                <Tag size={12} className="shrink-0" />
                <span className="font-semibold truncate">Filtered by #{selectedTag}</span>
              </span>
              <button
                type="button"
                onClick={() => onTagChange('')}
                className="text-primary hover:text-primary-dark p-0.5 rounded"
                aria-label="Remove active tag filter"
              >
                <X size={11} />
              </button>
            </div>
          )}
          {districtFilter.trim() && (
            <div className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs">
              <span className="flex items-center gap-1.5 truncate">
                <MapPin size={12} className="shrink-0" />
                <span className="font-semibold truncate">District: {districtFilter}</span>
              </span>
              <button
                type="button"
                onClick={() => onDistrictChange('')}
                className="text-primary hover:text-primary-dark p-0.5 rounded"
                aria-label="Remove active district filter"
              >
                <X size={11} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-background hover:bg-muted text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Reset all filters"
            title="Reset all filters"
          >
            <RotateCcw size={10} />
            <span>Reset all</span>
          </button>
        </div>
      )}
    </div>
  );
}
