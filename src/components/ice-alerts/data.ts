import heatmapJson from '@/data/ice-arrest-heatmap.json';
import type { CityPoint, HeatmapSnapshot } from './types';

export const DATA = heatmapJson as HeatmapSnapshot;

const numberFormatter = new Intl.NumberFormat('en-US');
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

/** Format an ISO date without letting the browser's timezone shift the day. */
export function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;

  const parts = dateFormatter.formatToParts(date);
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;
  return month && day && year ? `${month}. ${day}, ${year}` : dateFormatter.format(date);
}

export function cityKey(city: CityPoint) {
  return `${city.city}|${city.stateCode}`;
}

export function selectedCityLabel(city: CityPoint) {
  return `${city.city}, ${city.stateCode}`;
}

/** 1-based position in the snapshot, matching the list ranking. */
export function cityRank(city: CityPoint) {
  return DATA.cities.findIndex((candidate) => cityKey(candidate) === cityKey(city)) + 1;
}

export function citySharePercent(city: CityPoint) {
  return ((city.count / DATA.meta.mappedRecords) * 100).toFixed(1);
}
