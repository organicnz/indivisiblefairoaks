// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildRapidLocalBrief } from '@/components/ice-alerts/rapid-local-brief';

const NOW = Date.parse('2026-11-18T12:00:00.000Z');
const POINTS = [
  {
    place: 'Sacramento, CA',
    count: 3,
    distanceMiles: 2.4,
    latestAt: '2026-11-17T20:00:00.000Z',
  },
  {
    place: 'West Sacramento, CA',
    count: 2,
    distanceMiles: 3.1,
    latestAt: '2026-11-16T12:00:00.000Z',
  },
];

const BASE = {
  anchorLabel: 'Sacramento, California, United States',
  anchorKind: 'search' as const,
  radiusMiles: 100,
  sourceName: 'Stop ICE Alerts Network',
  reportCount: 5,
  cityCount: 2,
  activeCityCount: 0,
  points: POINTS,
  nearest: null,
  feedStatus: 'ok' as const,
  feedFromCache: false,
  snapshotCheckedAt: '2026-11-18T11:53:00.000Z',
  now: NOW,
  mapUrl: 'https://example.org/ice-alerts',
};

describe('rapid local brief', () => {
  it('carries the radius, counts, nearest cities, and safety caveats', () => {
    const brief = buildRapidLocalBrief(BASE);

    expect(brief).toContain('ICE Alert — Local watch');
    expect(brief).toContain('Around Sacramento, California, United States · 100 mi radius');
    expect(brief).toContain(
      'Current feed (Stop ICE Alerts Network): 5 reports across 2 cities; 0 cities with an active report under 4h'
    );
    expect(brief).toContain('- Sacramento, CA — 3 reports, 2 mi, latest 16h ago');
    expect(brief).toContain('Snapshot checked 7m ago');
    expect(brief).toContain('not an all-clear');
    expect(brief).toContain('not independently verified');
    expect(brief).toContain('not an emergency service');
  });

  it('names an empty radius and the nearest real report without inventing one', () => {
    const brief = buildRapidLocalBrief({
      ...BASE,
      radiusMiles: 25,
      reportCount: 0,
      cityCount: 0,
      activeCityCount: 0,
      points: [],
      nearest: {
        place: 'Placerville, CA',
        count: 1,
        distanceMiles: 76,
        latestAt: '2026-11-17T20:00:00.000Z',
      },
    });

    expect(brief).toContain('No current-feed reports within 25 miles.');
    expect(brief).toContain('Nearest report in this view: Placerville, CA — 76 mi away.');
    expect(brief).not.toContain('Current feed:');
  });

  it('labels a cached snapshot and a stale feed honestly', () => {
    const cached = buildRapidLocalBrief({ ...BASE, feedFromCache: true });
    expect(cached).toContain('last successful snapshot cached on this device');
    expect(cached).toContain('not a live check');

    const stale = buildRapidLocalBrief({ ...BASE, feedStatus: 'stale' });
    expect(stale).toContain('community snapshot is flagged stale');
  });
});
