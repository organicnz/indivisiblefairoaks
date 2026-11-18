'use client';

import {
  Compass,
  Globe2,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Search,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { isUsPoint } from '@/lib/geo/us-boundary';
import { fetchWithTimeout } from '@/lib/service-fetch';
import { APPROXIMATE_TIMEOUT_MS, GEO_ENDPOINT, NOMINATIM_SEARCH_URL } from './constants';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import {
  approximateCoordinates,
  cityFromAddress,
  requestLocate,
  readBrowserPosition,
  stateCodeFromAddress,
  stateLabel,
  statusForReason,
  type LocateResponse,
  type NominatimPlace,
  type PickerStatus,
} from './source-report-location';
import {
  cleanIceSourceReportCityName,
  iceSourceReportFilterParams,
  type IceSourceReportFilters,
} from '@/lib/ice-source-report-search';

export function SourceReportLocationPicker({
  filters,
  total,
}: {
  filters: IceSourceReportFilters;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [place, setPlace] = useState(
    filters.city
      ? `${cleanIceSourceReportCityName(filters.city)}${filters.stateCode ? `, ${filters.stateCode}` : ''}`
      : ''
  );
  const [status, setStatus] = useState<PickerStatus>({ kind: 'idle' });
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setPlace(
      filters.city
        ? `${cleanIceSourceReportCityName(filters.city)}${filters.stateCode ? `, ${filters.stateCode}` : ''}`
        : ''
    );
    setStatus({ kind: 'idle' });
  }, [filters.city, filters.stateCode]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const beginRequest = () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    return controller;
  };

  const finishRequest = (controller: AbortController) => {
    if (requestRef.current === controller) requestRef.current = null;
  };

  const navigateTo = (next: { city: string; stateCode: string }) => {
    const params = iceSourceReportFilterParams({ ...filters, ...next });
    params.delete('page');
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const useLocatedPlace = (located: LocateResponse) => {
    if (!located.available) {
      setStatus({ kind: 'message', tone: 'error', text: statusForReason(located.reason) });
      return false;
    }

    const distance =
      located.distanceMiles === null
        ? null
        : `${located.distanceMiles.toLocaleString('en-US')} mi`;
    const placeLabel = `${cleanIceSourceReportCityName(located.city)}, ${located.stateCode}`;
    const message = located.exact
      ? `Showing reports in ${placeLabel}.`
      : distance
        ? `Showing reports near ${placeLabel} (${distance} away).`
        : `Showing reports near ${placeLabel}.`;

    navigateTo({ city: located.city, stateCode: located.stateCode });
    setStatus({ kind: 'message', tone: 'success', text: message });
    return true;
  };

  const handleNearMe = async () => {
    const controller = beginRequest();
    const { signal } = controller;
    setStatus({ kind: 'locating' });

    try {
      let coordinates: { lat: number; lng: number } | null = null;

      try {
        coordinates = await readBrowserPosition(signal);
        if (!isUsPoint(coordinates.lat, coordinates.lng)) {
          setStatus({
            kind: 'message',
            tone: 'error',
            text: 'Your location appears outside the U.S. Search a U.S. city or ZIP instead.',
          });
          return;
        }
      } catch {
        if (signal.aborted) return;
      }

      if (!coordinates) {
        try {
          const response = await fetchWithTimeout(
            GEO_ENDPOINT,
            {
              cache: 'no-store',
              headers: { Accept: 'application/json' },
              signal,
            },
            APPROXIMATE_TIMEOUT_MS
          );
          if (response.ok) {
            coordinates = approximateCoordinates(await response.json());
          }
        } catch {
          if (signal.aborted) return;
        }
      }

      if (!coordinates) {
        setStatus({
          kind: 'message',
          tone: 'error',
          text: 'Location is unavailable. Search a city or ZIP instead.',
        });
        return;
      }

      const located = await requestLocate(coordinates.lat, coordinates.lng, {}, signal);
      if (signal.aborted) return;
      useLocatedPlace(located);
    } catch {
      if (!signal.aborted) {
        setStatus({
          kind: 'message',
          tone: 'error',
          text: 'Location lookup is temporarily unavailable. Search a city or ZIP instead.',
        });
      }
    } finally {
      finishRequest(controller);
    }
  };

  const handlePlaceSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = place.trim();
    if (query.length < 3) {
      setStatus({
        kind: 'message',
        tone: 'error',
        text: 'Enter at least three characters, such as a city, ZIP, or address.',
      });
      return;
    }

    const controller = beginRequest();
    const { signal } = controller;
    setStatus({ kind: 'searching' });

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        // Match the app's U.S. boundary, which includes Puerto Rico and the
        // other inhabited territories as well as the fifty states and DC.
        countrycodes: 'us,pr,gu,vi,as,mp',
        limit: '1',
        addressdetails: '1',
        'accept-language': 'en',
      });
      const response = await fetchWithTimeout(
        `${NOMINATIM_SEARCH_URL}?${params.toString()}`,
        {
          signal,
          headers: { Accept: 'application/json' },
        },
        10_000
      );
      if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);

      const payload: unknown = await response.json();
      if (signal.aborted) return;

      const first =
        Array.isArray(payload) && payload.length > 0
          ? (payload[0] as NominatimPlace)
          : undefined;
      const lat = Number(first?.lat);
      const lng = Number(first?.lon);
      if (
        !first ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        !isUsPoint(lat, lng)
      ) {
        setStatus({
          kind: 'message',
          tone: 'error',
          text: 'No U.S. place found. Try a city and state, a ZIP code, or a full address.',
        });
        return;
      }

      const stateCode = stateCodeFromAddress(first.address);
      const cityHint = cityFromAddress(first.address);

      // A state name or a ZIP that resolves only to a state should keep the
      // full state's reports rather than arbitrarily centering on one city.
      if (!cityHint && stateCode) {
        navigateTo({ city: '', stateCode });
        setStatus({
          kind: 'message',
          tone: 'success',
          text: `Showing statewide reports for ${stateLabel(stateCode)}.`,
        });
        return;
      }

      const located = await requestLocate(
        lat,
        lng,
        { city: cityHint, stateCode },
        signal
      );
      if (signal.aborted) return;
      useLocatedPlace(located);
    } catch {
      if (!signal.aborted) {
        setStatus({
          kind: 'message',
          tone: 'error',
          text: 'Place search is temporarily unavailable. Try a city and state, or browse nationwide.',
        });
      }
    } finally {
      finishRequest(controller);
    }
  };

  const handleNationwide = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    if (!filters.city && !filters.stateCode) {
      setStatus({ kind: 'idle' });
      return;
    }
    setStatus({ kind: 'idle' });
    navigateTo({ city: '', stateCode: '' });
  };

  const busy = status.kind === 'locating' || status.kind === 'searching' || isPending;
  const currentArea = filters.city
    ? `${cleanIceSourceReportCityName(filters.city)}${filters.stateCode ? `, ${filters.stateCode}` : ''}`
    : filters.stateCode
      ? stateLabel(filters.stateCode)
      : 'Nationwide';
  const totalLabel = `${total.toLocaleString('en-US')} ${total === 1 ? 'report' : 'reports'}`;

  const statusText = isPending
    ? 'Updating reports…'
    : status.kind === 'locating'
      ? 'Finding your area…'
      : status.kind === 'searching'
        ? 'Looking up that place…'
        : status.kind === 'message'
          ? status.text
          : filters.city
            ? `Showing reports tagged ${currentArea}.`
            : filters.stateCode
              ? `Showing reports across ${currentArea}.`
              : 'Showing the full national archive.';

  return (
    <section
      aria-labelledby="source-report-coverage-title"
      aria-busy={busy}
      className="mt-6 border border-border bg-surface-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
        <div>
          <p className="civic-section-index inline-flex items-center gap-1.5">
            <Compass className="size-3.5" aria-hidden="true" />
            Coverage
          </p>
          <h2
            id="source-report-coverage-title"
            className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]"
          >
            Nationwide or near you.
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Start with every source report, or narrow the archive to the nearest city with
            collected reports. Location stays city-level.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
          <MapPin className="size-3" aria-hidden="true" />
          {currentArea} · {totalLabel}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div
            className="inline-flex shrink-0 border border-border"
            role="group"
            aria-label="Report coverage"
          >
            <button
              type="button"
              aria-pressed={!filters.city && !filters.stateCode}
              onClick={handleNationwide}
              disabled={busy}
              className={`inline-flex min-h-11 items-center gap-1.5 border-r border-border px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                !filters.city && !filters.stateCode
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              <Globe2 className="size-3.5" aria-hidden="true" />
              Nationwide
            </button>
            <button
              type="button"
              aria-pressed={Boolean(filters.city)}
              onClick={handleNearMe}
              disabled={busy}
              className={`inline-flex min-h-11 items-center gap-1.5 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                filters.city
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              <LocateFixed className="size-3.5" aria-hidden="true" />
              Near me
            </button>
          </div>

          <form
            role="search"
            aria-label="Find source reports for a U.S. place"
            onSubmit={handlePlaceSearch}
            className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"
          >
            <div className="min-w-0 flex-1">
              <label
                htmlFor="source-report-place"
                className="block font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground"
              >
                City, ZIP, or address
              </label>
              <input
                id="source-report-place"
                name="place"
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                value={place}
                onChange={(event) => {
                  setPlace(event.target.value);
                  if (status.kind === 'message') setStatus({ kind: 'idle' });
                }}
                placeholder="Sacramento, CA or 95814"
                className="mt-1 min-h-11 w-full border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-border bg-background px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 sm:mb-0"
            >
              <Search className="size-3.5" aria-hidden="true" />
              Find area
            </button>
          </form>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={`mt-3 flex items-start gap-2 border-t border-border pt-3 text-[11px] leading-relaxed ${
            status.kind === 'message' && status.tone === 'error'
              ? 'text-accent'
              : 'text-muted-foreground'
          }`}
        >
          {busy ? (
            <LoaderCircle className="mt-0.5 size-3.5 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <Compass className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{statusText}</span>
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Location is requested only when you choose Near me. Place text is sent to{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-2 hover:text-foreground"
          >
            OpenStreetMap
          </a>
          ; report text never leaves this site.
        </p>
      </div>
    </section>
  );
}
