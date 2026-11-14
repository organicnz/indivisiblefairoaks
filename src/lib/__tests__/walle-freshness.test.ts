// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  copyRegionPath,
  currentEventOrFilter,
  dataPointPath,
  eventDateScope,
  eventMatchesDateScope,
  eventStatus,
  formatPacificNow,
  hasCurrentDateIntent,
  hasEventIntent,
  hasScheduleIntent,
  isCurrentDateOnlyQuestion,
  isPublicDataPointKey,
  isScheduleFactText,
  isUnreachableContentSlug,
  keywordScore,
  meaningfulTerms,
  selectCurrentEvents,
  snapshotIsFresh,
} from '../../../supabase/functions/_shared/walle-freshness';

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

  it('keeps an ordinal weekday schedule current without an explicit every', () => {
    expect(
      eventStatus(
        event('first-tuesday', {
          date_label: 'First Tuesday of the month',
          starts_at: '2026-10-06T18:30:00-07:00',
          ends_at: '2026-10-06T20:00:00-07:00',
        })
      )
    ).toBe('recurring');
    expect(currentEventOrFilter(NOW)).toContain('date_label.ilike.% first%');
  });
});

describe('WALL-E date and retrieval relevance', () => {
  it('formats the chapter timezone rather than UTC', () => {
    const formatted = formatPacificNow(NOW);
    expect(formatted).toContain('November 13, 2026');
    expect(formatted).toContain('6:30 PM');
  });

  it('answers clock questions from the system clock, not the retrieval corpus', () => {
    expect(hasCurrentDateIntent("What's today's date?")).toBe(true);
    expect(hasCurrentDateIntent('What day is it?')).toBe(true);
    expect(hasCurrentDateIntent('What time is it?')).toBe(true);
    expect(hasCurrentDateIntent("What's the time?")).toBe(true);
    expect(hasCurrentDateIntent('What is the date of the next meeting?')).toBe(false);
    expect(hasCurrentDateIntent('What is the current date for the event?')).toBe(false);
    expect(isCurrentDateOnlyQuestion("What's today's date?")).toBe(true);
    expect(isCurrentDateOnlyQuestion('What is the current date and time?')).toBe(true);
    expect(isCurrentDateOnlyQuestion('What time is it right now?')).toBe(true);
    expect(isCurrentDateOnlyQuestion('What time is it in Fair Oaks?')).toBe(true);
    expect(isCurrentDateOnlyQuestion('What time is it in Carmichael?')).toBe(true);
    expect(isCurrentDateOnlyQuestion('What time is it in New York?')).toBe(false);
    expect(isCurrentDateOnlyQuestion('What time is the next meeting?')).toBe(false);
    expect(isCurrentDateOnlyQuestion("What's the date tomorrow?")).toBe(false);
    expect(isCurrentDateOnlyQuestion("What's the date next week?")).toBe(false);
    expect(isCurrentDateOnlyQuestion("What's the date this weekend?")).toBe(false);
    expect(isCurrentDateOnlyQuestion("What's today's date and what events are happening?")).toBe(
      false
    );
    expect(isCurrentDateOnlyQuestion('What is the date of the next meeting?')).toBe(false);
  });

  it('drops generic question words that used to fill every source slot', () => {
    expect(meaningfulTerms('What upcoming events does our chapter have scheduled?')).toEqual([
      'events',
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
    expect(keywordScore({ title: 'Choir', type: 'page', status: 'publish' }, ['page'])).toBe(0);
  });

  it('strips HTML and matches ordinary plural forms when scoring', () => {
    const row = {
      title: 'Civic information',
      body: '<p>Voter registrations and <strong>elections</strong> are listed here.</p>',
    };
    expect(keywordScore(row, ['voter', 'registration', 'election'])).toBe(3);
    expect(keywordScore(row, ['choir'])).toBe(0);
  });

  it('builds a database filter that keeps current, undated, and recurring rows only', () => {
    const filter = currentEventOrFilter(NOW);
    expect(filter).toContain(`ends_at.gte.${NOW.toISOString()}`);
    expect(filter).toContain(`and(ends_at.is.null,starts_at.gte.${NOW.toISOString()})`);
    expect(filter).toContain('and(ends_at.is.null,starts_at.is.null)');
    expect(filter).toContain('date_label.ilike.every%');
    expect(filter).toContain('date_label.ilike.% every%');
    expect(filter).toContain('date_label.ilike.each%');
    expect(filter).toContain('date_label.ilike.% each%');
    expect(filter).toContain('date_label.ilike.monthly%');
    expect(filter).toContain('date_label.ilike.% monthly%');
    expect(filter).toContain('date_label.ilike.% first%');
    // A broad `%each%` also matches "beach" and can crowd out real events.
    expect(filter).not.toContain('date_label.ilike.%each%');
  });

  it('rejects stale duplicate content rows while keeping useful current pages', () => {
    expect(isUnreachableContentSlug('upcoming-events')).toBe(true);
    expect(isUnreachableContentSlug('shipping-returns')).toBe(true);
    expect(isUnreachableContentSlug('copy-home-hero')).toBe(true);
    // Legacy redirects and coded App Router pages shadow these rows. The live
    // page/data-point/FAQ source is authoritative; the old content row is not.
    expect(isUnreachableContentSlug('home')).toBe(true);
    expect(isUnreachableContentSlug('about-us')).toBe(true);
    expect(isUnreachableContentSlug('events')).toBe(true);
    expect(isUnreachableContentSlug('faqs')).toBe(true);
    expect(isUnreachableContentSlug('privacy-policy')).toBe(true);
    expect(isUnreachableContentSlug('voter-info')).toBe(true);
    expect(isUnreachableContentSlug('current-events')).toBe(true);
    expect(isUnreachableContentSlug('endorsements')).toBe(false);
  });

  it('keeps only public, non-UI data points and resolves their live page', () => {
    expect(isPublicDataPointKey('contact.footer.gatherings_schedule')).toBe(true);
    expect(isPublicDataPointKey('choir.schedule.time')).toBe(true);
    expect(isPublicDataPointKey('home.hero.headline')).toBe(true);
    expect(isPublicDataPointKey('home.impact.neighbors_label')).toBe(true);
    expect(isPublicDataPointKey('admin.dashboard.title')).toBe(false);
    expect(isPublicDataPointKey('walle.starter_msg')).toBe(false);
    expect(isPublicDataPointKey('contact.form.name_label')).toBe(false);
    expect(isPublicDataPointKey('home.gathering.btn_cal')).toBe(false);

    expect(dataPointPath('contact.footer.gatherings_schedule')).toBe('/contact');
    expect(dataPointPath('choir.schedule.time')).toBe('/choir');
    expect(dataPointPath('voter.hotlines.office_phone')).toBe('/voter-info');
  });

  it('resolves only registered copy regions to their host page', () => {
    expect(copyRegionPath('copy-home-hero')).toBe('/');
    expect(copyRegionPath('copy-about-mission')).toBe('/about');
    expect(copyRegionPath('copy-choir-schedule')).toBe('/choir');
    expect(copyRegionPath('copy-events-trainings')).toBe('/events');
    expect(copyRegionPath('copy-unknown-region')).toBeNull();
    expect(copyRegionPath('about')).toBeNull();
  });

  it('classifies recurring schedule copy separately from dated events', () => {
    expect(isScheduleFactText('First Tuesday of the month (6:30 – 8:00 PM)')).toBe(true);
    expect(isScheduleFactText('Join our meeting on November 20 at the church')).toBe(false);
    expect(
      isScheduleFactText('Every Other Wednesday at St. Michael’s Episcopal Church')
    ).toBe(true);
    expect(isScheduleFactText('Meetings are held every month')).toBe(true);
    expect(isScheduleFactText('Volunteers table every weekend')).toBe(true);
    expect(isScheduleFactText('Meetings are held monthly at the Fair Oaks Church')).toBe(true);
    expect(isScheduleFactText('We meet at the church')).toBe(true);
    expect(isScheduleFactText('Our first rehearsal')).toBe(true);
    expect(isScheduleFactText('This is my first time')).toBe(false);
    expect(isScheduleFactText('Empowering Every Voter')).toBe(false);
    expect(isScheduleFactText('Every dollar supports the work')).toBe(false);
    expect(isScheduleFactText('Join our next community gathering')).toBe(false);
    expect(isScheduleFactText('Democracy is not a spectator sport.')).toBe(false);
  });

  it('distinguishes schedule intent from general event context', () => {
    expect(hasScheduleIntent('What upcoming events are scheduled?')).toBe(true);
    expect(hasScheduleIntent('Where can I find voter registration info?')).toBe(false);
    expect(hasEventIntent('Tell me about the choir')).toBe(true);
    expect(hasScheduleIntent('Tell me about the choir')).toBe(false);
    expect(hasScheduleIntent('How do I volunteer?')).toBe(false);
    expect(hasEventIntent('How do I volunteer?')).toBe(true);
    expect(hasEventIntent('Any events?')).toBe(true);
    expect(hasEventIntent('What is the meeting location?')).toBe(true);
    expect(hasScheduleIntent("What's next for the chapter?")).toBe(false);
    expect(hasScheduleIntent("What's in this week's newsletter?")).toBe(false);
    expect(hasScheduleIntent("What's on the newsletter?")).toBe(false);
    expect(hasScheduleIntent("What's on this week's newsletter?")).toBe(false);
    expect(hasScheduleIntent("What's happening in the newsletter?")).toBe(false);
    expect(hasScheduleIntent('Do we have anything coming up?')).toBe(true);
    expect(hasScheduleIntent('When is the next meeting?')).toBe(true);
    expect(hasScheduleIntent('Where is the next meeting?')).toBe(true);
    expect(hasScheduleIntent('Where do I volunteer?')).toBe(false);
    expect(hasScheduleIntent("What's happening this weekend?")).toBe(true);
    expect(hasScheduleIntent('What’s happening this weekend?')).toBe(true);
    expect(hasScheduleIntent('What events are in November?')).toBe(true);
    expect(hasScheduleIntent("What's happening in November?")).toBe(true);
    expect(hasScheduleIntent('Any events on Nov 20?')).toBe(true);
    expect(hasScheduleIntent('What is the date of the next meeting?')).toBe(true);
    expect(hasScheduleIntent('What is the meeting time?')).toBe(true);
    expect(hasScheduleIntent('What is the meeting location?')).toBe(true);
    expect(hasScheduleIntent('Any events?')).toBe(true);
    expect(hasScheduleIntent('What events do you have?')).toBe(true);
    expect(hasScheduleIntent('What events are happening?')).toBe(true);
    expect(hasScheduleIntent('What is on the November ballot?')).toBe(false);
    expect(hasScheduleIntent("What's happening with the November ballot?")).toBe(false);
    expect(hasScheduleIntent("What's happening in November?")).toBe(true);
    expect(hasScheduleIntent("What's happening with the newsletter?")).toBe(false);
    expect(hasScheduleIntent('How may I help with events?')).toBe(false);
  });

  it('rejects snapshots older than the 24-hour window', () => {
    expect(snapshotIsFresh('2026-11-13T05:25:05.875-08:00', NOW)).toBe(true);
    expect(snapshotIsFresh('2026-11-13T03:30:00.000Z', NOW)).toBe(true);
    expect(snapshotIsFresh('2026-11-13T01:30:00.000Z', NOW)).toBe(false);
    expect(snapshotIsFresh('2026-11-12T01:00:00.000Z', NOW)).toBe(false);
    expect(snapshotIsFresh('nonsense', NOW)).toBe(false);
  });

  it('scopes explicit day, weekend, week, and month questions in Pacific time', () => {
    expect([...eventDateScope('What events are on November 20?', NOW)!.dates]).toEqual([
      '2026-11-20',
    ]);
    expect([...eventDateScope("What's happening tomorrow?", NOW)!.dates]).toEqual([
      '2026-11-14',
    ]);
    expect([...eventDateScope("What's happening this evening?", NOW)!.dates]).toEqual([
      '2026-11-13',
    ]);
    expect(eventDateScope('What events are on the 20th?', NOW)!.label).toBe(
      'November 20, 2026'
    );
    expect([...eventDateScope("What's happening on Saturday?", NOW)!.dates]).toEqual([
      '2026-11-14',
    ]);
    expect([...eventDateScope("What's happening over the weekend?", NOW)!.dates]).toEqual([
      '2026-11-14',
      '2026-11-15',
    ]);
    expect([...eventDateScope("What's happening for the weekend?", NOW)!.dates]).toEqual([
      '2026-11-14',
      '2026-11-15',
    ]);
    expect(eventDateScope("What's happening every Saturday?", NOW)).toBeNull();
    expect(eventDateScope("What's happening every weekend?", NOW)).toBeNull();
    expect([...eventDateScope("What's happening this weekend?", NOW)!.dates]).toEqual([
      '2026-11-14',
      '2026-11-15',
    ]);
    expect([...eventDateScope("What's happening next week?", NOW)!.dates]).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
    expect(eventDateScope("What's happening next month?", NOW)!.label).toBe('December 2026');
    expect([...eventDateScope('What events are in January?', NOW)!.dates]).toContain(
      '2027-01-01'
    );
    expect(eventDateScope('What events are in December 2027?', NOW)!.label).toBe(
      'December 2027'
    );
    expect(eventDateScope('What events are in November 2026?', NOW)!.label).toBe(
      'November 2026'
    );
    expect(eventDateScope('What events are on 20 November 2027?', NOW)!.label).toBe(
      'November 20, 2027'
    );
    const lateNovember = new Date('2026-11-26T02:30:00.000Z'); // Nov 25, 6:30 PM PST
    expect(eventDateScope('What events are on November 20?', lateNovember)!.label).toBe(
      'November 20, 2027'
    );
  });

  it('matches dated and recurring events only inside the requested period', () => {
    const november20 = eventDateScope('What events are on November 20?', NOW)!;
    expect(
      eventMatchesDateScope(
        event('nov-20', {
          starts_at: '2026-11-20T18:30:00-08:00',
          ends_at: '2026-11-20T20:00:00-08:00',
        }),
        november20
      )
    ).toBe(true);
    expect(
      eventMatchesDateScope(
        event('nov-21', {
          starts_at: '2026-11-21T18:30:00-08:00',
          ends_at: '2026-11-21T20:00:00-08:00',
        }),
        november20
      )
    ).toBe(false);
    expect(
      eventMatchesDateScope(
        event('undated-label', {
          starts_at: null,
          ends_at: null,
          date_label: 'Friday, November 20, 2026',
        }),
        november20
      )
    ).toBe(true);

    const weekend = eventDateScope("What's happening this weekend?", NOW)!;
    expect(
      eventMatchesDateScope(
        event('saturday-singing', {
          date_label: 'Ongoing Every Saturday Afternoon',
          starts_at: '2026-10-17T15:00:00-07:00',
          ends_at: '2026-10-17T16:30:00-07:00',
        }),
        weekend
      )
    ).toBe(true);
    expect(
      eventMatchesDateScope(
        event('wednesday-rehearsal', {
          date_label: 'Every Other Wednesday',
          starts_at: '2026-10-21T18:30:00-07:00',
          ends_at: '2026-10-21T20:00:00-07:00',
        }),
        weekend
      )
    ).toBe(false);

    const firstTuesday = event('first-tuesday', {
      date_label: 'First Tuesday of the month',
      starts_at: '2026-11-03T18:30:00-08:00',
      ends_at: '2026-11-03T20:00:00-08:00',
    });
    expect(
      eventMatchesDateScope(
        firstTuesday,
        eventDateScope('What events are on December 1, 2026?', NOW)!
      )
    ).toBe(true);
    expect(
      eventMatchesDateScope(
        firstTuesday,
        eventDateScope('What events are on December 8, 2026?', NOW)!
      )
    ).toBe(false);
  });
});
