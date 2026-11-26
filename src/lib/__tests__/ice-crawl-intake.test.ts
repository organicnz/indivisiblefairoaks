// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { discoveryRelevance, isPermanentDiscoveryFailure } from '@/lib/ice-crawl-intake';

describe('discovery relevance screen', () => {
  it('admits ICE enforcement language and rejects unrelated news', () => {
    expect(
      discoveryRelevance(
        'ICE agents arrest 12 in Fair Oaks operation',
        'Federal immigration enforcement officers detained twelve people during an operation.'
      )
    ).toBe(true);
    expect(
      discoveryRelevance(
        'City council approves new budget',
        'The council discussed road repairs and a summer festival.'
      )
    ).toBe(false);
  });

  it('does not treat "police" or "justice" as ICE', () => {
    expect(
      discoveryRelevance(
        'Police department announces awards',
        'The chief thanked officers and the department of justice for a grant.'
      )
    ).toBe(false);
  });
});

describe('discovery failure classification', () => {
  it('rejects permanent HTTP failures and robots blocks', () => {
    expect(isPermanentDiscoveryFailure('HTTP 404')).toBe(true);
    expect(isPermanentDiscoveryFailure('Blocked by robots.txt: https://x.test/')).toBe(true);
  });

  it('retries transient failures', () => {
    expect(isPermanentDiscoveryFailure('HTTP 503')).toBe(false);
    expect(isPermanentDiscoveryFailure('fetch timed out')).toBe(false);
  });
});
