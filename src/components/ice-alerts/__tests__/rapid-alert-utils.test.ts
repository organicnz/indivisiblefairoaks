// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RapidAlert } from '@/components/ice-alerts/rapid-types';
import {
  DEFAULT_RAPID_FILTERS,
  filterAlerts,
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
      'Santa Ana, CA · Nov 18, 3:40 AM PST — community sighting of enforcement activity.',
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
      'Santa Ana, CA · Nov 18, 3:00 AM PST — source-confirmed detention-related activity near a jail or detention facility.',
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

  it('filters the feed and map by state', () => {
    const texasAlert: RapidAlert = {
      ...MIXED_STATUS_CITY[0],
      id: 'texas-sighting',
      city: 'El Paso',
      stateCode: 'TX',
      place: 'El Paso, TX',
    };
    const alerts = [...MIXED_STATUS_CITY, texasAlert];

    expect(
      filterAlerts(alerts, { ...DEFAULT_RAPID_FILTERS, stateCode: 'CA' }, NOW)
    ).toHaveLength(2);
    expect(
      filterAlerts(alerts, { ...DEFAULT_RAPID_FILTERS, stateCode: 'TX' }, NOW)
    ).toEqual([texasAlert]);
    expect(
      filterAlerts(alerts, { ...DEFAULT_RAPID_FILTERS, stateCode: 'NY' }, NOW)
    ).toHaveLength(0);
  });
});
