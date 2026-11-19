'use client';

import {
  AlertTriangle,
  ChevronRight,
  Clock3,
  ExternalLink,
  Landmark,
  LoaderCircle,
  MapPin,
  Radio,
  RefreshCw,
  SearchX,
  ShieldCheck,
} from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import type {
  OfficialRelease,
  RapidAlert,
  RapidFeedRequestState,
  RapidFeedSource,
} from './rapid-types';
import {
  formatRelativeTime,
  formatShortDate,
  isAlertActive,
  KIND_LABELS,
  STATUS_LABELS,
} from './rapid-alert-utils';
import { communityMemo } from './rapid-community-memo';

type RapidAlertFeedProps = {
  alerts: RapidAlert[];
  allAlerts: RapidAlert[];
  newIds: ReadonlySet<string>;
  officialReleases: OfficialRelease[];
  community: RapidFeedSource | null;
  official: RapidFeedSource | null;
  selectedId: string | null;
  now: number;
  status: RapidFeedRequestState;
  error: string | null;
  isRefreshing: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onClearFilters: () => void;
  hasFilters: boolean;
  /** Hide the duplicate historical link when the page-level error banner owns it. */
  showHistoricalLink?: boolean;
};

type FeedTab = 'community' | 'official';

const FEED_TABS: readonly FeedTab[] = ['community', 'official'];
const EMPTY_ACTION_CLASS =
  'inline-flex min-h-9 items-center justify-center gap-1.5 border border-border px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60';

function CommunityCard({
  alert,
  selected,
  isNew,
  now,
  onSelect,
}: {
  alert: RapidAlert;
  selected: boolean;
  isNew: boolean;
  now: number;
  onSelect: (id: string) => void;
}) {
  const active = isAlertActive(alert, now);
  const confirmed = alert.status === 'source-confirmed';

  return (
    <article
      className={`border-b border-border last:border-b-0 ${
        selected ? 'border-l-2 border-l-accent bg-accent/[0.045]' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(alert.id)}
        aria-pressed={selected}
        className="block w-full px-4 py-3.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] ${
              confirmed
                ? 'border-accent/45 bg-accent/10 text-accent'
                : 'border-accent-gold/60 bg-accent-gold/15 text-foreground'
            }`}
          >
            {confirmed ? (
              <ShieldCheck className="size-2.5" aria-hidden="true" />
            ) : (
              <Radio className="size-2.5" aria-hidden="true" />
            )}
            {STATUS_LABELS[alert.status]}
          </span>
          <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {KIND_LABELS[alert.kind]}
          </span>
          {isNew ? (
            <span className="border border-accent/45 bg-accent/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-accent">
              New
            </span>
          ) : null}
          <span
            className={`ml-auto inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${
              active ? 'text-accent' : 'text-muted-foreground'
            }`}
          >
            {active ? (
              <span className="size-1.5 rounded-full bg-accent ice-live-dot" aria-hidden="true" />
            ) : (
              <Clock3 className="size-2.5" aria-hidden="true" />
            )}
            {formatRelativeTime(alert.observedAt, now)}
          </span>
        </span>

        <span className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold leading-tight tracking-[-0.025em]">
            {alert.place}
          </span>
          {!active ? (
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              <DataPoint as="span" name="ice.feed.card.earlier">
                Earlier
              </DataPoint>
            </span>
          ) : null}
        </span>

        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {communityMemo(alert)}
        </span>

        <span className="mt-2 flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
          <MapPin className="size-2.5" aria-hidden="true" />
          <DataPoint as="span" name="ice.feed.card.location">
            City-level location
          </DataPoint>
          <ChevronRight className="ml-auto size-3.5 text-foreground" aria-hidden="true" />
        </span>
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-2">
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Source: {alert.sourceName}
        </span>
        <a
          href={alert.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Opens the original network in a new tab; it may show more detail."
          className="inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <DataPoint as="span" name="ice.feed.card.source_link">
            Source report
          </DataPoint>
          <ExternalLink className="size-2.5" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

function OfficialCard({ release }: { release: OfficialRelease }) {
  return (
    <article className="border-b border-border p-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 border border-primary/35 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-primary dark:text-primary-on-dark">
          <Landmark className="size-2.5" aria-hidden="true" />
          <DataPoint as="span" name="ice.feed.official.badge">
            Official ICE release
          </DataPoint>
        </span>
        <span className="ml-auto font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {formatShortDate(release.publishedAt)}
        </span>
      </div>
      <h3 className="mt-2 font-display text-lg font-semibold leading-tight tracking-[-0.02em]">
        {release.title}
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{release.summary}</p>
      <a
        href={release.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-8 items-center gap-1.5 border border-border px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <DataPoint as="span" name="ice.feed.official.link">
          Read the official release
        </DataPoint>
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>
    </article>
  );
}

function LoadingCards() {
  return (
    <div aria-label="Loading alert feed" role="status" className="divide-y divide-border">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="p-4">
          <div className="h-2.5 w-28 animate-pulse bg-surface-muted" />
          <div className="mt-3 h-5 w-2/3 animate-pulse bg-surface-muted" />
          <div className="mt-2 h-2.5 w-full animate-pulse bg-surface-muted" />
          <div className="mt-1.5 h-2.5 w-4/5 animate-pulse bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

export function RapidAlertFeed({
  alerts,
  allAlerts,
  newIds,
  officialReleases,
  community,
  official,
  selectedId,
  now,
  status,
  error,
  isRefreshing,
  onSelect,
  onRefresh,
  onClearFilters,
  hasFilters,
  showHistoricalLink = true,
}: RapidAlertFeedProps) {
  const [tab, setTab] = useState<FeedTab>('community');
  const tabRefs = useRef<Record<FeedTab, HTMLButtonElement | null>>({
    community: null,
    official: null,
  });
  const source = tab === 'community' ? community : official;
  const shownCount = tab === 'community' ? alerts.length : officialReleases.length;
  const communityUnavailable =
    community?.status === 'unavailable' || (!community && status !== 'loading');

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const { key } = event;
    if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') {
      return;
    }

    event.preventDefault();
    const currentIndex = FEED_TABS.indexOf(tab);
    const nextIndex =
      key === 'Home'
        ? 0
        : key === 'End'
          ? FEED_TABS.length - 1
          : (currentIndex + (key === 'ArrowRight' ? 1 : -1) + FEED_TABS.length) %
            FEED_TABS.length;
    const nextTab = FEED_TABS[nextIndex];
    if (!nextTab) return;

    setTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return (
    <section
      id="ice-alert-feed"
      aria-labelledby="ice-feed-title"
      tabIndex={-1}
      className="min-w-0 scroll-mt-28 border border-border bg-surface-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="civic-section-index">
              <DataPoint name="ice.feed.eyebrow">Community + official feed</DataPoint>
            </p>
            <DataPoint
              as="h2"
              id="ice-feed-title"
              name="ice.feed.title"
              className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.035em] sm:text-3xl"
            >
              Recent reports
            </DataPoint>
          </div>
          <div className="flex items-center gap-2">
            <span className="civic-stamp">{shownCount} shown</span>
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh the alert feed"
              className="flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <RefreshCw
                className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <div
          className="mt-3 flex border border-border"
          role="tablist"
          aria-label="Alert feed source"
          aria-orientation="horizontal"
        >
          <button
            ref={(node) => {
              tabRefs.current.community = node;
            }}
            type="button"
            role="tab"
            id="ice-community-tab"
            aria-selected={tab === 'community'}
            aria-controls="ice-community-panel"
            tabIndex={tab === 'community' ? 0 : -1}
            onClick={() => setTab('community')}
            onKeyDown={handleTabKeyDown}
            className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
              tab === 'community'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
            }`}
          >
            <Radio className="size-3" aria-hidden="true" />
            Community
            <span className={tab === 'community' ? 'text-background/70' : 'text-muted-foreground'}>
              {allAlerts.length}
            </span>
          </button>
          <button
            ref={(node) => {
              tabRefs.current.official = node;
            }}
            type="button"
            role="tab"
            id="ice-official-tab"
            aria-selected={tab === 'official'}
            aria-controls="ice-official-panel"
            tabIndex={tab === 'official' ? 0 : -1}
            onClick={() => setTab('official')}
            onKeyDown={handleTabKeyDown}
            className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 border-l border-border px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
              tab === 'official'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
            }`}
          >
            <Landmark className="size-3" aria-hidden="true" />
            Official
            <span className={tab === 'official' ? 'text-background/70' : 'text-muted-foreground'}>
              {officialReleases.length}
            </span>
          </button>
        </div>

        {source ? (
          <p
            className={`mt-2.5 text-[10px] leading-relaxed ${
              source.status === 'stale' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <span
              className={`mr-1.5 inline-block size-1.5 rounded-full ${
                source.status === 'ok'
                  ? 'bg-primary'
                  : source.status === 'stale'
                    ? 'bg-accent-gold'
                    : 'bg-accent'
              }`}
              aria-hidden="true"
            />
            {source.note}
          </p>
        ) : null}

        {error ? (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 border border-accent/40 bg-accent/10 p-2.5 text-[10px] leading-relaxed text-foreground"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
            <span>
              Live refresh failed{status === 'error' ? '' : '; showing the last successful feed'}.
              {' '}
              {error}
            </span>
          </div>
        ) : null}
      </div>

      <div
        id="ice-community-panel"
        role="tabpanel"
        aria-labelledby="ice-community-tab"
        hidden={tab !== 'community'}
        className="max-h-[36rem] overflow-y-auto overscroll-contain lg:max-h-[46rem]"
      >
        {status === 'loading' && !allAlerts.length ? (
          <LoadingCards />
        ) : allAlerts.length === 0 ? (
          <div className="p-6 text-center">
            {communityUnavailable ? (
              <AlertTriangle className="mx-auto size-5 text-accent" aria-hidden="true" />
            ) : (
              <Radio className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            )}
            <p className="mt-3 font-display text-xl font-semibold tracking-[-0.02em]">
              {communityUnavailable
                ? 'The community feed is unavailable.'
                : 'No community reports are listed yet.'}
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {communityUnavailable
                ? 'The public export did not load. This page will not substitute older or invented reports while it recovers.'
                : 'The public export has not returned a report. Check again after its next update; the map will not fill the gap with substitute content.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className={EMPTY_ACTION_CLASS}
              >
                <RefreshCw
                  className={`size-3 ${isRefreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {isRefreshing ? 'Checking feed' : 'Check again'}
              </button>
              {communityUnavailable && showHistoricalLink ? (
                <a href="#historical-foia" className={EMPTY_ACTION_CLASS}>
                  Historical map
                </a>
              ) : null}
            </div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-6 text-center">
            <SearchX className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <DataPoint
              as="p"
              name="ice.feed.empty.community.title"
              className="mt-3 font-display text-xl font-semibold tracking-[-0.02em]"
            >
              No reports match this view.
            </DataPoint>
            <DataPoint
              as="p"
              name="ice.feed.empty.community.body"
              className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground"
            >
              Try a different state, time window, status, or search. The map uses the same
              filters.
            </DataPoint>
            {hasFilters ? (
              <button
                type="button"
                onClick={onClearFilters}
                className={`${EMPTY_ACTION_CLASS} mt-4`}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          alerts.map((alert) => (
            <CommunityCard
              key={alert.id}
              alert={alert}
              selected={alert.id === selectedId}
              isNew={newIds.has(alert.id)}
              now={now}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      <div
        id="ice-official-panel"
        role="tabpanel"
        aria-labelledby="ice-official-tab"
        hidden={tab !== 'official'}
        className="max-h-[36rem] overflow-y-auto overscroll-contain lg:max-h-[46rem]"
      >
        {status === 'loading' && !officialReleases.length ? (
          <LoadingCards />
        ) : officialReleases.length === 0 ? (
          <div className="p-6 text-center">
            <Landmark className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <DataPoint
              as="p"
              name="ice.feed.empty.official.title"
              className="mt-3 font-display text-xl font-semibold tracking-[-0.02em]"
            >
              Official releases are unavailable.
            </DataPoint>
            <DataPoint
              as="p"
              name="ice.feed.empty.official.body"
              className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground"
            >
              The ICE newsroom feed did not return any releases. No replacement content is being
              invented.
            </DataPoint>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`${EMPTY_ACTION_CLASS} mt-4`}
            >
              <RefreshCw
                className={`size-3 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {isRefreshing ? 'Checking feed' : 'Check again'}
            </button>
          </div>
        ) : (
          officialReleases.map((release) => (
            <OfficialCard key={release.id} release={release} />
          ))
        )}
      </div>

      <div className="flex items-start gap-2 border-t border-border bg-surface-muted px-4 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
        <LoaderCircle
          className={`mt-0.5 size-3 shrink-0 ${isRefreshing ? 'animate-spin' : 'opacity-0'}`}
          aria-hidden="true"
        />
        <DataPoint as="span" name="ice.feed.footer">
          This page checks for a new public export every 2 minutes; the community source compiles
          its export nightly. Source links open the original network, which may show more detail,
          including any community comments or updates. Official releases are summarized by topic
          so names and case details are not reproduced; open the release for the agency&apos;s full
          text. They are not live enforcement locations. Source-confirmed means the reporting
          network&apos;s label, not independent verification by this page.
        </DataPoint>
      </div>
    </section>
  );
}
