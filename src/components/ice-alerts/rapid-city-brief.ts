import type { RapidFeedStatus } from './rapid-types';

export type RapidCityBriefInput = {
  place: string;
  feedCount: number;
  activeCount: number;
  sourceNames: string[];
  feedStatus: RapidFeedStatus | null;
  feedFromCache?: boolean;
  reviewedCaseCount: number;
  foiaCount: number | null;
  archive: {
    total: number;
    extractionMethods: string[];
  } | null;
  archiveUrl: string;
  mapUrl: string;
};

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : pluralForm}`;
}

/**
 * A plain-text city brief built only from the lanes already rendered above.
 * It deliberately carries the same non-verification, overlap, and city-level
 * caveats as the page so a pasted brief cannot become a stronger claim.
 */
export function buildRapidCityBrief(input: RapidCityBriefInput) {
  const sources =
    input.sourceNames.length > 0 ? input.sourceNames.join(', ') : 'source not stated';
  const feedStatus = input.feedFromCache
    ? ' This brief uses the last successful feed cached on this device; it is not a live check.'
    : input.feedStatus === 'stale'
      ? ' The community snapshot is flagged stale; newer reports may be missing.'
      : input.feedStatus === 'unavailable'
        ? ' The community snapshot is marked unavailable; this may be the last retained copy.'
        : '';
  const archiveLine = input.archive
    ? `Public source archive: ${plural(
        input.archive.total,
        'archived report'
      )}${
        input.archive.extractionMethods.length > 0
          ? ` (recent rows indexed via ${input.archive.extractionMethods.join(' / ')})`
          : ''
      }.`
    : 'Public source archive: unavailable when this brief was prepared.';
  const foiaLine =
    input.foiaCount === null
      ? 'FOIA baseline: no city match in the current release.'
      : `FOIA baseline: ${plural(input.foiaCount, 'record')} in the latest city-level release.`;

  return [
    `ICE Alert — City watch: ${input.place}`,
    '',
    `Current feed: ${plural(input.feedCount, 'report')}, ${plural(
      input.activeCount,
      'active report'
    )} under 4h (${sources}).${feedStatus}`,
    `Reviewed community cases: ${input.reviewedCaseCount.toLocaleString('en-US')}.`,
    archiveLine,
    foiaLine,
    '',
    `Archive: ${input.archiveUrl}`,
    `Selected report: ${input.mapUrl}`,
    '',
    'Lanes may overlap, and the archive can lag the live feed. Reports are not independently verified by this chapter. Locations are city-level only. This is not an emergency service.',
  ].join('\n');
}
