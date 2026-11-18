'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import type {
  RapidKindFilter,
  RapidStatusFilter,
  RapidTimeFilter,
  RapidFilters,
} from './rapid-alert-utils';
import type { RapidFeedRequestState } from './rapid-types';

const KIND_OPTIONS: { value: RapidKindFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'enforcement', label: 'Enforcement' },
  { value: 'detention', label: 'Detention' },
  { value: 'checkpoint', label: 'Checkpoint' },
];

const STATUS_OPTIONS: { value: RapidStatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'source-confirmed', label: 'Source-confirmed' },
  { value: 'sighting', label: 'Sighting' },
];

const TIME_OPTIONS: { value: RapidTimeFilter; label: string }[] = [
  { value: 'live', label: 'Live <4h' },
  { value: '24h', label: '24h' },
  { value: 'all', label: 'All' },
];

export type RapidStateOption = {
  code: string;
  count: number;
};

type RapidFilterBarProps = {
  filters: RapidFilters;
  states: readonly RapidStateOption[];
  onChange: <Key extends keyof RapidFilters>(key: Key, value: RapidFilters[Key]) => void;
  onClear: () => void;
  hasFilters: boolean;
  status: RapidFeedRequestState;
  alertCount: number;
  filteredCount: number;
};

export function RapidFilterBar({
  filters,
  states,
  onChange,
  onClear,
  hasFilters,
  status,
  alertCount,
  filteredCount,
}: RapidFilterBarProps) {
  return (
    <section
      aria-label="Filter community reports"
      className="border border-border bg-surface-card p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          Map + feed filters
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {status === 'loading' && alertCount === 0
              ? 'Connecting'
              : `${filteredCount}/${alertCount} reports`}
          </span>
          {hasFilters ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex min-h-8 items-center gap-1 border border-border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-3" aria-hidden="true" />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative mt-1.5">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <label htmlFor="ice-rapid-search" className="sr-only">
          Search community alerts
        </label>
        <input
          id="ice-rapid-search"
          type="search"
          value={filters.query}
          onChange={(event) => onChange('query', event.target.value)}
          placeholder="City, status, or report"
          className="min-h-9 w-full border border-border bg-background py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        />
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <label htmlFor="ice-rapid-kind" className="sr-only">
            Filter by report type
          </label>
          <select
            id="ice-rapid-kind"
            value={filters.kind}
            onChange={(event) => onChange('kind', event.target.value as RapidKindFilter)}
            className="min-h-8 w-full border border-border bg-background px-2 py-1 text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ice-rapid-status" className="sr-only">
            Filter by source status
          </label>
          <select
            id="ice-rapid-status"
            value={filters.status}
            onChange={(event) =>
              onChange('status', event.target.value as RapidStatusFilter)
            }
            className="min-h-8 w-full border border-border bg-background px-2 py-1 text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="ice-rapid-state" className="sr-only">
            Filter by state
          </label>
          <select
            id="ice-rapid-state"
            value={filters.stateCode}
            onChange={(event) => onChange('stateCode', event.target.value)}
            className="min-h-8 w-full border border-border bg-background px-2 py-1 text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <option value="">All states</option>
            {states.map((state) => (
              <option key={state.code} value={state.code}>
                {state.code} ({state.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="mt-1.5 inline-flex w-full border border-border"
        role="group"
        aria-label="Filter by time window"
      >
        {TIME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filters.time === option.value}
            onClick={() => onChange('time', option.value)}
            className={`inline-flex min-h-8 flex-1 items-center justify-center border-r border-border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.07em] transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
              filters.time === option.value
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground">
        Filters are saved in this page URL for bookmarking and sharing. They never
        include device location.
      </p>
    </section>
  );
}
