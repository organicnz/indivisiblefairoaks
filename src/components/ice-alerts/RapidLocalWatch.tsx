'use client';

import {
  Check,
  CircleDashed,
  Copy,
  LocateFixed,
  Navigation,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatNumber } from './data';
import { buildRapidLocalBrief } from './rapid-local-brief';
import {
  formatLocalMiles,
  nearestRapidPoint,
  rankRapidPointsByDistance,
} from './rapid-local';
import { formatRelativeTime, STATUS_LABELS } from './rapid-alert-utils';
import type {
  RapidFeedRequestState,
  RapidFeedSource,
  RapidMapPoint,
  RapidWatchRadius,
} from './rapid-types';
import type { SearchTarget, UserLocation, UserLocationStatus } from './types';
import { useCopyStatus } from './use-copy-status';

const RADIUS_OPTIONS = [25, 50, 100, 250] as const;

type LocalAnchor = {
  lat: number;
  lng: number;
  label: string;
  kind: 'device' | 'search';
};

type RapidLocalWatchProps = {
  points: RapidMapPoint[];
  community: RapidFeedSource | null;
  feedFromCache: boolean;
  userLocation: UserLocation | null;
  userLocationStatus: UserLocationStatus;
  searchTarget: SearchTarget | null;
  status: RapidFeedRequestState;
  hasFilters: boolean;
  now: number;
  onSelect: (id: string) => void;
  onLocate: () => void;
  onRequestLocation: () => void;
  onClearAnchor: () => void;
  onShowRadius: (radius: RapidWatchRadius) => void;
  locationNotice: string | null;
};

/**
 * A city-centroid local check, not a dispatch feed. The radius and distances
 * are computed in the browser from the user's approximate area or an explicit
 * map search, and every empty result names its radius so it is never presented
 * as an all-clear.
 */
export function RapidLocalWatch({
  points,
  community,
  feedFromCache,
  userLocation,
  userLocationStatus,
  searchTarget,
  status,
  hasFilters,
  now,
  onSelect,
  onLocate,
  onRequestLocation,
  onClearAnchor,
  onShowRadius,
  locationNotice,
}: RapidLocalWatchProps) {
  const { copyState, copy } = useCopyStatus();
  const [radiusMiles, setRadiusMiles] = useState<number>(100);

  const anchor = useMemo<LocalAnchor | null>(() => {
    if (searchTarget) {
      return {
        lat: searchTarget.lat,
        lng: searchTarget.lng,
        label: searchTarget.label,
        kind: 'search',
      };
    }
    if (userLocation) {
      return {
        lat: userLocation.lat,
        lng: userLocation.lng,
        label: userLocation.label,
        kind: 'device',
      };
    }
    return null;
  }, [searchTarget, userLocation]);

  const nearby = useMemo(() => {
    if (!anchor) return [];
    return rankRapidPointsByDistance(
      points,
      anchor.lat,
      anchor.lng,
      radiusMiles
    );
  }, [anchor, points, radiusMiles]);

  const nearest = useMemo(() => {
    if (!anchor || nearby.length > 0) return null;
    return nearestRapidPoint(points, anchor.lat, anchor.lng);
  }, [anchor, nearby.length, points]);

  const isLocating = userLocationStatus === 'locating';
  const isChecking = userLocationStatus === 'checking';

  if (!anchor) {
    return (
      <section
        aria-labelledby="ice-local-watch-title"
        className="border border-border bg-surface-card"
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center border border-accent/40 bg-accent/10">
              <Navigation className="size-3.5 text-accent" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="ice-local-watch-title"
                className="font-display text-lg font-semibold leading-none tracking-[-0.025em]"
              >
                Local watch
              </h2>
              <p className="mt-1 truncate text-[10px] leading-snug text-muted-foreground">
                {isChecking
                  ? 'Checking approximate area'
                  : isLocating
                    ? 'Requesting device location'
                    : 'No area selected'}
              </p>
            </div>
          </div>
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Off
          </span>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Rank current-feed reports by straight-line distance to city centers. Use
            your device location, or search the map for a city to anchor the local
            watch there.
          </p>
          {userLocationStatus === 'unavailable' ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-foreground">
              No approximate or device location is available. Search the map for a city,
              or try device location again.
            </p>
          ) : null}
          {locationNotice ? (
            <p role="status" className="mt-1.5 text-[10px] leading-relaxed text-accent">
              {locationNotice}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onRequestLocation}
            disabled={isLocating}
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 border border-foreground bg-primary px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            <LocateFixed className="size-3.5" aria-hidden="true" />
            {isLocating ? 'Requesting location' : 'Use my location'}
          </button>
          <p className="mt-2 flex items-start gap-1.5 text-[9px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            Your location stays in this browser and is never added to a report or
            shared URL.
          </p>
        </div>
      </section>
    );
  }

  const reportCount = nearby.reduce((sum, point) => sum + point.count, 0);
  const pulseCount = nearby.filter((point) => point.hasActive).length;
  const locationLabel =
    anchor.kind === 'search'
      ? `Around ${anchor.label}`
      : userLocation?.precision === 'precise'
        ? 'Your device location'
        : `Approximate area: ${anchor.label}`;
  const loading = status === 'loading' && points.length === 0;
  const unavailable = status === 'error' && points.length === 0;

  const handleCopy = async () => {
    const brief = buildRapidLocalBrief({
      anchorLabel: anchor.label,
      anchorKind: anchor.kind,
      radiusMiles,
      sourceName: community?.sourceName ?? null,
      reportCount,
      cityCount: nearby.length,
      activeCityCount: pulseCount,
      points: nearby.map((point) => ({
        place: point.place,
        count: point.count,
        distanceMiles: point.distanceMiles,
        latestAt: point.latestAt,
      })),
      nearest: nearest
        ? {
            place: nearest.place,
            count: nearest.count,
            distanceMiles: nearest.distanceMiles,
            latestAt: nearest.latestAt,
          }
        : null,
      feedStatus: community?.status ?? null,
      feedFromCache,
      snapshotCheckedAt: community?.checkedAt ?? null,
      now,
      mapUrl: `${window.location.origin}/ice-alerts`,
    });

    await copy(brief);
  };

  return (
    <section
      aria-labelledby="ice-local-watch-title"
      className="border border-border bg-surface-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center border border-accent/40 bg-accent/10">
            <Navigation className="size-3.5 text-accent" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="ice-local-watch-title"
              className="font-display text-lg font-semibold leading-none tracking-[-0.025em]"
            >
              Local watch
            </h2>
            <p
              className="mt-1 truncate text-[10px] leading-snug text-muted-foreground"
              title={locationLabel}
            >
              {locationLabel}
              {userLocationStatus === 'locating' ? ' · refining location' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
            aria-live="polite"
          >
            {loading
              ? 'Connecting'
              : unavailable
                ? 'Unavailable'
                : `${formatNumber(reportCount)} reports`}
          </span>
          {anchor.kind === 'device' ? (
            <button
              type="button"
              onClick={onLocate}
              className="inline-flex min-h-8 items-center gap-1.5 border border-border px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <LocateFixed className="size-3" aria-hidden="true" />
              Center map
            </button>
          ) : (
            <button
              type="button"
              onClick={onClearAnchor}
              className="inline-flex min-h-8 items-center gap-1.5 border border-border px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Clear the local watch map search"
            >
              <X className="size-3" aria-hidden="true" />
              Clear area
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              Radius
            </span>
            <div
              className="inline-flex border border-border"
              role="group"
              aria-label="Nearby report radius"
            >
              {RADIUS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={radiusMiles === option}
                  onClick={() => setRadiusMiles(option)}
                  className={`inline-flex min-h-8 items-center border-r border-border px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.06em] transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                    radiusMiles === option
                      ? 'bg-primary text-white'
                      : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                  }`}
                >
                  {option} mi
                </button>
              ))}
            </div>
          </div>
          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {formatNumber(nearby.length)} cities
            {pulseCount > 0 ? ` · ${pulseCount} with pulse` : ''}
          </span>
        </div>

        {loading ? (
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            The community feed is still connecting. Nearby reports will appear here when
            it loads.
          </p>
        ) : unavailable ? (
          <p className="mt-2 text-[10px] leading-relaxed text-foreground">
            The community feed did not load, so nearby activity cannot be checked right
            now.
          </p>
        ) : nearby.length === 0 ? (
          <div className="mt-2 border border-accent-gold/60 bg-accent-gold/10 p-2.5">
            <p className="text-[10px] leading-relaxed text-foreground">
              <strong className="font-semibold">
                No current-feed reports within {radiusMiles} miles
                {anchor.kind === 'search' ? ' of this map search.' : '.'}
              </strong>{' '}
              {hasFilters
                ? 'The current filters may be narrowing this view.'
                : 'The community export updates nightly. This is not an all-clear; it only means no report is in this snapshot.'}
            </p>
            {community?.status === 'stale' ? (
              <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
                The community feed is flagged stale, so newer reports may be missing
                from this snapshot.
              </p>
            ) : null}
            {community?.status === 'unavailable' ? (
              <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
                The community feed is marked unavailable; this is the last retained
                snapshot, not a live check.
              </p>
            ) : null}
            {nearest ? (
              <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
                Nearest report in this view: {nearest.place} ·{' '}
                {formatLocalMiles(nearest.distanceMiles)} away.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-border border border-border">
              {nearby.slice(0, 4).map((point) => (
                <li key={point.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(point.latestAlertId)}
                    className="flex w-full items-start justify-between gap-3 bg-background px-2.5 py-2 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {point.hasActive ? (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-accent ice-live-dot"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="truncate font-display text-sm font-semibold leading-tight tracking-[-0.02em]">
                          {point.place}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[9px] leading-snug text-muted-foreground">
                        {point.count} {point.count === 1 ? 'report' : 'reports'} · latest{' '}
                        {formatRelativeTime(point.latestAt, now)} ·{' '}
                        {STATUS_LABELS[point.latestStatus]}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.07em] text-foreground">
                      {formatLocalMiles(point.distanceMiles)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {nearby.length > 4 ? (
              <p className="mt-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                +{nearby.length - 4} more {nearby.length - 4 === 1 ? 'city' : 'cities'} in
                this radius
              </p>
            ) : null}
          </>
        )}

        {community ? (
          <p className="mt-2 font-mono text-[8px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
            {community.checkedAt
              ? `Snapshot checked ${formatRelativeTime(community.checkedAt, now)}`
              : 'Snapshot sync time unavailable'}
            {community.status === 'stale'
              ? ' · stale'
              : community.status === 'unavailable'
                ? ' · unavailable'
                : ''}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <p className="flex min-w-0 flex-1 items-start gap-1.5 text-[9px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            {anchor.kind === 'search'
              ? 'Straight-line distance from the map search point to city centers, not driving directions or street locations.'
              : 'Straight-line distance to city centers, not driving directions or street locations. Your location stays in this browser and is never added to a report or shared URL.'}
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                onShowRadius({
                  lat: anchor.lat,
                  lng: anchor.lng,
                  miles: radiusMiles,
                  label: anchor.label,
                })
              }
              title="Draws a distance guide on the map, not a boundary."
              className="inline-flex min-h-7 items-center gap-1 border border-border bg-background px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <CircleDashed className="size-2.5" aria-hidden="true" />
              Show radius
            </button>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex min-h-7 items-center gap-1 border border-border bg-background px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {copyState === 'copied' ? (
                <Check className="size-2.5 text-accent" aria-hidden="true" />
              ) : (
                <Copy className="size-2.5" aria-hidden="true" />
              )}
              <span aria-live="polite">
                {copyState === 'copied'
                  ? 'Local brief copied'
                  : copyState === 'error'
                    ? 'Copy failed'
                    : 'Copy local brief'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
