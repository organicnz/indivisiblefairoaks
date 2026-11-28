import { Circle, Database, Info } from 'lucide-react';
import type { FormEvent, RefObject } from 'react';
import { IceMapCanvas } from './IceMapCanvas';
import { IceMapToolbar } from './IceMapToolbar';
import type {
  HeatmapMeta,
  HeatStatus,
  LocationSearchState,
  MapView,
  UserLocation,
  UserLocationStatus,
} from './types';

type IceMapPanelProps = {
  meta: HeatmapMeta;
  mapView: MapView;
  heatStatus: HeatStatus;
  mapContainerRef: RefObject<HTMLDivElement | null>;
  locationInput: string;
  locationSearch: LocationSearchState;
  isLocationSearching: boolean;
  userLocation: UserLocation | null;
  userLocationStatus: UserLocationStatus;
  isLocating: boolean;
  locationHeadline: string;
  locationDetail: string;
  onLocationInputChange: (value: string) => void;
  onLocationSearch: (event: FormEvent<HTMLFormElement>) => void;
  onFocusOverview: () => void;
  onFocusUserArea: () => void;
  onZoom: (direction: 'in' | 'out') => void;
  onReset: () => void;
};

export function IceMapPanel({
  meta,
  mapView,
  heatStatus,
  mapContainerRef,
  locationInput,
  locationSearch,
  isLocationSearching,
  userLocation,
  userLocationStatus,
  isLocating,
  locationHeadline,
  locationDetail,
  onLocationInputChange,
  onLocationSearch,
  onFocusOverview,
  onFocusUserArea,
  onZoom,
  onReset,
}: IceMapPanelProps) {
  return (
    <div
      id="ice-map-panel"
      data-map-status={heatStatus}
      data-location-status={userLocationStatus}
      className="min-w-0 scroll-mt-28 lg:sticky lg:top-28 lg:self-start"
    >
      <div className="overflow-hidden border border-border bg-surface-card">
        <IceMapToolbar
          meta={meta}
          mapView={mapView}
          locationInput={locationInput}
          locationSearch={locationSearch}
          isLocationSearching={isLocationSearching}
          userLocation={userLocation}
          isLocating={isLocating}
          locationHeadline={locationHeadline}
          locationDetail={locationDetail}
          onLocationInputChange={onLocationInputChange}
          onLocationSearch={onLocationSearch}
          onFocusOverview={onFocusOverview}
          onFocusUserArea={onFocusUserArea}
        />
        <IceMapCanvas
          meta={meta}
          mapContainerRef={mapContainerRef}
          onZoom={onZoom}
          onReset={onReset}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-surface-muted px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground sm:px-5">
          <span className="inline-flex items-center gap-1.5">
            <Circle className="size-3.5" aria-hidden="true" />
            Clustered city totals
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Database className="size-3.5" aria-hidden="true" />
            Published FOIA snapshot
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <Info className="size-3.5" aria-hidden="true" />
            {heatStatus === 'ready'
              ? 'Clustered city map active'
              : heatStatus === 'error'
                ? 'City map unavailable'
                : 'Loading city map'}
          </span>
        </div>
      </div>
    </div>
  );
}
