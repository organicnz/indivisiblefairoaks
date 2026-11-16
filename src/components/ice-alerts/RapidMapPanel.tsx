import {
  CalendarDays,
  Clock3,
  ExternalLink,
  Globe2,
  Info,
  Layers3,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { FormEvent, RefObject } from 'react';
import { Button } from '@/components/ui/Button';
import { formatNumber } from './data';
import type {
  RapidAlert,
  RapidFeedRequestState,
  RapidFeedSource,
  RapidMapPoint,
} from './rapid-types';
import {
  formatRelativeTime,
  formatUpdateTime,
  isAlertActive,
  KIND_LABELS,
  STATUS_LABELS,
} from './rapid-alert-utils';
import { rapidMapHelpText } from './use-rapid-map';
import type { LocationSearchState, MapView, UserLocation, UserLocationStatus } from './types';

type RapidMapPanelProps = {
  mapContainerRef: RefObject<HTMLDivElement | null>;
  mapView: MapView;
  isReady: boolean;
  points: RapidMapPoint[];
  filteredCount: number;
  activeCount: number;
  community: RapidFeedSource | null;
  requestStatus: RapidFeedRequestState;
  now: number;
  selectedAlert: RapidAlert | null;
  onClearSelected: () => void;
  onZoom: (direction: 'in' | 'out') => void;
  onReset: () => void;
  onLocate: () => void;
  userLocation: UserLocation | null;
  userLocationStatus: UserLocationStatus;
  locationNotice: string | null;
  locationInput: string;
  locationSearch: LocationSearchState;
  isLocationSearching: boolean;
  onLocationInputChange: (value: string) => void;
  onLocationSearch: (event: FormEvent<HTMLFormElement>) => void;
  showHistorical: boolean;
  onToggleHistorical: () => void;
};

const VIEW_HEADINGS: Record<MapView, string> = {
  nationwide: 'U.S. overview',
  local: 'Your area',
  free: 'Custom U.S. view',
};

export function RapidMapPanel({
  mapContainerRef,
  mapView,
  isReady,
  points,
  filteredCount,
  activeCount,
  community,
  requestStatus,
  now,
  selectedAlert,
  onClearSelected,
  onZoom,
  onReset,
  onLocate,
  userLocation,
  userLocationStatus,
  locationNotice,
  locationInput,
  locationSearch,
  isLocationSearching,
  onLocationInputChange,
  onLocationSearch,
  showHistorical,
  onToggleHistorical,
}: RapidMapPanelProps) {
  const isLocating =
    userLocationStatus === 'checking' || userLocationStatus === 'locating';
  const cityCount = points.length;
  const selectedActive = selectedAlert ? isAlertActive(selectedAlert, now) : false;
  const feedLoading = requestStatus === 'loading' && !community;
  const feedUnavailable = !community && !feedLoading;
  const feedStatusLabel = feedLoading
    ? 'Connecting to feed'
    : feedUnavailable
      ? 'Community feed unavailable'
      : community?.status === 'ok'
        ? 'Community feed current'
        : community?.status === 'stale'
          ? 'Community feed delayed'
          : 'Community feed unavailable';
  const feedStatusClass = feedLoading
    ? 'border-border bg-surface-muted text-muted-foreground'
    : community?.status === 'ok'
      ? 'border-primary/35 bg-primary/10 text-primary dark:text-primary-on-dark'
      : community?.status === 'stale'
        ? 'border-accent-gold/60 bg-accent-gold/15 text-foreground'
        : 'border-accent/40 bg-accent/10 text-accent';
  const feedDotClass = feedLoading
    ? 'bg-muted-foreground/50'
    : community?.status === 'ok'
      ? 'bg-primary'
      : community?.status === 'stale'
        ? 'bg-accent-gold'
        : 'bg-accent';

  return (
    <div
      id="ice-rapid-map-panel"
      className="min-w-0 scroll-mt-28"
    >
      <div className="overflow-hidden border border-border bg-surface-card">
        <div className="border-b border-border p-3 sm:p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="civic-section-index inline-flex items-center gap-1.5">
                <Layers3 className="size-3.5" aria-hidden="true" />
                National rapid-response map
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <h2 className="font-display text-xl font-semibold leading-tight tracking-[-0.035em] sm:text-2xl">
                  {VIEW_HEADINGS[mapView]}
                </h2>
                <p className="max-w-xl text-[10px] leading-relaxed text-muted-foreground">
                  Pulsing = report under 4h. Pins are city centroids; the community export is
                  nightly.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 text-right">
              <span
                className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.11em] ${feedStatusClass}`}
              >
                <span
                  className={`size-1.5 rounded-full ${feedDotClass}`}
                  aria-hidden="true"
                />
                {feedStatusLabel}
              </span>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {formatNumber(filteredCount)} reports · {formatNumber(cityCount)} cities
              </p>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <div
              className="inline-flex border border-border"
              role="group"
              aria-label="Map coverage"
            >
              <button
                type="button"
                aria-pressed={mapView === 'nationwide'}
                onClick={onReset}
                className={`inline-flex min-h-8 items-center gap-1.5 border-r border-border px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                  mapView === 'nationwide'
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                }`}
              >
                <Globe2 className="size-3.5" aria-hidden="true" />
                U.S. overview
              </button>
              <button
                type="button"
                aria-pressed={mapView === 'local' && Boolean(userLocation)}
                onClick={onLocate}
                disabled={!userLocation || isLocating}
                title={
                  userLocation
                    ? `Center on ${userLocation.label}`
                    : 'An approximate area is not available yet'
                }
                className={`inline-flex min-h-8 items-center gap-1.5 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${
                  mapView === 'local' && userLocation
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                }`}
              >
                {isLocating ? (
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <LocateFixed className="size-3.5" aria-hidden="true" />
                )}
                {isLocating ? 'Locating' : 'Near me'}
              </button>
            </div>

            <button
              type="button"
              aria-pressed={showHistorical}
              onClick={onToggleHistorical}
              className={`inline-flex min-h-8 items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                showHistorical
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
              }`}
            >
              <Layers3 className="size-3.5" aria-hidden="true" />
              FOIA context
            </button>

            <span
              className="font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground"
              aria-live="polite"
            >
              {community?.checkedAt
                ? `Feed synced ${formatUpdateTime(community.checkedAt)}`
                : 'Connecting to feed'}
            </span>
          </div>

          {userLocation || locationNotice ? (
            <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              {locationNotice ??
                (userLocation?.precision === 'precise'
                  ? 'Using your device location to center the map. It is never added to a report or a shared URL.'
                  : `Approximate area: ${userLocation?.label}. Used only to center the map.`)}
            </p>
          ) : null}
        </div>

        <div className="relative isolate">
          <div
            ref={mapContainerRef}
            role="region"
            aria-label="Interactive national ICE rapid-response map"
            aria-describedby="ice-rapid-map-help"
            className="h-[clamp(30rem,68vh,52rem)] w-full"
          />
          <p id="ice-rapid-map-help" className="sr-only">
            {rapidMapHelpText(filteredCount, cityCount)} Use the plus and minus buttons to zoom,
            U.S. overview to reset, and Near me to center on your approximate area. Pins are
            keyboard accessible; select a pin for details.
          </p>

          <div className="pointer-events-none absolute inset-0 z-[900]">
            <div className="pointer-events-auto absolute right-3 top-3 flex flex-col border border-border bg-background/95">
              <button
                type="button"
                onClick={() => onZoom('in')}
                aria-label="Zoom in"
                className="flex size-10 items-center justify-center text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onZoom('out')}
                aria-label="Zoom out"
                className="flex size-10 items-center justify-center border-y border-border text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onReset}
                aria-label="Reset map to the U.S. overview"
                className="flex size-10 items-center justify-center text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <LocateFixed className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="pointer-events-auto absolute left-3 top-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 border border-border bg-background/95 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground">
                <span
                  className={`size-1.5 rounded-full ${activeCount > 0 && !feedLoading ? 'bg-accent ice-live-dot' : 'bg-muted-foreground/50'}`}
                  aria-hidden="true"
                />
                {feedLoading
                  ? 'Connecting'
                  : activeCount > 0
                    ? `${activeCount} active`
                    : 'No active reports'}
              </span>
              {showHistorical ? (
                <span className="inline-flex items-center gap-1.5 border border-border bg-background/95 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                  FOIA city totals on
                </span>
              ) : null}
            </div>

            {!isReady ? (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-muted/50">
                <span className="inline-flex items-center gap-2 border border-border bg-background px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                  Initializing map
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <form
          role="search"
          aria-label="Find a U.S. location on the rapid-response map"
          aria-busy={isLocationSearching}
          onSubmit={onLocationSearch}
          className="border-t border-border px-4 py-3 sm:px-5"
        >
          <label
            htmlFor="ice-rapid-location"
            className="block font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground"
          >
            Find a U.S. city or address
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              id="ice-rapid-location"
              name="location"
              type="search"
              required
              minLength={3}
              autoComplete="off"
              enterKeyHint="search"
              value={locationInput}
              onChange={(event) => onLocationInputChange(event.target.value)}
              placeholder="City and state, ZIP, or street address"
              aria-describedby="ice-rapid-location-help ice-rapid-location-status"
              className="min-h-11 min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            />
            <Button type="submit" disabled={isLocationSearching} className="w-full sm:w-auto">
              <Search className="size-4" aria-hidden="true" />
              {isLocationSearching ? 'Searching…' : 'Search'}
            </Button>
          </div>
          <p
            id="ice-rapid-location-help"
            className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground"
          >
            Search moves the map only. It never creates or changes a report. Search text is sent to{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="font-semibold underline underline-offset-2 hover:text-foreground"
            >
              OpenStreetMap
            </a>
            .
          </p>
          <div
            id="ice-rapid-location-status"
            role="status"
            aria-live="polite"
            className={`mt-1.5 text-[10px] leading-relaxed ${
              locationSearch.kind === 'empty' || locationSearch.kind === 'error'
                ? 'text-accent'
                : 'text-muted-foreground'
            }`}
          >
            {locationSearch.kind === 'searching' ? 'Searching U.S. locations…' : null}
            {locationSearch.kind === 'found' ? (
              <>
                Moved map to{' '}
                <strong className="font-semibold text-foreground">{locationSearch.label}</strong>.
              </>
            ) : null}
            {locationSearch.kind === 'empty'
              ? 'No U.S. location found. Try a city and state, a ZIP code, or a full address.'
              : null}
            {locationSearch.kind === 'error'
              ? 'Location search is temporarily unavailable. Try again or pan the map.'
              : null}
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-surface-muted px-4 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:px-5">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-accent bg-accent/25 ice-live-dot" aria-hidden="true" />
            Active &lt;4h
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-accent bg-accent" aria-hidden="true" />
            Source-confirmed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-accent-gold bg-accent-gold" aria-hidden="true" />
            Sighting
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-border bg-muted-foreground/40" aria-hidden="true" />
            Earlier
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 normal-case tracking-normal">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            City-level locations only
          </span>
        </div>

        <div className="border-t border-border bg-surface-card p-4 sm:p-5" aria-live="polite">
          {selectedAlert ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${
                    selectedAlert.status === 'source-confirmed'
                      ? 'border-accent/45 bg-accent/10 text-accent'
                      : 'border-accent-gold/60 bg-accent-gold/15 text-foreground'
                  }`}
                >
                  <ShieldCheck className="size-3" aria-hidden="true" />
                  {STATUS_LABELS[selectedAlert.status]}
                </span>
                <span className="border border-border bg-background px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {KIND_LABELS[selectedAlert.kind]}
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${
                    selectedActive ? 'text-accent' : 'text-muted-foreground'
                  }`}
                >
                  <Clock3 className="size-3" aria-hidden="true" />
                  {formatRelativeTime(selectedAlert.observedAt, now)}
                </span>
                <button
                  type="button"
                  onClick={onClearSelected}
                  aria-label="Clear selected alert"
                  className="ml-auto flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>

              <h3 className="mt-2 font-display text-2xl font-semibold leading-tight tracking-[-0.03em] sm:text-3xl">
                {selectedAlert.place}
              </h3>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {selectedAlert.summary}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3" aria-hidden="true" />
                  City centroid, not a street address
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3" aria-hidden="true" />
                  {new Intl.DateTimeFormat('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(new Date(selectedAlert.observedAt))}
                </span>
                <a
                  href={selectedAlert.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Opens the original network in a new tab; it may show more detail."
                  className="ml-auto inline-flex min-h-8 items-center gap-1.5 border border-border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Source report
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Select a pin or a feed item.
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                  The detail view shows the city, source status, and time. It never reveals a street
                  address, plate, name, or immigration status.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
