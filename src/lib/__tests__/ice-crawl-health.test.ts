// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildStaleCrawlAlerts,
  evaluateIceCrawlHealth,
  type IceCrawlHealthRow,
  type IceCrawlTickSourceResult,
  summarizeIceCrawlTick,
} from '@/lib/ice-crawl-health';
import { type IceCrawlStore, recordIceCrawlTick } from '@/lib/ice-crawl-store';
import type { IceCrawlSummary } from '@/lib/ice-crawl-types';

const NOW = Date.parse('2026-11-26T12:00:00Z');

function summary(overrides: Partial<IceCrawlSummary> = {}): IceCrawlSummary {
  return {
    status: 'ok',
    pagesFetched: 1,
    reportsFound: 0,
    discovered: 0,
    skipped: 0,
    errors: [],
    note: '',
    ...overrides,
  };
}

function healthRow(overrides: Partial<IceCrawlHealthRow> = {}): IceCrawlHealthRow {
  return {
    last_source_crawl_at: '2026-11-26T11:50:00Z',
    last_source_crawl_status: 'ok',
    last_source_crawl_reports: 4,
    last_source_crawl_attempt_at: '2026-11-26T11:50:00Z',
    last_discovery_at: '2026-11-26T11:45:00Z',
    last_scan_at: '2026-11-26T11:45:00Z',
    active_alerts: [],
    active_alert_count: 0,
    checked_at: '2026-11-26T12:00:00Z',
    ...overrides,
  };
}

function fakeStore() {
  const ticks: Array<Record<string, unknown>> = [];
  const updates: Array<{ patch: Record<string, unknown>; fingerprints: string[] }> = [];

  const store = {
    from(table: string) {
      if (table === 'ice_crawl_ticks') {
        return {
          insert: async (row: Record<string, unknown>) => {
            ticks.push(row);
            return { error: null };
          },
        };
      }
      if (table === 'ice_operational_alerts') {
        return {
          update: (patch: Record<string, unknown>) => ({
            in: (_column: string, fingerprints: string[]) => ({
              is: async () => {
                updates.push({ patch, fingerprints });
                return { error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as IceCrawlStore;

  return { store, ticks, updates };
}

describe('summarizeIceCrawlTick', () => {
  it('records an all-ok rotation with summed reports', () => {
    const results: IceCrawlTickSourceResult[] = [
      { source: 'Alpha', summary: summary({ reportsFound: 4 }) },
      { source: 'Beta', summary: summary({ reportsFound: 3 }) },
    ];

    expect(summarizeIceCrawlTick(results)).toEqual({
      status: 'ok',
      sources: 2,
      reports: 7,
      errors: [],
    });
  });

  it('degrades when any source errors or is partial', () => {
    const results: IceCrawlTickSourceResult[] = [
      { source: 'Alpha', summary: summary({ reportsFound: 2 }) },
      {
        source: 'Beta',
        summary: summary({ status: 'partial', reportsFound: 1, errors: ['feed timeout'] }),
      },
      { source: 'Gamma', summary: { error: 'connection reset' } },
    ];

    const tick = summarizeIceCrawlTick(results);
    expect(tick.status).toBe('degraded');
    expect(tick.reports).toBe(3);
    expect(tick.errors).toEqual(['Beta: feed timeout', 'Gamma: connection reset']);
  });

  it('fails when every source errored', () => {
    const results: IceCrawlTickSourceResult[] = [
      { source: 'Alpha', summary: { error: 'blocked' } },
      { source: 'Beta', summary: summary({ status: 'error', errors: ['http 503'] }) },
    ];

    expect(summarizeIceCrawlTick(results).status).toBe('failed');
  });

  it('treats a blocked source as degraded', () => {
    const results: IceCrawlTickSourceResult[] = [
      { source: 'Alpha', summary: summary({ status: 'blocked', note: 'robots.txt' }) },
      { source: 'Beta', summary: summary() },
    ];

    const tick = summarizeIceCrawlTick(results);
    expect(tick.status).toBe('degraded');
    expect(tick.errors).toEqual(['Alpha: robots.txt']);
  });

  it('skips an empty rotation and bounds recorded errors', () => {
    expect(summarizeIceCrawlTick([])).toEqual({
      status: 'skipped',
      sources: 0,
      reports: 0,
      errors: [],
    });

    const results: IceCrawlTickSourceResult[] = Array.from({ length: 25 }, (_, index) => ({
      source: `Source ${index}`,
      summary: { error: 'x'.repeat(400) },
    }));
    const tick = summarizeIceCrawlTick(results);
    expect(tick.errors).toHaveLength(20);
    expect(tick.errors[0].length).toBeLessThanOrEqual(300);
  });
});

describe('evaluateIceCrawlHealth', () => {
  it('reports both schedules fresh and the newest successful tick', () => {
    const health = evaluateIceCrawlHealth(healthRow(), NOW);

    expect(health.status).toBe('ok');
    expect(health.lastSuccessfulTickAt).toBe('2026-11-26T11:50:00Z');
    expect(health.sourceCrawl.stale).toBe(false);
    expect(health.sourceCrawl.ageMinutes).toBe(10);
    expect(health.discovery.stale).toBe(false);
    expect(health.discovery.ageMinutes).toBe(15);
  });

  it('marks a stale source crawl without marking discovery stale', () => {
    const health = evaluateIceCrawlHealth(
      healthRow({ last_source_crawl_at: '2026-11-26T10:00:00Z' }),
      NOW
    );

    expect(health.status).toBe('stale');
    expect(health.sourceCrawl.stale).toBe(true);
    expect(health.discovery.stale).toBe(false);
    expect(health.sourceCrawl.lastStatus).toBe('ok');
  });

  it('treats a schedule that never succeeded as stale, while a missing view is unknown', () => {
    const never = evaluateIceCrawlHealth(healthRow({ last_source_crawl_at: null }), NOW);
    expect(never.status).toBe('stale');
    expect(never.sourceCrawl.stale).toBe(true);
    expect(never.lastSuccessfulTickAt).toBe('2026-11-26T11:45:00Z');

    const unknown = evaluateIceCrawlHealth(null, NOW);
    expect(unknown.status).toBe('unknown');
    expect(unknown.sourceCrawl.stale).toBe(false);
    expect(unknown.discovery.stale).toBe(false);
  });

  it('honors custom windows', () => {
    const row = healthRow({ last_source_crawl_at: '2026-11-26T10:50:00Z' });

    expect(evaluateIceCrawlHealth(row, NOW).sourceCrawl.stale).toBe(true);
    expect(evaluateIceCrawlHealth(row, NOW, { sourceCrawlMinutes: 90 }).sourceCrawl.stale).toBe(
      false
    );
  });
});

describe('buildStaleCrawlAlerts', () => {
  it('builds one clear alert per stale schedule', () => {
    const health = evaluateIceCrawlHealth(
      healthRow({
        last_source_crawl_at: '2026-11-26T09:00:00Z',
        last_discovery_at: '2026-11-26T08:00:00Z',
      }),
      NOW
    );
    const alerts = buildStaleCrawlAlerts(health);

    expect(alerts.map((alert) => alert.fingerprint)).toEqual([
      'stale-source-crawl',
      'stale-discovery',
    ]);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].message).toContain('limit 45m');
    expect(alerts[0].message).toContain('2026-11-26T09:00:00Z');
    expect(alerts[1].severity).toBe('warning');
    expect(alerts[1].message).toContain('limit 60m');
  });

  it('returns no alerts when both schedules are fresh or the view is unknown', () => {
    expect(buildStaleCrawlAlerts(evaluateIceCrawlHealth(healthRow(), NOW))).toEqual([]);
    expect(buildStaleCrawlAlerts(evaluateIceCrawlHealth(null, NOW))).toEqual([]);
  });
});

describe('recordIceCrawlTick', () => {
  it('writes the tick and reopens/resolves the source-crawl alert', async () => {
    const { store, ticks, updates } = fakeStore();

    await recordIceCrawlTick(
      store,
      [
        { source: 'Alpha', summary: summary({ reportsFound: 4 }) },
        { source: 'Beta', summary: summary({ reportsFound: 2 }) },
      ],
      1_000,
      61_000
    );

    expect(ticks).toEqual([
      {
        status: 'ok',
        started_at: new Date(1_000).toISOString(),
        finished_at: new Date(61_000).toISOString(),
        duration_ms: 60_000,
        sources: 2,
        reports: 6,
        errors: [],
      },
    ]);
    expect(updates).toHaveLength(1);
    expect(updates[0].fingerprints).toEqual(['stale-source-crawl']);
    expect(typeof updates[0].patch.resolved_at).toBe('string');
  });

  it('does not resolve the alert when the tick failed', async () => {
    const { store, ticks, updates } = fakeStore();

    await recordIceCrawlTick(store, [{ source: 'Alpha', summary: { error: 'blocked' } }], 0, 10);

    expect(ticks[0].status).toBe('failed');
    expect(updates).toEqual([]);
  });
});
