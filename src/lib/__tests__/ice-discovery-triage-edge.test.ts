// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildMessages,
  parseCandidates,
  parseTriageResponse,
  type TriageCandidate,
} from '../../../supabase/functions/ice-discovery-triage/logic';

const candidates: TriageCandidate[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'ICE agents arrest 12 workers at Sacramento warehouse raid',
    publisher: 'Associated Press',
    published_at: '2026-11-20T12:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'ICE raid at Sacramento warehouse arrests 12 workers',
    publisher: 'Reuters',
    published_at: '2026-11-20T12:00:00.000Z',
  },
];

describe('ice-discovery-triage edge logic', () => {
  it('tells the model that headlines are untrusted data', () => {
    const messages = buildMessages(candidates);
    expect(messages[0].content).toMatch(/untrusted data/i);
    expect(messages[0].content).toMatch(/duplicate_of/i);
    expect(messages[1].content).toContain(candidates[0].id);
    expect(messages[1].content).toContain(candidates[1].id);
  });

  it('validates and de-duplicates the candidate payload', () => {
    expect(
      parseCandidates([
        { id: 'a', title: 'ICE arrests 4 in a raid' },
        { id: 'a', title: 'duplicate id is ignored' },
        { id: 'b', title: '' },
        { id: '../etc/passwd', title: 'invalid id' },
      ])
    ).toEqual([{ id: 'a', title: 'ICE arrests 4 in a raid', publisher: null, published_at: null }]);
    expect(parseCandidates([])).toBeNull();
    expect(parseCandidates('not an array')).toBeNull();
  });

  it('accepts a fenced JSON response and clamps the score', () => {
    const decisions = parseTriageResponse(
      '```json\n{"results":[{"id":"' +
        candidates[0].id +
        '","score":140,"confidence":"high","relevance":"enforcement","reason":"Specific warehouse raid.","duplicate_of":"' +
        candidates[1].id +
        '"}]}\n```',
      candidates
    );
    expect(decisions).toEqual([
      {
        id: candidates[0].id,
        score: 100,
        confidence: 'high',
        relevance: 'enforcement',
        reason: 'Specific warehouse raid.',
        duplicate_of: candidates[1].id,
      },
    ]);
  });

  it('drops unknown ids, a self duplicate and a malformed decision', () => {
    const decisions = parseTriageResponse(
      JSON.stringify({
        results: [
          {
            id: candidates[0].id,
            score: 88,
            confidence: 'medium',
            relevance: 'enforcement',
            reason: 'A specific ICE arrest.',
            duplicate_of: candidates[0].id,
          },
          {
            id: '99999999-9999-4999-8999-999999999999',
            score: 99,
            confidence: 'high',
            relevance: 'enforcement',
            reason: 'Not in the batch.',
          },
          {
            id: candidates[1].id,
            score: 50,
            confidence: 'certain',
            relevance: 'enforcement',
            reason: 'Invalid confidence.',
          },
        ],
      }),
      candidates
    );

    expect(decisions).toHaveLength(1);
    expect(decisions?.[0]).toMatchObject({
      id: candidates[0].id,
      score: 88,
      duplicate_of: null,
    });
  });

  it('returns null when no decision is usable', () => {
    expect(parseTriageResponse('not json', candidates)).toBeNull();
    expect(parseTriageResponse('{"results":[]}', candidates)).toBeNull();
    expect(parseTriageResponse('{"results":[{"id":"unknown"}]}', candidates)).toBeNull();
  });
});
