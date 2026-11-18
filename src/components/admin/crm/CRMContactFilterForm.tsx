'use client';

import { Search } from 'lucide-react';
import type { FormEvent } from 'react';
import type { ConsentFilter } from '@/types/crm';

type CRMContactFilterFormProps = {
  query: string;
  status: string;
  district: string;
  tag: string;
  consent: ConsentFilter;
  tagOptions: string[];
  tagsMayBeIncomplete: boolean;
  isPending: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onConsentChange: (value: ConsentFilter) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
};

export function CRMContactFilterForm({
  query,
  status,
  district,
  tag,
  consent,
  tagOptions,
  tagsMayBeIncomplete,
  isPending,
  onQueryChange,
  onStatusChange,
  onDistrictChange,
  onTagChange,
  onConsentChange,
  onSubmit,
  onReset,
}: CRMContactFilterFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3"
    >
      {/* Search Query */}
      <div className="lg:col-span-2 relative">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={16}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search name, email, city, notes..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm bg-surface-muted/50"
        />
      </div>

      {/* Status Filter */}
      <div>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          aria-label="Filter by engagement status"
          className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-surface-muted/50"
        >
          <option value="all">All Engagement Statuses</option>
          <option value="active_volunteer">Active Volunteers</option>
          <option value="choir">Resistance Choir</option>
          <option value="donor">Grassroots Donors</option>
          <option value="organizer">Organizers</option>
          <option value="supporter">Supporters</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* District Filter */}
      <div>
        <select
          value={district}
          onChange={(e) => onDistrictChange(e.target.value)}
          // The Tag and Consent selects below already had these; Status and
          // District did not, so a screen reader announced two bare combo
          // boxes in a row with nothing to say what either filtered.
          aria-label="Filter by district"
          className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-surface-muted/50"
        >
          <option value="all">All Districts</option>
          <option value="CA-06">CA-06 (Sacramento/Carmichael)</option>
          <option value="CA-03">CA-03 (Fair Oaks/Sierra)</option>
          <option value="CA-07">CA-07</option>
          <option value="Other">Other Districts</option>
        </select>
      </div>

      {/* Tag Filter */}
      <div>
        <select
          value={tag}
          onChange={(e) => onTagChange(e.target.value)}
          aria-label="Filter by tag"
          className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-surface-muted/50"
        >
          <option value="all">All Tags</option>
          {tagOptions.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
          {tag !== 'all' && !tagOptions.includes(tag) && <option value={tag}>#{tag}</option>}
        </select>
        {/* Sits under the select rather than in the empty state, because the empty state
            only appears *after* the organiser has already concluded the tag does not
            exist. "0 constituents" and "this tag is not in the list because the list is
            partial" look identical otherwise, and the reader has no reason to doubt the
            list. Deliberately not an error colour. Nothing failed, and a chapter with a
            large directory is an ordinary situation rather than a fault. */}
        {tagsMayBeIncomplete && (
          <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
            This directory is large enough that the tag list is partial. If a tag is missing,
            search by name above — a tag with no entry here does not mean no constituent has it.
          </p>
        )}
      </div>

      {/* Consent Filter */}
      <div>
        <select
          value={consent}
          onChange={(e) => onConsentChange(e.target.value as ConsentFilter)}
          aria-label="Filter by email consent"
          className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-surface-muted/50"
        >
          <option value="all">All Consent States</option>
          <option value="opted_out">Opted Out of Email</option>
          <option value="opted_in">Agreed to Email</option>
          {/* The third state is reachable and filterable since the column became
              nullable. It was not before, which meant an organiser asking "who
              have we never actually asked?" had no way to find out — the only
              question the directory could answer was who had said no. */}
          <option value="unasked">Never Asked</option>
        </select>
      </div>

      {/* Apply Button */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 px-4 py-2.5 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-xs"
        >
          {isPending ? 'Filtering...' : 'Apply Filters'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl hover:bg-surface-muted transition-colors"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
