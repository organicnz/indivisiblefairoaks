export type CityPoint = {
  city: string;
  state: string;
  stateCode: string;
  lat: number;
  lng: number;
  count: number;
};

export type HeatmapMeta = {
  generatedAt: string;
  releaseCheckedAt: string;
  releaseNote: string;
  periodStart: string;
  periodEnd: string;
  sourceName: string;
  sourceUrl: string;
  sourceDataUrl: string;
  sourceRelease: string;
  sourceCitation: string;
  license: string;
  coordinateSource: string;
  coordinateUrl: string;
  rawRecords: number;
  duplicateRowsRemoved: number;
  records: number;
  recordsWithUsCity: number;
  mappedRecords: number;
  unmappedCityRecords: number;
  recordsWithoutUsableCity: number;
  mappedCities: number;
  mappedShareOfCityTagged: number;
  mappedShareOfAll: number;
  maxCityCount: number;
  sha256: string;
  method: string;
};

export type HeatmapSnapshot = {
  meta: HeatmapMeta;
  cities: CityPoint[];
};

export type MapView = 'nationwide' | 'local' | 'free';
export type HeatStatus = 'loading' | 'ready' | 'error';

export type UserLocation = {
  lat: number;
  lng: number;
  label: string;
  precision: 'approximate' | 'precise';
};

export type UserLocationStatus = 'checking' | 'available' | 'locating' | 'unavailable';

export type ApproximateGeoResponse =
  | {
      available: true;
      lat: number;
      lng: number;
      label: string;
      precision: 'approximate';
      source: 'vercel-ip';
    }
  | {
      available: false;
      reason: 'outside-us' | 'unavailable';
    };

export type LocationSearchState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'found'; label: string }
  | { kind: 'empty' }
  | { kind: 'error' };

export type SearchTarget = {
  label: string;
  lat: number;
  lng: number;
};

export type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
};
