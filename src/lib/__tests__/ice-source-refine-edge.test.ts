// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildChunkMessages,
  buildMessages,
  buildSynthesisMessages,
  chunkSourceText,
  parseChunkNotes,
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
    const result = parseRefineResponse('{"isReport":true,"keep":[4,5]}', SOURCE);
    expect(result).toEqual({
      isReport: true,
      text: 'ICE agents arrested two people in Fair Oaks, CA on Tuesday.\nThe agency said the operation followed a months-long investigation.',
    });
  });

  it('accepts a fenced response and string line numbers', () => {
    expect(
      parseRefineResponse('```json\n{"isReport":true,"keep":["4",5]}\n```', SOURCE)?.text
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

  it('rejects a headline and byline instead of admitting title-only output', () => {
    const title = 'ICE Los Angeles operation takes 12 people into custody';
    const byline = `${title}\nBy Jane Doe, Staff Writer | November 16, 2026 | Updated 4:15 p.m. ET`;

    expect(byline.length).toBeGreaterThan(120);
    expect(
      parseRefineResponse(
        JSON.stringify({ isReport: true, text: byline }),
        DIGEST_SOURCE,
        'refine',
        title
      )
    ).toBeNull();
  });

  it('rejects a digest assembled mainly from a source passage', () => {
    const copied = `${DIGEST_SOURCE.split('\n')[0]} Additional context written separately to reach the minimum digest length for this test.`;
    expect(
      parseRefineResponse(JSON.stringify({ isReport: true, text: copied }), DIGEST_SOURCE, 'refine')
    ).toBeNull();
  });

  it('allows one isolated factual run inside a longer paraphrase', () => {
    const source =
      'Over the weekend, U.S. Customs and Border Protection Air and Marine Operations agents, U.S. Border Patrol agents, U.S. Coast Guard crews and military partners intercepted four separate maritime smuggling vessels off the Southern California coast, apprehending 81 people.';
    const digest = [
      'Federal agents stopped four boats carrying 81 people off Southern California, the agency said.',
      'The account described how military partners intercepted four separate maritime smuggling vessels off the Southern California coast. It said the incidents occurred over one weekend and involved several agencies.',
      'No injuries were reported. The source did not identify the people taken into custody or describe the charges they may face.',
    ].join('\n\n');
    expect(
      parseRefineResponse(JSON.stringify({ isReport: true, text: digest }), source, 'refine')
    ).toEqual({ isReport: true, text: digest });
  });

  it('rejects a lightly edited source article, not just an exact copied run', () => {
    const source =
      'Over the weekend, U.S. Customs and Border Protection Air and Marine Operations agents, U.S. Border Patrol agents, U.S. Coast Guard crews and military partners intercepted four separate maritime smuggling vessels off the Southern California coast, apprehending 81 people. The enforcement actions began at 12:45 p.m. on Saturday, Nov. 7, when Air and Marine Operations crews and partners simultaneously interdicted two vessels off the coast of Catalina Island.';
    const digest =
      'U.S. Customs and Border Protection (CBP) and partner agencies intercepted four maritime smuggling vessels off Southern California over the weekend, apprehending a total of 81 people. The operations began at 12:45 p.m. on Saturday, Nov. 7, when Air and Marine Operations crews and naval partners simultaneously interdicted two vessels near Catalina Island.';
    expect(
      parseRefineResponse(JSON.stringify({ isReport: true, text: digest }), source, 'refine')
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
    expect(system.content).toContain('Do not retell the page');
    expect(system.content).toContain('7 or more consecutive words');
    expect(system.content).toContain('never for people');
    expect(system.content).not.toContain('NUMBERED PAGE TEXT');
    expect(user.content).toContain('SOURCE TEXT');
    expect(user.content).toContain('12 people');
  });
});

describe('ice-source-refine long-source chunking', () => {
  it('keeps the end of a source when it exceeds the old prompt cap', () => {
    const lines = Array.from(
      { length: 2_000 },
      (_, index) => `Line ${index} records an enforcement detail for the report.`
    );
    const source = lines.join('\n');
    const [, user] = buildMessages({
      text: source,
      sourceUrl: 'https://www.ice.gov/news/releases/example',
      sourceTitle: 'Example',
      mode: 'refine',
    });

    expect(user.content).toContain('Line 0 ');
    expect(user.content).toContain('Line 1999 ');
  });

  it('splits a long source into complete, ordered chunks', () => {
    const paragraphs = Array.from(
      { length: 80 },
      (_, index) => `Paragraph ${index}: the agency reported a distinct fact.`
    );
    const source = paragraphs.join('\n\n');
    const chunks = chunkSourceText(source, {
      size: 700,
      overlap: 0,
      maxChunks: 100,
      lineSafe: true,
    });

    expect(chunks).not.toBeNull();
    expect(chunks?.[0]).toContain('Paragraph 0:');
    expect(chunks?.at(-1)).toContain('Paragraph 79:');
    expect(chunks?.join('\n')).toContain('Paragraph 40:');
  });

  it('fails closed when the full source exceeds the chunk budget', () => {
    expect(
      chunkSourceText('x'.repeat(5_000), {
        size: 1_000,
        overlap: 0,
        maxChunks: 2,
      })
    ).toBeNull();
  });

  it('numbers every chunk and builds a synthesis prompt from every note', () => {
    const input = {
      text: 'source',
      sourceUrl: 'https://www.ice.gov/news/releases/example',
      sourceTitle: 'Example',
      mode: 'refine' as const,
    };
    const [chunkSystem, chunkUser] = buildChunkMessages(input, 'PART BODY', 1, 3);
    expect(chunkSystem.content).toContain('factual notes');
    expect(chunkSystem.content).toContain('1500 characters');
    expect(chunkUser.content).toContain('PART 2 OF 3');
    expect(chunkUser.content).toContain('PART BODY');

    const [synthesisSystem, synthesisUser] = buildSynthesisMessages(input, [
      'First note with 12 people.',
      'Second note with a vehicle.',
    ]);
    expect(synthesisSystem.content).toContain('final faithful public digest');
    expect(synthesisUser.content).toContain('First note with 12 people.');
    expect(synthesisUser.content).toContain('Second note with a vehicle.');
  });

  it('accepts grounded chunk notes and rejects invented numbers or markup', () => {
    const source =
      'ICE agents arrested 12 people in Los Angeles on Tuesday after a months-long investigation.';
    const notes =
      'The agency reported arresting 12 people in Los Angeles on Tuesday after an investigation.';

    expect(parseChunkNotes(JSON.stringify({ isReport: true, notes }), source)).toEqual({
      isReport: true,
      notes,
    });
    expect(
      parseChunkNotes(JSON.stringify({ isReport: true, notes: notes.replace('12', '17') }), source)
    ).toBeNull();
    expect(
      parseChunkNotes(
        JSON.stringify({ isReport: true, notes: `${notes} https://example.org` }),
        source
      )
    ).toBeNull();
    expect(parseChunkNotes(JSON.stringify({ isReport: false, notes: '' }), source)).toEqual({
      isReport: false,
      notes: '',
    });
  });
});
