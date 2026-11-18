import { formatRelativeTime } from './rapid-alert-utils';
import { formatLocalMiles } from './rapid-local';
import type { RapidFeedStatus } from './rapid-types';

export type RapidLocalBriefPoint = {
  place: string;
  count: number;
  distanceMiles: number;
  latestAt: string;
};

export type RapidLocalBriefInput = {
  anchorLabel: string;
  anchorKind: 'device' | 'search';
  radiusMiles: number;
  sourceName: string | null;
  reportCount: number;
  cityCount: number;
  activeCityCount: number;
  points: RapidLocalBriefPoint[];
  nearest: RapidLocalBriefPoint | null;
  feedStatus: RapidFeedStatus | null;
  feedFromCache: boolean;
  snapshotCheckedAt: string | null;
  now: number;
  mapUrl: string;
};

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : pluralForm}`;
}

/**
 * A local brief built only from the current feed's city-level rows. It names
 * the radius, the empty state, and the fact that the archive/FOIA lanes are
 * not part of this radius calculation, so it cannot read as an all-clear.
 */
export function buildRapidLocalBrief(input: RapidLocalBriefInput) {
  const anchor =
    input.anchorKind === 'device'
      ? 'Your device location'
      : `Around ${input.anchorLabel}`;
  const feedStatus = input.feedFromCache
    ? 'The live feed is unavailable; this uses the last successful snapshot cached on this device and is not a live check.'
    : input.feedStatus === 'stale'
      ? 'The community snapshot is flagged stale; newer reports may be missing.'
      : input.feedStatus === 'unavailable'
        ? 'The community snapshot is marked unavailable; this may be the last retained copy.'
        : '';
  const checked = input.snapshotCheckedAt
    ? `Snapshot checked ${formatRelativeTime(input.snapshotCheckedAt, input.now)}.`
    : '';
  const feedLabel = input.sourceName
    ? `Current feed (${input.sourceName})`
    : 'Current feed';
  const locationLines =
    input.reportCount === 0
      ? [
          `No current-feed reports within ${input.radiusMiles} miles.`,
          ...(input.nearest
            ? [
                `Nearest report in this view: ${input.nearest.place} — ${formatLocalMiles(
                  input.nearest.distanceMiles
                )} away.`,
              ]
            : []),
        ]
      : [
          `${feedLabel}: ${plural(input.reportCount, 'report')} across ${plural(
            input.cityCount,
            'city',
            'cities'
          )}; ${plural(input.activeCityCount, 'city', 'cities')} with an active report under 4h.`,
          'Nearest cities:',
          ...input.points.slice(0, 4).map(
            (point) =>
              `- ${point.place} — ${plural(point.count, 'report')}, ${formatLocalMiles(
                point.distanceMiles
              )}, latest ${formatRelativeTime(point.latestAt, input.now)}`
          ),
        ];

  return [
    'ICE Alert — Local watch',
    `${anchor} · ${input.radiusMiles} mi radius`,
    '',
    ...locationLines,
    ...(checked ? [checked] : []),
    ...(feedStatus ? [feedStatus] : []),
    '',
    'This brief covers the current community feed only. The public source archive and FOIA baseline are city-specific and are not automatically included.',
    `Map: ${input.mapUrl}`,
    '',
    'This is not an all-clear. Reports are not independently verified by this chapter. Locations are city-level only. This is not an emergency service.',
  ].join('\n');
}
