// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RapidAlert } from '@/components/ice-alerts/rapid-types';
import {
  computeRapidSurges,
  surgeMatchesAudience,
} from '@/lib/ice-rapid-surges';

const NOW = Date.parse('2026-11-16T12:00:00.000Z');

function alert({
  id,
  city = 'Santa Ana',
  stateCode = 'CA',
  minutesAgo = 10,
}: {
  id: string;
  city?: string;
  stateCode?: string;
  minutesAgo?: number;
}): RapidAlert {
  return {
    id,
    source: 'community',
    sourceName: 'Stop ICE Alerts Network',
    sourceUrl: 'https://stopice.net/',
    kind: 'enforcement',
    status: 'source-confirmed',
    title: 'Community-reported enforcement activity',
    city,
    stateCode,
    place: `${city}, ${stateCode}`,
    lat: 33.7455,
    lng: -117.8677,
    observedAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
    expiresAt: new Date(NOW - minutesAgo * 60_000 + 4 * 60 * 60_000).toISOString(),
    summary: 'City-level report. Identities are not republished.',
  };
}

describe('computeRapidSurges', () => {
  it('detects a city cluster and ignores a single report', () => {
    const surges = computeRapidSurges(
      [
        alert({ id: 'a', minutesAgo: 10 }),
        alert({ id: 'b', minutesAgo: 50 }),
        alert({ id: 'c', city: 'Los Angeles', minutesAgo: 15 }),
      ],
      NOW
    );

    expect(surges).toHaveLength(1);
    expect(surges[0]).toMatchObject({
      scope: 'city',
      city: 'Santa Ana',
      stateCode: 'CA',
      count: 2,
    });
  });

  it('detects a state cluster when two cities cross the threshold', () => {
    const surges = computeRapidSurges(
      [
        alert({ id: 'a', minutesAgo: 10 }),
        alert({ id: 'b', minutesAgo: 30 }),
        alert({ id: 'c', city: 'Los Angeles', minutesAgo: 20 }),
        alert({ id: 'd', city: 'Los Angeles', minutesAgo: 40 }),
      ],
      NOW
    );

    expect(surges.some((surge) => surge.scope === 'state' && surge.stateCode === 'CA')).toBe(
      true
    );
    expect(surges.some((surge) => surge.scope === 'national')).toBe(false);
  });

  it('detects a national cluster across at least three states', () => {
    const surges = computeRapidSurges(
      [
        alert({ id: 'ca-1', city: 'Santa Ana', minutesAgo: 5 }),
        alert({ id: 'ca-2', city: 'Los Angeles', minutesAgo: 10 }),
        alert({ id: 'ca-3', city: 'San Diego', minutesAgo: 15 }),
        alert({ id: 'tx-1', city: 'Dallas', stateCode: 'TX', minutesAgo: 5 }),
        alert({ id: 'tx-2', city: 'Houston', stateCode: 'TX', minutesAgo: 10 }),
        alert({ id: 'tx-3', city: 'Austin', stateCode: 'TX', minutesAgo: 15 }),
        alert({ id: 'ny-1', city: 'New York', stateCode: 'NY', minutesAgo: 5 }),
        alert({ id: 'ny-2', city: 'Buffalo', stateCode: 'NY', minutesAgo: 10 }),
      ],
      NOW
    );

    expect(surges.some((surge) => surge.scope === 'national')).toBe(true);
  });

  it('does not count reports outside the window', () => {
    const surges = computeRapidSurges(
      [
        alert({ id: 'a', minutesAgo: 100 }),
        alert({ id: 'b', minutesAgo: 130 }),
      ],
      NOW
    );
    expect(surges).toHaveLength(0);
  });

  it('keeps one key inside a 15-minute bucket and changes it later', () => {
    const alerts = [
      alert({ id: 'a', minutesAgo: 10 }),
      alert({ id: 'b', minutesAgo: 40 }),
    ];
    const first = computeRapidSurges(alerts, NOW)[0];
    const sameBucket = computeRapidSurges(alerts, NOW + 5 * 60_000)[0];
    const nextBucket = computeRapidSurges(alerts, NOW + 16 * 60_000)[0];

    expect(sameBucket.key).toBe(first.key);
    expect(nextBucket.key).not.toBe(first.key);
  });

  it('matches subscribers by city, state, and national scope', () => {
    const surges = computeRapidSurges(
      [
        alert({ id: 'a', minutesAgo: 10 }),
        alert({ id: 'b', minutesAgo: 30 }),
      ],
      NOW
    );
    const citySurge = surges[0];

    expect(surgeMatchesAudience(citySurge, { stateCode: 'CA', city: 'santa ana' })).toBe(
      true
    );
    expect(surgeMatchesAudience(citySurge, { stateCode: 'CA', city: 'Los Angeles' })).toBe(
      false
    );
    expect(surgeMatchesAudience(citySurge, { stateCode: 'TX', city: 'Dallas' })).toBe(
      false
    );
  });
});
