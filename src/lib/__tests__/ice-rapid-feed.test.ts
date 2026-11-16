// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { CityPoint } from '@/components/ice-alerts/types';
import {
  parseCommunityTimestamp,
  parseIceNewsroomRss,
  parseStopIceCommunityFeed,
} from '@/lib/ice-rapid-feed';
import { isAlertActive } from '@/components/ice-alerts/rapid-alert-utils';

const CITIES: CityPoint[] = [
  {
    city: 'Santa Ana',
    state: 'CALIFORNIA',
    stateCode: 'CA',
    lat: 33.73633,
    lng: -117.8829,
    count: 2_243,
  },
  {
    city: 'Tustin',
    state: 'CALIFORNIA',
    stateCode: 'CA',
    lat: 33.74585,
    lng: -117.82617,
    count: 42,
  },
];

const COMMUNITY_XML = `<?xml version="1.0" encoding="utf-16" ?>
<stopice_data>
  <report_data>
    <id>1794718514043</id>
    <url>https://www.stopice.net/?alert=1794718514043</url>
    <lat>33.7504866</lat>
    <long>-117.8732255</long>
    <thispriority>URGENT Confirmed ICE report</thispriority>
    <location>62 Civic Center Plaza Santa Ana CA 92701</location>
    <timestamp>nov 14, 2026 (21:00:02) PST</timestamp>
    <comments>three ICE vehicles. Plate 8LHN072. Jane Doe was detained near the jail.</comments>
    <media>https://www.stopice.net/private/photo.jpeg</media>
  </report_data>
  <report_data>
    <id>1794700374214</id>
    <url>https://www.stopice.net/?alert=1794700374214</url>
    <lat>33.7199913</lat>
    <long>-117.8007892</long>
    <thispriority>ICE Sighting</thispriority>
    <location>14101 Myford Rd Tustin CA 92780</location>
    <timestamp>nov 14, 2026 (15:55:08) PST</timestamp>
    <comments>Checkpoint reported near the courthouse.</comments>
  </report_data>
  <report_data>
    <id>missing-city</id>
    <url>https://www.stopice.net/?alert=missing-city</url>
    <thispriority>ICE Sighting</thispriority>
    <location>Somewhere unknown</location>
    <timestamp>nov 14, 2026 (12:00:00) PST</timestamp>
    <comments>No state.</comments>
  </report_data>
</stopice_data>`;

const OFFICIAL_XML = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
  <item>
    <title><![CDATA[ICE Los Angeles arrests someone &amp; releases a statement]]></title>
    <link>https://www.ice.gov/news/releases/ice-los-angeles-example</link>
    <description><![CDATA[<p>On Nov. 10, ICE officers in Los Angeles <strong>arrested</strong> a person.</p>]]></description>
    <guid isPermaLink="false">70572</guid>
    <pubDate>Mon, 09 Nov 2026 15:57:26 -0500</pubDate>
  </item>
  <item>
    <title>Untrusted external link</title>
    <link>https://example.com/not-ice</link>
    <description>Not official.</description>
    <guid>bad</guid>
    <pubDate>Mon, 09 Nov 2026 15:57:26 -0500</pubDate>
  </item>
</channel></rss>`;

describe('parseCommunityTimestamp', () => {
  it('converts the export timestamp from Pacific time to UTC', () => {
    expect(parseCommunityTimestamp('nov 14, 2026 (21:00:02) PST')).toBe(
      '2026-11-15T05:00:02.000Z'
    );
  });

  it('rejects malformed timestamps', () => {
    expect(parseCommunityTimestamp('yesterday')).toBeNull();
    expect(parseCommunityTimestamp('nov 40, 2026 (21:00:02) PST')).toBeNull();
    expect(parseCommunityTimestamp('nov 14, 2026 (24:00:00) PST')).toBeNull();
    expect(parseCommunityTimestamp('nov 14, 2026 (21:60:00) PST')).toBeNull();
    expect(parseCommunityTimestamp('nov 14, 2026 (21:00:60) PST')).toBeNull();
  });
});

describe('active report freshness', () => {
  it('does not treat a future-dated report as active', () => {
    expect(
      isAlertActive(
        { observedAt: '2026-11-16T12:00:00.000Z' },
        Date.parse('2026-11-16T06:00:00.000Z')
      )
    ).toBe(false);
  });
});

describe('parseStopIceCommunityFeed', () => {
  it('generalizes locations and strips raw comments, plates, names, and media', () => {
    const result = parseStopIceCommunityFeed(COMMUNITY_XML, {
      cities: CITIES,
      now: new Date('2026-11-15T06:00:00.000Z'),
    });

    expect(result.alerts).toHaveLength(2);
    expect(result.scanned).toBe(3);
    expect(result.skipped).toBe(1);

    const santaAna = result.alerts[0];
    expect(santaAna.place).toBe('Santa Ana, CA');
    expect(santaAna.status).toBe('source-confirmed');
    expect(santaAna.kind).toBe('detention');
    expect(santaAna.summary).toContain('Santa Ana, CA');
    expect(santaAna.summary).not.toContain('Civic Center');
    expect(santaAna.summary).not.toContain('8LHN072');
    expect(santaAna.summary).not.toContain('Jane Doe');
    expect(santaAna.lat).toBe(CITIES[0].lat);
    expect(santaAna.lng).toBe(CITIES[0].lng);
    expect(santaAna.lat).not.toBe(33.7504866);
    expect(santaAna.lng).not.toBe(-117.8732255);

    const tustin = result.alerts[1];
    expect(tustin.place).toBe('Tustin, CA');
    expect(tustin.status).toBe('sighting');
    expect(tustin.kind).toBe('checkpoint');
    expect(tustin.summary).not.toContain('courthouse');
    expect(tustin.summary).not.toContain('Myford');
  });

  it('drops reports that cannot be resolved to a city', () => {
    const result = parseStopIceCommunityFeed(COMMUNITY_XML, {
      cities: CITIES,
      now: new Date('2026-11-15T06:00:00.000Z'),
      limit: 1,
    });

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].id).toBe('stopice-1794718514043');
  });

  it('drops reports timestamped after the supplied now', () => {
    const futureXml = COMMUNITY_XML.replace(
      'nov 14, 2026 (21:00:02) PST',
      'nov 16, 2026 (21:00:02) PST'
    );
    const result = parseStopIceCommunityFeed(futureXml, {
      cities: CITIES,
      now: new Date('2026-11-15T06:00:00.000Z'),
    });

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].id).toBe('stopice-1794700374214');
  });

  it('forces an external report URL back to the public source home', () => {
    const unsafeXml = COMMUNITY_XML.replace(
      'https://www.stopice.net/?alert=1794718514043',
      'https://example.com/private/report'
    );
    const result = parseStopIceCommunityFeed(unsafeXml, {
      cities: CITIES,
      now: new Date('2026-11-15T06:00:00.000Z'),
    });

    expect(result.alerts[0].sourceUrl).toBe('https://stopice.net/');
  });
});

describe('parseIceNewsroomRss', () => {
  it('classifies official releases without republishing names or case details', () => {
    const result = parseIceNewsroomRss(OFFICIAL_XML);

    expect(result.releases).toHaveLength(1);
    const release = result.releases[0];
    expect(release.title).toBe('Enforcement arrest release');
    expect(release.summary).not.toContain('Los Angeles');
    expect(release.summary).not.toContain('arrested a person');
    expect(release.summary).not.toContain('<strong>');
    expect(release.sourceUrl).toMatch(/^https:\/\/www\.ice\.gov\//);
    expect(release.publishedAt).toBe('2026-11-09T20:57:26.000Z');
  });
});
