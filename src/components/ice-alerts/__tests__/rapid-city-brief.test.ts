// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildRapidCityBrief } from '@/components/ice-alerts/rapid-city-brief';

const BASE = {
  place: 'Modesto, CA',
  feedCount: 4,
  activeCount: 0,
  sourceNames: ['Stop ICE Alerts Network'],
  feedStatus: 'ok' as const,
  reviewedCaseCount: 0,
  foiaCount: 187,
  archive: { total: 29, extractionMethods: ['feed'] },
  archiveUrl: 'https://example.org/ice-alerts/web-reports?state=CA&city=Modesto',
  mapUrl: 'https://example.org/ice-alerts?alert=stopice-1',
};

describe('rapid city brief', () => {
  it('carries real lane counts and the non-verification caveats', () => {
    const brief = buildRapidCityBrief(BASE);

    expect(brief).toContain('ICE Alert — City watch: Modesto, CA');
    expect(brief).toContain('Current feed: 4 reports, 0 active reports under 4h');
    expect(brief).toContain('Reviewed community cases: 0.');
    expect(brief).toContain('Public source archive: 29 archived reports (recent rows indexed via feed).');
    expect(brief).toContain('FOIA baseline: 187 records');
    expect(brief).toContain('Lanes may overlap');
    expect(brief).toContain('not independently verified');
    expect(brief).toContain('not an emergency service');
  });

  it('labels a brief built from the on-device cached feed', () => {
    const brief = buildRapidCityBrief({ ...BASE, feedFromCache: true });

    expect(brief).toContain('cached on this device; it is not a live check');
  });

  it('does not invent an archive or FOIA count when a lane is unavailable', () => {
    const brief = buildRapidCityBrief({
      ...BASE,
      archive: null,
      foiaCount: null,
      feedStatus: 'stale',
    });

    expect(brief).toContain('Public source archive: unavailable when this brief was prepared.');
    expect(brief).toContain('FOIA baseline: no city match in the current release.');
    expect(brief).toContain('community snapshot is flagged stale');
    expect(brief).not.toContain('29 archived reports');
    expect(brief).not.toContain('187 records');
  });
});
