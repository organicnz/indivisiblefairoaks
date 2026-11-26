// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import heatmap from '@/data/ice-arrest-heatmap.json';

/**
 * The /ice-alerts map reads Supabase at runtime. This JSON is the release
 * fixture used to seed and verify that backend copy, so nothing else forces it
 * to agree with its own metadata. These assertions pin the published release
 * totals and the invariants the map depends on: every city key is unique, every
 * point is a real coordinate, and the 8,599 city totals add up to all 760,248
 * mapped arrest records. The Supabase migration is checked for the same row
 * count and source hash so the queryable backend copy cannot drift from the
 * fixture.
 */
describe('verified ICE heat-map snapshot', () => {
  const { meta, cities } = heatmap;
  const totalMapped = cities.reduce((total, city) => total + city.count, 0);

  it('pins the verified DDP release and source hash', () => {
    expect(meta.periodStart).toBe('2022-10-01');
    expect(meta.periodEnd).toBe('2026-08-06');
    expect(meta.releaseCheckedAt).toBe('2026-11-15');
    expect(meta.license).toBe('CC0 1.0');
    expect(meta.sha256).toBe('9aa0d48232805380057475c48d5953277c14307c6ddaef79b2ad28fb4d84a8a5');
    expect(meta.sourceUrl).toContain('deportationdata.org/data/processed/ice.html');
    expect(meta.sourceDataUrl).toContain('github.com/deportationdata/ice');
  });

  it('contains every mapped city, and their totals equal the mapped records', () => {
    expect(cities).toHaveLength(8_599);
    expect(meta.mappedCities).toBe(cities.length);
    expect(totalMapped).toBe(760_248);
    expect(meta.mappedRecords).toBe(totalMapped);
    expect(Math.max(...cities.map((city) => city.count))).toBe(meta.maxCityCount);
  });

  it('keeps the record accounting internally consistent', () => {
    expect(meta.rawRecords - meta.duplicateRowsRemoved).toBe(meta.records);
    expect(meta.recordsWithUsCity + meta.recordsWithoutUsableCity).toBe(meta.records);
    expect(meta.mappedRecords + meta.unmappedCityRecords).toBe(meta.recordsWithUsCity);
    expect(meta.mappedShareOfCityTagged).toBeCloseTo(760_248 / 778_367, 3);
    expect(meta.mappedShareOfAll).toBeCloseTo(760_248 / 886_369, 3);
  });

  it('has one unique city/state key and no placeholder rows', () => {
    const keys = cities.map((city) => `${city.city}|${city.stateCode}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(cities.every((city) => city.city.trim().length > 0)).toBe(true);
    expect(cities.every((city) => /^[A-Z]{2}$/.test(city.stateCode))).toBe(true);
    expect(
      cities.filter((city) => /sample|\bdemo\b|\bfake\b|placeholder|test city/i.test(city.city))
    ).toEqual([]);
  });

  it('gives every city a real coordinate and a positive integer count', () => {
    for (const city of cities) {
      expect(Number.isFinite(city.lat)).toBe(true);
      expect(Number.isFinite(city.lng)).toBe(true);
      expect(city.lat).toBeGreaterThanOrEqual(-90);
      expect(city.lat).toBeLessThanOrEqual(90);
      expect(city.lng).toBeGreaterThanOrEqual(-180);
      expect(city.lng).toBeLessThanOrEqual(180);
      expect(Number.isInteger(city.count)).toBe(true);
      expect(city.count).toBeGreaterThan(0);
    }
  });

  it('is sorted for the ranked city list and includes the local cities', () => {
    expect(
      cities.every((city, index) => index === 0 || cities[index - 1].count >= city.count)
    ).toBe(true);
    expect(cities[0]).toMatchObject({ city: 'Conroe', stateCode: 'TX', count: 29_537 });
    expect(cities).toContainEqual(
      expect.objectContaining({ city: 'Sacramento', stateCode: 'CA', count: 728 })
    );
    expect(cities).toContainEqual(
      expect.objectContaining({ city: 'Carmichael', stateCode: 'CA', count: 11 })
    );
  });

  it('seeds the Supabase migration with the same rows and hash', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20261115154500_ice_heatmap_snapshot.sql'),
      'utf8'
    );
    const seededRows = migration.match(/^ {2}\('ddp-ice-2026-08-06',/gm) ?? [];
    expect(seededRows).toHaveLength(cities.length);
    expect(migration).toContain(meta.sha256);
    expect(migration).toContain('760248');
  });
});
