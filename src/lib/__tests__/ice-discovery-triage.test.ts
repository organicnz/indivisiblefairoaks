// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collapseDuplicateDiscoveries,
  heuristicTriageDecision,
  mergeTriageDecisions,
  parseAiTriageResponse,
} from '@/lib/ice-discovery-triage';

function candidate(overrides: Record<string, unknown>) {
  return {
    id: 'candidate-1',
    title: 'ICE agents arrest 12 workers at Sacramento warehouse raid',
    publisher: 'Associated Press',
    published_at: '2026-11-20T12:00:00.000Z',
    url: 'https://example.com/ice-raid',
    discovered_at: '2026-11-20T13:00:00.000Z',
    ...overrides,
  } as Parameters<typeof heuristicTriageDecision>[0];
}

describe('heuristic discovery triage', () => {
  it('ranks a concrete ICE enforcement action high', () => {
    const decision = heuristicTriageDecision(candidate({}));
    expect(decision.score).toBeGreaterThanOrEqual(90);
    expect(decision.confidence).toBe('high');
    expect(decision.relevance).toBe('enforcement');
  });

  it('rejects the frozen-water word "ice" as off topic', () => {
    const decision = heuristicTriageDecision(
      candidate({
        title: 'Ice cream shop opens in Fair Oaks',
        publisher: 'Local News',
      })
    );
    expect(decision.score).toBeLessThan(10);
    expect(decision.relevance).toBe('off_topic');
    expect(decision.confidence).toBe('low');
  });

  it('keeps immigration enforcement without a named ICE role at medium confidence', () => {
    const decision = heuristicTriageDecision(
      candidate({
        title: 'Immigration raid at a California farm leads to arrests',
      })
    );
    expect(decision.score).toBe(58);
    expect(decision.confidence).toBe('medium');
    expect(decision.relevance).toBe('enforcement');
  });

  it('recognises a 287(g) agreement as a strong enforcement signal', () => {
    const decision = heuristicTriageDecision(
      candidate({ title: 'County signs 287(g) agreement with federal immigration agents' })
    );
    expect(decision.score).toBe(82);
    expect(decision.confidence).toBe('high');
    expect(decision.relevance).toBe('enforcement');
  });

  it('handles Spanish enforcement headlines in the fallback screen', () => {
    const decision = heuristicTriageDecision(
      candidate({ title: 'Redadas de ICE dejan varios arrestos en California' })
    );
    expect(decision.score).toBeGreaterThanOrEqual(90);
    expect(decision.relevance).toBe('enforcement');
  });
});

describe('duplicate story collapse', () => {
  it('collapses syndicated copies to the oldest canonical row', () => {
    const rows = [
      candidate({ id: 'canonical', discovered_at: '2026-11-20T13:00:00.000Z' }),
      candidate({
        id: 'syndicated',
        title: 'ICE raid at Sacramento warehouse arrests 12 workers',
        publisher: 'Reuters',
        discovered_at: '2026-11-20T14:00:00.000Z',
      }),
      candidate({
        id: 'different-event',
        title: 'ICE raid in Fresno leads to three arrests',
        published_at: '2026-11-20T10:00:00.000Z',
        discovered_at: '2026-11-20T15:00:00.000Z',
      }),
    ];

    const duplicates = collapseDuplicateDiscoveries(rows);
    expect(duplicates.get('syndicated')).toBe('canonical');
    expect(duplicates.has('different-event')).toBe(false);
  });

  it('does not collapse the same headline from a much later date', () => {
    const rows = [
      candidate({ id: 'first', published_at: '2026-11-20T12:00:00.000Z' }),
      candidate({
        id: 'later-recurrence',
        published_at: '2026-12-20T12:00:00.000Z',
        discovered_at: '2026-12-20T13:00:00.000Z',
      }),
    ];

    expect(collapseDuplicateDiscoveries(rows).size).toBe(0);
  });
});

describe('AI triage response validation', () => {
  const ids = [{ id: 'one' }, { id: 'two' }];

  it('accepts fenced JSON and clamps hostile values', () => {
    const raw = [
      '```json',
      JSON.stringify({
        results: [
          {
            id: 'one',
            score: 140,
            confidence: 'certain',
            relevance: 'enforcement',
            reason: ' Specific ICE operation. ',
            duplicate_of: 'missing-id',
          },
          {
            id: 'two',
            score: 20,
            confidence: 'low',
            relevance: 'off_topic',
            reason: 'Unrelated.',
            duplicate_of: 'two',
          },
          { id: 'not-in-batch', score: 90 },
        ],
      }),
      '```',
    ].join('\n');

    const decisions = parseAiTriageResponse(raw, ids);
    expect(decisions?.size).toBe(2);
    expect(decisions?.get('one')).toMatchObject({
      score: 100,
      confidence: 'high',
      relevance: 'enforcement',
      reason: 'Specific ICE operation.',
      duplicate_of: null,
    });
    expect(decisions?.get('two')?.duplicate_of).toBeNull();
  });

  it('returns null when the model output has no usable decisions', () => {
    expect(parseAiTriageResponse('not json at all', ids)).toBeNull();
    expect(parseAiTriageResponse('{"results":[{"id":"unknown","score":80}]}', ids)).toBeNull();
  });
});

describe('merging AI, heuristic and duplicate decisions', () => {
  it('flattens a duplicate chain to one canonical row', () => {
    const rows = [candidate({ id: 'a' }), candidate({ id: 'b' }), candidate({ id: 'c' })];
    const decisions = mergeTriageDecisions(
      rows,
      new Map(),
      new Map([
        ['b', 'a'],
        ['c', 'b'],
      ])
    );

    expect(decisions.find((row) => row.id === 'a')?.duplicate_of).toBeNull();
    expect(decisions.find((row) => row.id === 'b')?.duplicate_of).toBe('a');
    expect(decisions.find((row) => row.id === 'c')?.duplicate_of).toBe('a');
  });
});

const storeState = vi.hoisted(() => {
  delete process.env.ZAI_API_KEY;
  return {
    applied: [] as Array<{ id: string; duplicate_of: string | null }>,
  };
});

vi.mock('@/lib/ice-crawl-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ice-crawl-store')>();
  return {
    ...actual,
    listPendingIceCrawlDiscoveriesForTriage: async () => [
      {
        id: 'oldest',
        title: 'ICE agents arrest 12 workers at Sacramento warehouse raid',
        publisher: 'Associated Press',
        published_at: '2026-11-20T12:00:00.000Z',
        url: 'https://example.com/oldest',
        discovered_at: '2026-11-20T13:00:00.000Z',
      },
      {
        id: 'copy',
        title: 'ICE raid at Sacramento warehouse arrests 12 workers',
        publisher: 'Reuters',
        published_at: '2026-11-20T12:00:00.000Z',
        url: 'https://example.com/copy',
        discovered_at: '2026-11-20T14:00:00.000Z',
      },
    ],
    applyIceCrawlDiscoveryTriage: async (
      _store: unknown,
      rows: Array<{ id: string; duplicate_of: string | null }>
    ) => {
      storeState.applied.push(...rows);
      return rows.length;
    },
    countReviewableIceCrawlDiscoveries: async () => 5,
  };
});

describe('triagePendingDiscoveries', () => {
  beforeEach(() => {
    storeState.applied.length = 0;
  });

  it('falls back deterministically and persists collapsed duplicates', async () => {
    vi.stubEnv('ZAI_API_KEY', '');
    const { triagePendingDiscoveries } = await import('@/lib/ice-discovery-triage');

    const summary = await triagePendingDiscoveries({} as never, {
      limit: 10,
      deadline: Date.now() + 5_000,
    });

    expect(summary.triaged).toBe(2);
    expect(summary.heuristicTriaged).toBe(2);
    expect(summary.collapsedDuplicates).toBe(1);
    expect(summary.remaining).toBe(5);
    expect(storeState.applied).toHaveLength(2);
    expect(storeState.applied.find((row) => row.id === 'copy')?.duplicate_of).toBe('oldest');
  });
});
