// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RapidAlert } from '@/components/ice-alerts/rapid-types';
import {
  groupRapidAlerts,
  rapidPopupSummary,
} from '@/components/ice-alerts/rapid-alert-utils';

const NOW = Date.parse('2026-11-18T12:00:00.000Z');

const MIXED_STATUS_CITY: RapidAlert[] = [
  {
    id: 'mixed-latest-sighting',
    source: 'community',
    sourceName: 'Stop ICE Alerts Network',
    sourceUrl: 'https://www.stopice.net/?alert=mixed-latest-sighting',
    kind: 'enforcement',
    status: 'sighting',
    title: 'Community enforcement report',
    city: 'Santa Ana',
    stateCode: 'CA',
    place: 'Santa Ana, CA',
    lat: 33.73633,
    lng: -117.8829,
    observedAt: '2026-11-18T11:40:00.000Z',
    expiresAt: '2026-11-18T15:40:00.000Z',
    summary:
      'Community sighting reported in Santa Ana, CA. Location is generalized to the city; street addresses, vehicle plates, and identities are not republished.',
  },
  {
    id: 'mixed-older-confirmed',
    source: 'community',
    sourceName: 'Stop ICE Alerts Network',
    sourceUrl: 'https://www.stopice.net/?alert=mixed-older-confirmed',
    kind: 'detention',
    status: 'source-confirmed',
    title: 'Source-confirmed detention report',
    city: 'Santa Ana',
    stateCode: 'CA',
    place: 'Santa Ana, CA',
    lat: 33.73633,
    lng: -117.8829,
    observedAt: '2026-11-18T11:00:00.000Z',
    expiresAt: '2026-11-18T15:00:00.000Z',
    summary:
      'Source-confirmed enforcement activity reported near a jail or detention facility in Santa Ana, CA. Location is generalized to the city; street addresses, vehicle plates, and identities are not republished.',
  },
];

describe('rapid popup with mixed city statuses', () => {
  it('shows the latest report status separately from the strongest city status', () => {
    const [point] = groupRapidAlerts(MIXED_STATUS_CITY, NOW);

    expect(point).toMatchObject({
      count: 2,
      latestAlertId: 'mixed-latest-sighting',
      latestAt: '2026-11-18T11:40:00.000Z',
      kind: 'enforcement',
      latestStatus: 'sighting',
      status: 'source-confirmed',
    });

    expect(rapidPopupSummary(point, NOW)).toEqual({
      latest: 'Latest report: Sighting enforcement · 20m ago',
      strongest: 'Strongest source status in this city: Source-confirmed',
    });
  });

  it('omits the strongest note when the latest report is already the strongest', () => {
    const [point] = groupRapidAlerts([MIXED_STATUS_CITY[1]], NOW);

    expect(rapidPopupSummary(point, NOW)).toEqual({
      latest: 'Latest report: Source-confirmed detention · 1h ago',
      strongest: null,
    });
  });
});
