// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  getPublishedIceReports,
  iceReportInputSchema,
  iceReportReferenceFromBytes,
  isAcceptableObservedAt,
  reportTextIssue,
  stripReportHtml,
  type IceReportStore,
} from '@/lib/ice-report-intake';
import { isSameOriginRequest } from '@/lib/same-origin';

const NOW = Date.parse('2026-11-16T20:00:00.000Z');

function validReport(overrides: Record<string, unknown> = {}) {
  return {
    city: 'Fair Oaks',
    stateCode: 'CA',
    kind: 'enforcement',
    observedAt: new Date(Date.now() - 15 * 60 * 1_000).toISOString(),
    summary:
      'Several unmarked vehicles were seen near the intersection around 2 p.m. moving east.',
    consent: true,
    company: '',
    ...overrides,
  };
}

describe('ice report intake validation', () => {
  it('accepts a minimized city-level report', () => {
    const result = iceReportInputSchema.safeParse(validReport());
    expect(result.success).toBe(true);
  });

  it('rejects a street address in the city field', () => {
    const result = iceReportInputSchema.safeParse(validReport({ city: '123 Main Street' }));
    expect(result.success).toBe(false);
  });

  it('rejects a report outside the 24-hour window', () => {
    const result = iceReportInputSchema.safeParse(
      validReport({ observedAt: new Date(Date.now() - 25 * 60 * 60 * 1_000).toISOString() })
    );
    expect(result.success).toBe(false);
  });

  it('rejects links, contact details, and long numbers in the summary', () => {
    expect(reportTextIssue('See https://example.com for more')).toMatch(/Remove links/);
    expect(reportTextIssue('Email someone@example.com about it')).toMatch(/email addresses/);
    expect(reportTextIssue('Call 916-555-1212 about it')).toMatch(/phone numbers/);
    expect(reportTextIssue('Plate 123456 was visible')).toMatch(/long numbers/);
  });

  it('strips HTML and control characters before validation', () => {
    expect(stripReportHtml('<b>Fair</b>\n  Oaks\u0000')).toBe('Fair Oaks');
  });

  it('checks the observation window with a small future tolerance', () => {
    expect(isAcceptableObservedAt(new Date(NOW - 60_000).toISOString(), NOW)).toBe(true);
    expect(isAcceptableObservedAt(new Date(NOW + 6 * 60_000).toISOString(), NOW)).toBe(false);
    expect(isAcceptableObservedAt(new Date(NOW - 24 * 60 * 60 * 1_000 - 1).toISOString(), NOW)).toBe(
      false
    );
  });

  it('creates a seven-character private reference', () => {
    const reference = iceReportReferenceFromBytes(new Uint8Array([0, 1, 2, 3, 4, 5, 6]));
    expect(reference).toMatch(/^C-[A-Z0-9]{7}$/);
    expect(reference).toHaveLength(9);
  });
});

describe('published public reports query', () => {
  it('reads only rows published now and not expired', async () => {
    const calls: unknown[][] = [];
    const builder = {} as Record<string, unknown>;

    for (const method of ['select', 'lte', 'gt', 'order', 'limit']) {
      builder[method] = vi.fn((...args: unknown[]) => {
        calls.push([method, ...args]);
        return builder;
      });
    }
    builder.then = (resolve: (value: { data: never[]; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve);

    const store = { from: vi.fn(() => builder) } as unknown as IceReportStore;
    await getPublishedIceReports(store, 7);

    expect(calls).toContainEqual(['select', '*']);
    expect(calls).toContainEqual(['lte', 'published_at', expect.any(String)]);
    expect(calls).toContainEqual(['gt', 'expires_at', expect.any(String)]);
    expect(calls).toContainEqual(['order', 'observed_at', { ascending: false }]);
    expect(calls).toContainEqual(['limit', 7]);
  });
});

describe('same-origin mutation guard', () => {
  it('accepts a matching origin', () => {
    const request = new Request('https://chapter.example/api/ice-reports', {
      method: 'POST',
      headers: { origin: 'https://chapter.example' },
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it('rejects a foreign or missing origin', () => {
    const foreign = new Request('https://chapter.example/api/ice-reports', {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
    });
    const missing = new Request('https://chapter.example/api/ice-reports', {
      method: 'POST',
    });
    expect(isSameOriginRequest(foreign)).toBe(false);
    expect(isSameOriginRequest(missing)).toBe(false);
  });
});
