// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_SUMMARY_MAX,
  discoveryRelevance,
  discoverySummary,
  isPermanentDiscoveryFailure,
} from '@/lib/ice-crawl-intake';

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

describe('discoverySummary', () => {
  it('prefers the AI excerpt and caps it', () => {
    const summary = discoverySummary(
      '<html></html>',
      'Fallback page text that is long enough to be usable.',
      'AI excerpt from the enforcement report.'
    );
    expect(summary).toBe('AI excerpt from the enforcement report.');
    expect((summary ?? '').length).toBeLessThanOrEqual(DISCOVERY_SUMMARY_MAX);
  });

  it('uses the page description when AI is unavailable', () => {
    const summary = discoverySummary(
      '<meta property="og:description" content="Federal agents detained two people in Sacramento.">',
      'Unrelated body text that is only here as a fallback and should not win.'
    );
    expect(summary).toBe('Federal agents detained two people in Sacramento.');
  });

  it('returns null rather than inventing a summary', () => {
    expect(discoverySummary('<html></html>', 'short')).toBeNull();
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
