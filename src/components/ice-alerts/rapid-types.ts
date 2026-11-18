import type { RapidFilters } from './rapid-alert-utils';
import type { MapView, MapViewport } from './types';

export type RapidAlertSource = 'community' | 'official';

/**
 * These statuses describe the source's own label, not an independent
 * verification by this site. "source-confirmed" means the community network
 * published the report as confirmed.
 */
export type RapidAlertStatus = 'source-confirmed' | 'sighting' | 'official';

export type RapidAlertKind = 'enforcement' | 'detention' | 'checkpoint' | 'official';

export type RapidAlert = {
  id: string;
  source: RapidAlertSource;
  sourceName: string;
  sourceUrl: string;
  kind: RapidAlertKind;
  status: RapidAlertStatus;
  title: string;
  city: string;
  stateCode: string;
  place: string;
  /** City centroid, never the reported street address. */
  lat: number;
  lng: number;
  observedAt: string;
  expiresAt: string;
  summary: string;
};

export type OfficialRelease = {
  id: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
  summary: string;
  publishedAt: string;
};

export type RapidFeedStatus = 'ok' | 'stale' | 'unavailable';

export type RapidFeedSource = {
  status: RapidFeedStatus;
  sourceName: string;
  sourceUrl: string;
  checkedAt: string | null;
  latestAt: string | null;
  itemCount: number;
  note: string;
};

export type RapidFeedBase = {
  generatedAt: string;
  community: RapidFeedSource;
  official: RapidFeedSource;
  alerts: RapidAlert[];
  officialReleases: OfficialRelease[];
};

export type RapidFeed = RapidFeedBase & {
  publicCases: PublicCase[];
};

export type PublicCase = {
  id: string;
  city: string;
  stateCode: string;
  place: string;
  kind: Exclude<RapidAlertKind, 'official'>;
  observedAt: string;
  summary: string;
  lat: number;
  lng: number;
  corroborationCount: number;
};

export type RapidMapPoint = {
  id: string;
  city: string;
  stateCode: string;
  place: string;
  lat: number;
  lng: number;
  count: number;
  alertIds: string[];
  latestAlertId: string;
  latestAt: string;
  kind: RapidAlertKind;
  /** Status of the latest report, kept separate from the city's strongest status. */
  latestStatus: RapidAlertStatus;
  /** Strongest source status in the city; drives the marker treatment. */
  status: RapidAlertStatus;
  hasActive: boolean;
};

export type RapidUrlState = {
  initialView: MapViewport | null;
  initialMapView: MapView;
  initialAlertId: string | null;
  initialFilters: RapidFilters;
  hasUrlState: boolean;
};

export type RapidFeedRequestState = 'loading' | 'ready' | 'error';

export type RapidWatchRadius = {
  lat: number;
  lng: number;
  miles: number;
  label: string;
};
