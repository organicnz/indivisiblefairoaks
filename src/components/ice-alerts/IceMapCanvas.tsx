import { LocateFixed, Minus, Plus } from 'lucide-react';
import type { RefObject } from 'react';
import { DATA, formatDateLabel, formatNumber } from './data';

type IceMapCanvasProps = {
  mapContainerRef: RefObject<HTMLDivElement | null>;
  onZoom: (direction: 'in' | 'out') => void;
  onReset: () => void;
};

export function IceMapCanvas({ mapContainerRef, onZoom, onReset }: IceMapCanvasProps) {
  return (
    <div className="relative">
      <div
        ref={mapContainerRef}
        role="region"
        aria-label="Interactive historical map of ICE arrests by city"
        aria-describedby="ice-map-help"
        className="h-[clamp(19.5rem,43vh,31rem)] w-full"
      />
      <p id="ice-map-help" className="sr-only">
        A clustered city map of {formatNumber(DATA.meta.mappedRecords)} de-duplicated ICE
        arrest records assigned to {formatNumber(DATA.meta.mappedCities)} U.S. cities
        from October 2022 through {formatDateLabel(DATA.meta.periodEnd)} (latest available
        release, checked {formatDateLabel(DATA.meta.releaseCheckedAt)}). Numbers group nearby
        cities and show combined records; zoom in for individual city circles. Open a city
        dot or cluster popup for its count and context action. City coordinates are Census
        place points, not exact arrest locations. Use the city list beside the map for
        accessible counts. This is historical data, not a live feed.
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

        <div className="absolute bottom-3 left-3 max-w-[calc(100%-5rem)] border border-border bg-background/95 p-2.5">
          <div className="flex items-end gap-2" aria-hidden="true">
            {[6, 14, 24].map((size) => (
              <span
                key={size}
                className="inline-block rounded-full"
                style={{
                  width: size,
                  height: size,
                  border: '1px solid #64120d',
                  backgroundColor: 'rgba(180, 35, 24, 0.48)',
                }}
              />
            ))}
          </div>
          <p className="mt-1.5 max-w-56 text-[10px] leading-snug text-muted-foreground">
            Numbers group nearby cities. Larger circle = more records; zoom in for individual
            city dots, then open a dot or number for its popup. Each point is a city total, not
            an incident.
          </p>
        </div>
      </div>
    </div>
  );
}
