import type { IceSourceReportKind } from './ice-crawl-types';
import { US_STATE_CODES } from './rapid-city-match';

export type IceSourceReportKindFilter = 'all' | IceSourceReportKind;

export type IceSourceReportFilters = {
  query: string;
  kind: IceSourceReportKindFilter;
  stateCode: string;
  city: string;
};

type SearchParamValue = string | string[] | null | undefined;
type SearchParamSource =
  | URLSearchParams
  | Record<string, SearchParamValue>;

export const DEFAULT_ICE_SOURCE_REPORT_FILTERS: IceSourceReportFilters = {
  query: '',
  kind: 'all',
  stateCode: '',
  city: '',
};

const KINDS = new Set<IceSourceReportKind>([
  'enforcement',
  'detention',
  'checkpoint',
  'other',
]);

const MAX_QUERY_LENGTH = 80;

function readParam(params: SearchParamSource, key: string): string {
  if (params instanceof URLSearchParams) return params.get(key) ?? '';

  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/**
 * Keep a search term useful for an ILIKE filter without allowing PostgREST
 * filter syntax. The archive searches text, so punctuation is not needed for
 * matching; replacing it prevents commas, parentheses, wildcards, and quotes
 * from changing the query shape.
 */
export function normalizeIceSourceReportQuery(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return '';

  return raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
}

export function cleanIceSourceReportCityName(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/^[\s\-–—'.,]+/u, '')
    .replace(/[\s\-–—'.,]+$/u, '')
    .trim();
}

export function iceSourceReportPlaceLabel(
  city: string | null,
  stateCode: string | null
): string {
  const cleanCity = city ? cleanIceSourceReportCityName(city) : '';
  if (cleanCity && stateCode) return `${cleanCity}, ${stateCode}`;
  return cleanCity || stateCode || 'Location not stated';
}

export function normalizeIceSourceReportCity(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return '';

  return raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s.'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
}

export function parseIceSourceReportFilters(
  params: SearchParamSource
): IceSourceReportFilters {
  const query = normalizeIceSourceReportQuery(readParam(params, 'q'));
  const rawKind = readParam(params, 'kind').trim().toLowerCase();
  const kind = KINDS.has(rawKind as IceSourceReportKind)
    ? (rawKind as IceSourceReportKind)
    : 'all';
  const rawState = readParam(params, 'state').trim().toUpperCase();
  const stateCode = US_STATE_CODES.has(rawState) ? rawState : '';
  const city = normalizeIceSourceReportCity(readParam(params, 'city'));

  return { query, kind, stateCode, city };
}

export function hasIceSourceReportFilters(filters: IceSourceReportFilters) {
  return (
    filters.query.length > 0 ||
    filters.kind !== 'all' ||
    filters.stateCode.length > 0 ||
    filters.city.length > 0
  );
}

export function iceSourceReportFilterParams(filters: IceSourceReportFilters) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.kind !== 'all') params.set('kind', filters.kind);
  if (filters.stateCode) params.set('state', filters.stateCode);
  if (filters.city) params.set('city', filters.city);
  return params;
}

export function iceSourceReportArchiveHref(
  filters: IceSourceReportFilters,
  page = 1
) {
  const params = iceSourceReportFilterParams(filters);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/ice-alerts/web-reports?${query}` : '/ice-alerts/web-reports';
}

export function iceSourceReportExportHref(
  format: 'json' | 'xml',
  filters: IceSourceReportFilters
) {
  const params = iceSourceReportFilterParams(filters);
  params.set('format', format);
  return `/api/ice-source-reports/export?${params.toString()}`;
}
