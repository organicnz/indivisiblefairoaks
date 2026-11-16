import { CalendarDays, Globe2, Layers3, LoaderCircle, LocateFixed, Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { MAP_VIEW_COPY } from './constants';
import { formatDateLabel, formatNumber } from './data';
import type { HeatmapMeta, LocationSearchState, MapView, UserLocation } from './types';

type IceMapToolbarProps = {
  meta: HeatmapMeta;
  mapView: MapView;
  locationInput: string;
  locationSearch: LocationSearchState;
  isLocationSearching: boolean;
  userLocation: UserLocation | null;
  isLocating: boolean;
  locationHeadline: string;
  locationDetail: string;
  onLocationInputChange: (value: string) => void;
  onLocationSearch: (event: FormEvent<HTMLFormElement>) => void;
  onFocusOverview: () => void;
  onFocusUserArea: () => void;
};

export function IceMapToolbar({
  meta,
  mapView,
  locationInput,
  locationSearch,
  isLocationSearching,
  userLocation,
  isLocating,
  locationHeadline,
  locationDetail,
  onLocationInputChange,
  onLocationSearch,
  onFocusOverview,
  onFocusUserArea,
}: IceMapToolbarProps) {
  const mapCopy = MAP_VIEW_COPY[mapView];

  return (
      <div className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="civic-section-index inline-flex items-center gap-1.5">
              <Layers3 className="size-3.5" aria-hidden="true" />
              Historical city map
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.035em] sm:text-3xl">
              {mapCopy.heading}
            </h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              {mapCopy.description}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-right">
            <span className="inline-flex items-center gap-1.5 border border-border bg-surface-muted px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-foreground">
              <CalendarDays className="size-3" aria-hidden="true" />
              Latest release: {formatDateLabel(meta.periodEnd)}
            </span>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Checked {formatDateLabel(meta.releaseCheckedAt)} ·{' '}
              {formatNumber(meta.mappedCities)} city points ·{' '}
              {formatNumber(meta.mappedRecords)} records
            </p>
          </div>
        </div>

        <form
          role="search"
          aria-label="Find a U.S. location on the city map"
          aria-busy={isLocationSearching}
          onSubmit={onLocationSearch}
          className="mt-4 border-t border-border pt-3"
        >
          <label
            htmlFor="ice-map-location"
            className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Find a U.S. city or address
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              id="ice-map-location"
              name="location"
              type="search"
              required
              minLength={3}
              autoComplete="off"
              enterKeyHint="search"
              value={locationInput}
              onChange={(event) => onLocationInputChange(event.target.value)}
              placeholder="City and state, ZIP, or street address"
              aria-describedby="ice-map-location-help ice-map-location-status"
              className="min-h-11 min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            />
            <Button type="submit" disabled={isLocationSearching} className="w-full sm:w-auto">
              <Search className="size-4" aria-hidden="true" />
              {isLocationSearching ? 'Searching…' : 'Search'}
            </Button>
          </div>
          <p
            id="ice-map-location-help"
            className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground"
          >
            Search moves the map only. The address bar holds a view-only link that never
            changes the snapshot. Search text is sent to{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="font-semibold underline underline-offset-2 hover:text-foreground"
            >
              OpenStreetMap
            </a>
            .
          </p>
          <div
            id="ice-map-location-status"
            role="status"
            aria-live="polite"
            className={`mt-2 text-[11px] leading-relaxed ${
              locationSearch.kind === 'empty' || locationSearch.kind === 'error'
                ? 'text-accent'
                : 'text-muted-foreground'
            }`}
          >
            {locationSearch.kind === 'searching' ? 'Searching U.S. locations…' : null}
            {locationSearch.kind === 'found' ? (
              <>
                Moved map to{' '}
                <strong className="font-semibold text-foreground">
                  {locationSearch.label}
                </strong>
                .
              </>
            ) : null}
            {locationSearch.kind === 'empty'
              ? 'No U.S. location found. Try a city and state, a ZIP code, or a full street address.'
              : null}
            {locationSearch.kind === 'error'
              ? 'Location search is temporarily unavailable. Try again or pan the map.'
              : null}
          </div>
        </form>

        <div
          id="ice-location-status"
          className="mt-3 flex items-start gap-2.5 border border-border bg-surface-muted/70 p-2.5"
          role="status"
          aria-live="polite"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center border border-border bg-background text-foreground">
            {isLocating ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LocateFixed className="size-4" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold leading-snug text-foreground">
              {locationHeadline}
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
              {locationDetail}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div
            className="inline-flex border border-border"
            role="group"
            aria-label="Map coverage"
          >
            <button
              type="button"
              aria-pressed={mapView === 'nationwide'}
              onClick={onFocusOverview}
              className={`inline-flex min-h-8 items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${userLocation ? 'border-r border-border ' : ''}${
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
              onClick={onFocusUserArea}
              disabled={!userLocation || isLocating}
              className={`inline-flex min-h-8 items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                mapView === 'local' && userLocation
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              <LocateFixed className="size-3.5" aria-hidden="true" />
              {userLocation ? 'My area' : 'Locate me'}
            </button>
          </div>
          <span
            className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
            aria-live="polite"
          >
            {userLocation
              ? userLocation.precision === 'precise'
                ? 'Device location shown'
                : 'Approximate location shown'
              : mapCopy.status}
          </span>
        </div>
      </div>
  );
}
