import { LocateFixed, Minus, Plus } from 'lucide-react';
import type { RefObject } from 'react';
import { formatDateLabel, formatNumber } from './data';
import type { HeatmapMeta } from './types';

type IceMapCanvasProps = {
  meta: HeatmapMeta;
  mapContainerRef: RefObject<HTMLDivElement | null>;
  onZoom: (direction: 'in' | 'out') => void;
  onReset: () => void;
};

export function IceMapCanvas({ meta, mapContainerRef, onZoom, onReset }: IceMapCanvasProps) {
  return (
    <div className="relative isolate">
      <div
        ref={mapContainerRef}
        role="region"
        aria-label="Interactive historical map of ICE arrests by city"
        aria-describedby="ice-map-help"
        className="h-[clamp(19.5rem,43vh,31rem)] w-full"
      />
      <p id="ice-map-help" className="sr-only">
        A clustered city map of {formatNumber(meta.mappedRecords)} de-duplicated ICE
        arrest records assigned to {formatNumber(meta.mappedCities)} U.S. cities
        from {formatDateLabel(meta.periodStart)} through {formatDateLabel(meta.periodEnd)} (latest available
        release, checked {formatDateLabel(meta.releaseCheckedAt)}). Numbers group nearby
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

      </div>
    </div>
  );
}
