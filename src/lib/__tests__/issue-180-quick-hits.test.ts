// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LINKS_DATA } from '@/components/links/links-fallback';
import { PARTNER_FALLBACK } from '@/components/partners/partners-fallback';
import {
  GATHERING_RSVP_HREF,
  QUICK_HITS,
  WORKGROUP_SIGNUP_HREF,
} from '@/config/quick-hits';
import { EVENT_CALENDAR_HREF, eventCategoryHref } from '@/lib/event-links';

describe('homepage quick hits', () => {
  it('links each recurring activity to its calendar filter', () => {
    expect(QUICK_HITS.map((item) => item.label)).toEqual([
      'Monthly gathering dates',
      'Coffee Klatches',
      'Postcarding & outreach',
      'Full chapter calendar',
    ]);
    expect(QUICK_HITS[0]?.href).toBe('/events?category=Meetings#upcoming-events');
    expect(QUICK_HITS[1]?.href).toBe('/events?category=Community#upcoming-events');
    expect(QUICK_HITS[2]?.href).toBe(
      '/events?category=Voter%20Mobilization#upcoming-events'
    );
    expect(QUICK_HITS[3]?.href).toBe(EVENT_CALENDAR_HREF);
  });

  it('gives each quick hit editable CMS keys', () => {
    expect(QUICK_HITS.map((item) => item.labelName)).toEqual([
      'home.quick_hits.gatherings_label',
      'home.quick_hits.coffee_label',
      'home.quick_hits.postcards_label',
      'home.quick_hits.calendar_label',
    ]);
    expect(new Set(QUICK_HITS.map((item) => item.detailName)).size).toBe(QUICK_HITS.length);
  });

  it('points sign-ups at the calendar and the prefilled contact form', () => {
    expect(GATHERING_RSVP_HREF).toBe('/events#upcoming-events');
    expect(WORKGROUP_SIGNUP_HREF).toBe('/contact?topic=workgroup#contact-form');
  });

  it('encodes the category and leaves All Actions unfiltered', () => {
    expect(eventCategoryHref('Rallies & Street Action')).toBe(
      '/events?category=Rallies%20%26%20Street%20Action#upcoming-events'
    );
    expect(eventCategoryHref('All Actions')).toBe(EVENT_CALENDAR_HREF);
  });
});

describe('issue #180 coalition links', () => {
  const expectedLinks = [
    ['Indivisible National', 'https://indivisible.org'],
    ['NorCal Resist', 'https://www.norcalresist.org'],
    ['Coalition Against Project 2025', 'https://www.opposeproject2025.org/'],
    ['League of Women Voters of Sacramento County', 'https://www.lwvsacramento.org'],
    ['Indivisible CA: StateStrong', 'https://www.castatestrong.org/'],
  ] as const;

  it.each(expectedLinks)('includes %s in the link-tree fallback', (name, url) => {
    expect(LINKS_DATA.find((item) => item.name === name)).toMatchObject({ name, url });
  });

  it('does not leave the old StateStrong name or URL in the fallback', () => {
    expect(
      LINKS_DATA.find((item) => item.name === 'Indivisible California State Network')
    ).toBeUndefined();
    expect(LINKS_DATA.some((item) => item.url === 'https://indivisibleca.org')).toBe(false);
  });

  it('mirrors the requested organizations on the partners fallback', () => {
    const byName = new Map(PARTNER_FALLBACK.map((partner) => [partner.name, partner.url]));
    expect(byName.get('Indivisible CA: StateStrong')).toBe(
      'https://www.castatestrong.org/'
    );
    expect(byName.get('League of Women Voters Sacramento County')).toBe(
      'https://www.lwvsacramento.org'
    );
    expect(byName.get('NorCal Resist')).toBe('https://www.norcalresist.org');
    expect(byName.get('Coalition Against Project 2025')).toBe(
      'https://www.opposeproject2025.org/'
    );
  });
});
