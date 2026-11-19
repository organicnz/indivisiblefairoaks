// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildMessages,
  parseRefineResponse,
} from '../../../supabase/functions/ice-source-refine/logic';

const SOURCE = [
  'Topics',
  'Immigration and Customs Enforcement',
  'Law Enforcement',
  'ICE agents arrested two people in Fair Oaks, CA on Tuesday.',
  'The agency said the operation followed a months-long investigation.',
  'Was this page helpful?',
  'Yes',
  'No',
].join('\n');

const DIGEST_SOURCE = [
  'ICE Los Angeles arrested 12 people during an operation on Tuesday after a months-long investigation, the agency said.',
  'The agency said the operation followed a six-month investigation.',
  'Officials reported that 3 vehicles were seized.',
  'No injuries were reported.',
].join('\n');

const GOOD_DIGEST = [
  'Federal immigration agents detained 12 people in Los Angeles on Tuesday during an operation, officials said.',
  'Investigators described the operation as the result of a six-month inquiry. They also reported that 3 vehicles were seized.',
  'No one was injured in the arrests, the agency said. The source did not identify the people taken into custody or describe the charges they may face.',
].join('\n\n');

describe('ice-source-refine line selection', () => {
  it('rebuilds cleaned text from the original lines only', () => {
    const result = parseRefineResponse(
      '{"isReport":true,"keep":[4,5]}',
      SOURCE
    );
    expect(result).toEqual({
      isReport: true,
      text: 'ICE agents arrested two people in Fair Oaks, CA on Tuesday.\nThe agency said the operation followed a months-long investigation.',
    });
  });

  it('accepts a fenced response and string line numbers', () => {
    expect(
      parseRefineResponse(
        '```json\n{"isReport":true,"keep":["4",5]}\n```',
        SOURCE
      )?.text
    ).toContain('months-long investigation');
  });

  it('marks a generic agency page as a non-report', () => {
    expect(parseRefineResponse('{"isReport":false,"keep":[]}', SOURCE)).toEqual({
      isReport: false,
      text: '',
    });
  });

  it('rejects malformed, empty and out-of-range selections', () => {
    expect(parseRefineResponse('not json', SOURCE)).toBeNull();
    expect(parseRefineResponse('{"isReport":true,"keep":[]}', SOURCE)).toBeNull();
    expect(parseRefineResponse('{"isReport":true,"keep":[9999]}', SOURCE)).toBeNull();
    expect(parseRefineResponse('{"isReport":"yes","keep":[4]}', SOURCE)).toBeNull();
  });

  it('tells the model not to treat navigation as a report', () => {
    const [system, user] = buildMessages({
      text: SOURCE,
      sourceUrl: 'https://www.dhs.gov/example',
      sourceTitle: 'Example',
    });
    expect(system.content).toContain('NOT a report');
    expect(system.content).toContain('Do not summarize');
    expect(system.content).toContain('Was this page helpful');
    expect(user.content).toContain('NUMBERED PAGE TEXT');
    expect(user.content).toContain('https://www.dhs.gov/example');
  });
});

describe('ice-source-refine digest mode', () => {
  it('accepts a grounded paraphrase with source numbers intact', () => {
    const result = parseRefineResponse(
      JSON.stringify({ isReport: true, text: GOOD_DIGEST }),
      DIGEST_SOURCE,
      'refine'
    );
    expect(result).toEqual({ isReport: true, text: GOOD_DIGEST });
  });

  it('rejects a copied twelve-word run', () => {
    const copied = `${DIGEST_SOURCE.split('\n')[0]} Additional context written separately to reach the minimum digest length for this test.`;
    expect(
      parseRefineResponse(
        JSON.stringify({ isReport: true, text: copied }),
        DIGEST_SOURCE,
        'refine'
      )
    ).toBeNull();
  });

  it('rejects invented numbers, links and markup', () => {
    const invented = GOOD_DIGEST.replace('12 people', '17 people');
    expect(
      parseRefineResponse(
        JSON.stringify({ isReport: true, text: invented }),
        DIGEST_SOURCE,
        'refine'
      )
    ).toBeNull();
    expect(
      parseRefineResponse(
        JSON.stringify({ isReport: true, text: `${GOOD_DIGEST}\nhttps://example.org/details` }),
        DIGEST_SOURCE,
        'refine'
      )
    ).toBeNull();
    expect(
      parseRefineResponse(
        JSON.stringify({ isReport: true, text: `<p>${GOOD_DIGEST}</p>` }),
        DIGEST_SOURCE,
        'refine'
      )
    ).toBeNull();
  });

  it('rejects a digest that is too short or not a report', () => {
    expect(
      parseRefineResponse(
        JSON.stringify({ isReport: true, text: 'Too short to be a digest.' }),
        DIGEST_SOURCE,
        'refine'
      )
    ).toBeNull();
    expect(
      parseRefineResponse(
        JSON.stringify({ isReport: false, text: 'Should be ignored.' }),
        DIGEST_SOURCE,
        'refine'
      )
    ).toEqual({ isReport: false, text: '' });
  });

  it('uses a paraphrase prompt instead of line-number selection', () => {
    const [system, user] = buildMessages({
      text: DIGEST_SOURCE,
      sourceUrl: 'https://www.ice.gov/news/releases/example',
      sourceTitle: 'Example',
      mode: 'refine',
    });
    expect(system.content).toContain('Paraphrase');
    expect(system.content).toContain('never reproduce a run of 12 or more consecutive words');
    expect(system.content).not.toContain('NUMBERED PAGE TEXT');
    expect(user.content).toContain('SOURCE TEXT');
    expect(user.content).toContain('12 people');
  });
});
