// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  eventStatus,
  formatPacificNow,
  hasEventIntent,
  hasScheduleIntent,
  keywordScore,
  meaningfulTerms,
  selectCurrentEvents,
  snapshotIsFresh,
} from '../walle-freshness';

const NOW = new Date('2026-11-14T02:30:00.000Z'); // Nov 13, 6:30 PM PST

function event(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    title: slug,
    date_label: 'Tuesday, November 10, 2026',
    starts_at: '2026-11-10T18:30:00-08:00',
    ends_at: '2026-11-10T20:00:00-08:00',
    is_hidden: false,
    ...overrides,
  };
}

describe('WALL-E event freshness', () => {
  it('excludes past one-offs but keeps recurring events whose stored date is old', () => {
    const selected = selectCurrentEvents(
      [
        event('past'),
        event('upcoming', {
          title: 'Upcoming',
          starts_at: '2026-11-18T18:30:00-08:00',
          ends_at: '2026-11-18T20:00:00-08:00',
        }),
        event('recurring', {
          title: 'Recurring',
          date_label: 'Every Other Wednesday',
          starts_at: '2026-10-21T18:30:00-07:00',
          ends_at: '2026-10-21T20:00:00-07:00',
        }),
        event('hidden', { is_hidden: true }),
        event('undated', { starts_at: null, ends_at: null }),
      ],
      NOW
    );

    expect(selected.map((row) => row.slug)).toEqual(['upcoming', 'recurring', 'undated']);
    expect(selected.map((row) => row._status)).toEqual(['upcoming', 'recurring', 'undated']);
  });

  it('collapses a hand-written row and an imported duplicate at the same instant', () => {
    const selected = selectCurrentEvents(
      [
        event('manual', {
          title: 'Monthly Gathering',
          starts_at: '2026-11-18T18:30:00-08:00',
          ends_at: '2026-11-18T20:00:00-08:00',
        }),
        event('imported', {
          title: 'Imported Monthly Gathering',
          starts_at: '2026-11-18T18:30:00-08:00',
          ends_at: '2026-11-18T20:00:00-08:00',
        }),
      ],
      NOW
    );

    expect(selected).toHaveLength(1);
    expect(selected[0].slug).toBe('manual');
  });

  it('keeps two different events that happen to share a start time', () => {
    const selected = selectCurrentEvents(
      [
        event('coffee', {
          title: 'Coffee Klatch',
          starts_at: '2026-11-20T09:00:00-08:00',
          ends_at: '2026-11-20T10:00:00-08:00',
        }),
        event('rehearsal', {
          title: 'Choir Rehearsal',
          starts_at: '2026-11-20T09:00:00-08:00',
          ends_at: '2026-11-20T10:00:00-08:00',
        }),
      ],
      NOW
    );

    expect(selected.map((row) => row.slug)).toEqual(['coffee', 'rehearsal']);
  });

  it('uses the end instant, not the start, to decide whether an event is still current', () => {
    expect(
      eventStatus(
        event('ongoing', {
          starts_at: '2026-11-13T18:00:00-08:00',
          ends_at: '2026-11-13T21:00:00-08:00',
        }),
        NOW
      )
    ).toBe('upcoming');
  });

  it('does not mistake a dated Saturday for a recurring event', () => {
    expect(eventStatus(event('one-off-saturday', { date_label: 'Saturday, October 17, 2026' }))).toBe(
      'past'
    );
    expect(
      eventStatus(
        event('future-saturday', {
          date_label: 'Saturday, December 5, 2026',
          starts_at: '2026-12-05T10:00:00-08:00',
          ends_at: '2026-12-05T12:00:00-08:00',
        })
      )
    ).toBe('upcoming');
  });
});

describe('WALL-E date and retrieval relevance', () => {
  it('formats the chapter timezone rather than UTC', () => {
    const formatted = formatPacificNow(NOW);
    expect(formatted).toContain('November 13, 2026');
    expect(formatted).toContain('6:30 PM');
  });

  it('drops generic question words that used to fill every source slot', () => {
    expect(meaningfulTerms('What upcoming events does our chapter have scheduled?')).toEqual([
      'upcoming',
      'events',
      'scheduled',
    ]);
    expect(meaningfulTerms('Who are our local coalition and civic partners?')).toEqual([
      'coalition',
      'civic',
      'partners',
    ]);
  });

  it('scores rows by distinct meaningful terms', () => {
    const row = {
      title: 'Voter registration',
      description: 'Register to vote and check your election information.',
    };
    expect(keywordScore(row, ['voter', 'registration', 'election'])).toBe(3);
    expect(keywordScore(row, ['choir'])).toBe(0);
  });

  it('distinguishes schedule intent from general event context', () => {
    expect(hasScheduleIntent('What upcoming events are scheduled?')).toBe(true);
    expect(hasScheduleIntent('Where can I find voter registration info?')).toBe(false);
    expect(hasEventIntent('Tell me about the choir')).toBe(true);
    expect(hasScheduleIntent('Tell me about the choir')).toBe(false);
    expect(hasScheduleIntent('How do I volunteer?')).toBe(false);
    expect(hasEventIntent('How do I volunteer?')).toBe(true);
  });

  it('rejects snapshots older than the 48-hour window', () => {
    expect(snapshotIsFresh('2026-11-13T05:25:05.875-08:00', NOW)).toBe(true);
    expect(snapshotIsFresh('2026-11-12T01:00:00.000Z', NOW)).toBe(false);
    expect(snapshotIsFresh('nonsense', NOW)).toBe(false);
  });
});
