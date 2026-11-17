// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  autoPublishRiskIssue,
  bestSimilarIceReport,
  generatedIceReportSummary,
  iceReportSimilarity,
  ICE_REPORT_SIMILARITY_THRESHOLD,
} from '@/lib/ice-report-auto-publish';

describe('ICE report automatic publication', () => {
  it('builds only a short generic city-level summary', () => {
    const summary = generatedIceReportSummary('Fair Oaks', 'CA', 'enforcement');

    expect(summary).toBe(
      'Community report of enforcement activity in Fair Oaks, CA. City-level only; not independently verified.'
    );
    expect(summary.length).toBeGreaterThanOrEqual(30);
    expect(summary.length).toBeLessThanOrEqual(400);
    expect(summary).not.toContain('unmarked');
    expect(generatedIceReportSummary('Sacramento', 'CA', 'checkpoint')).toContain(
      'checkpoint or roadblock'
    );
  });

  it('treats punctuation and case variants as the same text', () => {
    expect(
      iceReportSimilarity(
        'Unmarked vans near Sunrise Boulevard!',
        'unmarked vans near sunrise boulevard'
      )
    ).toBe(1);
  });

  it('scores close event descriptions above the merge threshold', () => {
    const first =
      'Several unmarked white vans and agents were stopping traffic near the intersection at Sunrise Boulevard.';
    const second =
      'Unmarked white vans and several agents were stopping traffic near the Sunrise Boulevard intersection.';

    expect(iceReportSimilarity(first, second)).toBeGreaterThanOrEqual(
      ICE_REPORT_SIMILARITY_THRESHOLD
    );
  });

  it('keeps unrelated reports below the merge threshold', () => {
    const first = 'Agents were directing traffic near the intersection on Sunrise Boulevard.';
    const second =
      'A checkpoint was set up outside the grocery store on the other side of town.';

    expect(iceReportSimilarity(first, second)).toBeLessThan(ICE_REPORT_SIMILARITY_THRESHOLD);
  });

  it('merges only the closest active near-duplicate', () => {
    const candidates = [
      {
        id: 'newer',
        summary: 'Unmarked white vans were stopping traffic near Sunrise Boulevard.',
        observed_at: '2026-11-17T18:30:00.000Z',
        public_report_id: 'public-newer',
      },
      {
        id: 'older',
        summary: 'Unmarked white vans and agents were stopping traffic near Sunrise Boulevard.',
        observed_at: '2026-11-17T17:30:00.000Z',
        public_report_id: 'public-older',
      },
      {
        id: 'expired',
        summary: 'Unmarked white vans were stopping traffic near Sunrise Boulevard.',
        observed_at: '2026-11-17T16:30:00.000Z',
        public_report_id: 'public-expired',
      },
      {
        id: 'unrelated',
        summary: 'A checkpoint was set up outside the grocery store across town.',
        observed_at: '2026-11-17T18:00:00.000Z',
        public_report_id: 'public-unrelated',
      },
    ];

    const best = bestSimilarIceReport(
      'Several unmarked white vans and agents were stopping traffic near Sunrise Boulevard.',
      candidates,
      new Set(['public-newer', 'public-older', 'public-unrelated'])
    );

    expect(best?.publicReportId).toBe('public-older');
    expect(best?.publicReportId).not.toBe('public-expired');
    expect(best?.publicReportId).not.toBe('public-unrelated');
  });

  it('holds detention, exact-place, and safety-sensitive reports for review', () => {
    expect(autoPublishRiskIssue('People were seen being detained nearby.', 'enforcement')).toMatch(
      /safety-sensitive/
    );
    expect(autoPublishRiskIssue('Vehicles were parked near 123 Main Street.', 'enforcement')).toMatch(
      /exact address/
    );
    expect(
      autoPublishRiskIssue('Agents were seen outside the school during dismissal.', 'enforcement')
    ).toMatch(/safety-sensitive place/);
    expect(
      autoPublishRiskIssue('Someone was arrested near the intersection.', 'enforcement')
    ).toMatch(/safety-sensitive event/);
    expect(autoPublishRiskIssue('People were seen being detained nearby.', 'detention')).toMatch(
      /manual review/
    );
  });

  it('allows a generic low-risk city-level enforcement or checkpoint report', () => {
    expect(
      autoPublishRiskIssue(
        'Unmarked vehicles were seen moving east near the intersection around 2 p.m.',
        'enforcement'
      )
    ).toBeNull();
    expect(
      autoPublishRiskIssue(
        'A checkpoint was set up on the main road and traffic was being redirected.',
        'checkpoint'
      )
    ).toBeNull();
  });
});
