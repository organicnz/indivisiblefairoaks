// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  communityMemo,
  formatCommunityObservedAt,
} from '@/components/ice-alerts/rapid-community-memo';

const BASE = {
  city: 'Santa Ana',
  stateCode: 'CA',
} as const;

describe('communityMemo', () => {
  it('renders a dated execution memo with the real source time', () => {
    expect(
      communityMemo({
        ...BASE,
        kind: 'enforcement',
        status: 'sighting',
        observedAt: '2026-11-18T11:40:00.000Z',
      })
    ).toBe(
      'Santa Ana, CA · Nov 18, 3:40 AM PST — community sighting of enforcement activity.'
    );
  });

  it('names the facility context for detention reports', () => {
    expect(
      communityMemo({
        ...BASE,
        kind: 'detention',
        status: 'source-confirmed',
        observedAt: '2026-11-15T05:00:02.000Z',
      })
    ).toBe(
      'Santa Ana, CA · Nov 14, 9:00 PM PST — source-confirmed detention-related activity near a jail or detention facility.'
    );
  });

  it('keeps a checkpoint report explicit and probabilistic', () => {
    expect(
      communityMemo({
        city: 'Tustin',
        stateCode: 'CA',
        kind: 'checkpoint',
        status: 'sighting',
        observedAt: '2026-11-14T23:55:08.000Z',
      })
    ).toBe(
      'Tustin, CA · Nov 14, 3:55 PM PST — community sighting of a possible checkpoint.'
    );
  });

  it('handles an invalid timestamp without inventing one', () => {
    expect(
      communityMemo({
        ...BASE,
        kind: 'enforcement',
        status: 'sighting',
        observedAt: 'not-a-date',
      })
    ).toBe(
      'Santa Ana, CA · Time unavailable — community sighting of enforcement activity.'
    );
  });

  it('uses Pacific time across daylight-saving changes', () => {
    expect(formatCommunityObservedAt('2026-07-15T05:00:02.000Z')).toBe(
      'Jul 14, 10:00 PM PDT'
    );
  });
});
