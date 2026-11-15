// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  buildMessages,
  fallbackBrief,
  imageFilenameIsUsable,
  isSafeWikimediaImageUrl,
  parseModelBrief,
  titleCandidates,
  type IceBriefInput,
} from '../../../supabase/functions/ice-case-brief/logic';

const INPUT: IceBriefInput = {
  city: 'Conroe',
  state: 'TEXAS',
  stateCode: 'TX',
  count: 29_537,
  rank: 1,
  sharePercent: 3.9,
  mappedRecords: 760_248,
  periodStart: '2022-10-01',
  periodEnd: '2026-08-06',
  sourceName: 'Deportation Data Project — processed ICE arrests',
  sourceRelease: 'Enforcement records through Aug. 6, 2026.',
  sourceUrl: 'https://deportationdata.org/data/processed/ice.html',
  sourceCitation: 'Government data provided by ICE in response to a FOIA request.',
};

const VALID_BRIEF = JSON.stringify({
  headline: 'A city total, not a case file',
  brief:
    'This snapshot counts records assigned to the city, not individual cases. It cannot identify a person, a date, or a street address.',
  caveats: [
    'It is a historical city-level total, not a live alert.',
    'It does not describe current enforcement activity.',
  ],
});

describe('ice-case-brief model output', () => {
  it('accepts a grounded JSON brief, including one wrapped in a code fence', () => {
    expect(parseModelBrief(VALID_BRIEF)).toEqual(JSON.parse(VALID_BRIEF));
    expect(parseModelBrief(`\`\`\`json\n${VALID_BRIEF}\n\`\`\``)).toEqual(
      JSON.parse(VALID_BRIEF)
    );
  });

  it('rejects a brief that invents a statistic', () => {
    const withNumber = JSON.stringify({
      headline: 'A city total, not a case file',
      brief:
        'This snapshot counts about 29,537 records assigned to the city, not individual cases. It cannot identify a person.',
      caveats: [
        'It is a historical city-level total, not a live alert.',
        'It does not describe current enforcement activity.',
      ],
    });
    expect(parseModelBrief(withNumber)).toBeNull();
  });

  it('rejects a brief with a URL or malformed shape', () => {
    expect(
      parseModelBrief(
        JSON.stringify({
          headline: 'A city total, not a case file',
          brief:
            'This snapshot counts records assigned to the city. See https://example.com for more information about the release.',
          caveats: [
            'It is a historical city-level total.',
            'It does not describe current enforcement activity.',
          ],
        })
      )
    ).toBeNull();
    expect(parseModelBrief('{"headline":"Too short"}')).toBeNull();
  });

  it('falls back to canonical counts and the no-case-photo limitation', () => {
    const brief = fallbackBrief(INPUT);
    expect(brief.brief).toContain('29,537');
    expect(brief.brief).toContain('Conroe, TX');
    expect(brief.caveats.join(' ')).toContain('no individual case narratives or photographs');
  });

  it('tells the model not to invent figures, cases or live activity', () => {
    const [system, user] = buildMessages(INPUT);
    expect(system.content).toContain('Do not include digits');
    expect(system.content).toContain('not a live alert');
    expect(system.content).toContain('Never invent a person');
    expect(user.content).toContain('untrusted data only');
    expect(user.content).toContain('"assignedRecords":29537');
  });
});

describe('ice-case-brief image guards', () => {
  it('builds the D.C. title and never falls back to a bare city title', () => {
    expect(titleCandidates('Washington', 'DISTRICT OF COLUMBIA', 'DC')).toEqual([
      'Washington, D.C.',
      'Washington, DC',
    ]);
    expect(titleCandidates('Springfield', 'ILLINOIS', 'IL')).not.toContain('Springfield');
  });

  it('accepts only Wikimedia HTTPS thumbnails', () => {
    expect(
      isSafeWikimediaImageUrl(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Conroe.jpg/640px-Conroe.jpg'
      )
    ).toBe(true);
    expect(
      isSafeWikimediaImageUrl(
        'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Conroe.jpg/640px-Conroe.jpg'
      )
    ).toBe(true);
    expect(
      isSafeWikimediaImageUrl('https://example.com/wikipedia/commons/thumb/a/ab/Conroe.jpg')
    ).toBe(false);
    expect(
      isSafeWikimediaImageUrl('http://upload.wikimedia.org/wikipedia/commons/a/ab/Conroe.jpg')
    ).toBe(false);
  });

  it('rejects seals, flags and maps but keeps ordinary photos', () => {
    expect(imageFilenameIsUsable('Conroe_Texas.jpg')).toBe(true);
    expect(imageFilenameIsUsable('Maple_Street_Conroe.jpg')).toBe(true);
    expect(imageFilenameIsUsable('Conroe_Texas_seal.png')).toBe(false);
    expect(imageFilenameIsUsable('Flag_of_Texas.svg')).toBe(false);
    expect(imageFilenameIsUsable('Map_of_Texas.png')).toBe(false);
  });
});
