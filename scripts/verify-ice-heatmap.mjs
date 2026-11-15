#!/usr/bin/env bun
/**
 * Verify the /ice-alerts snapshot and its Supabase seed.
 *
 * The map is an immutable, release-pinned public dataset, so the failure this
 * guards against is silent drift: a city total changed without its metadata,
 * a generated migration that no longer matches the JSON, or a source file that
 * no longer matches the hash the page publishes.
 *
 *   bun run ice:verify
 *   bun run ice:verify --source
 *
 * `--source` fetches only the tiny Git LFS pointer from the DDP repository, not
 * the 36 MB Parquet file. It compares the pointer's oid to meta.sha256, which
 * is the same check performed when the release was accepted.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const snapshot = JSON.parse(
  await readFile(join(root, 'src/data/ice-arrest-heatmap.json'), 'utf8')
);
const migration = await readFile(
  join(root, 'supabase/migrations/20261115154500_ice_heatmap_snapshot.sql'),
  'utf8'
);
const { meta, cities } = snapshot;
const errors = [];

const total = cities.reduce((sum, city) => sum + city.count, 0);
const max = Math.max(...cities.map((city) => city.count));
const keys = new Set(cities.map((city) => `${city.city}|${city.stateCode}`));
const seededRows = (migration.match(/^  \('ddp-ice-2026-08-06',/gm) ?? []).length;

if (cities.length !== meta.mappedCities) {
  errors.push(`city rows ${cities.length} != mappedCities ${meta.mappedCities}`);
}
if (total !== meta.mappedRecords) {
  errors.push(`city total ${total} != mappedRecords ${meta.mappedRecords}`);
}
if (max !== meta.maxCityCount) {
  errors.push(`max city ${max} != maxCityCount ${meta.maxCityCount}`);
}
if (keys.size !== cities.length) {
  errors.push(`${cities.length - keys.size} duplicate city/state keys`);
}
if (meta.rawRecords - meta.duplicateRowsRemoved !== meta.records) {
  errors.push('raw records minus duplicates do not equal records');
}
if (meta.recordsWithUsCity + meta.recordsWithoutUsableCity !== meta.records) {
  errors.push('city-tagged plus unusable-city records do not equal records');
}
if (meta.mappedRecords + meta.unmappedCityRecords !== meta.recordsWithUsCity) {
  errors.push('mapped plus unmapped city records do not equal city-tagged records');
}
if (seededRows !== cities.length) {
  errors.push(`migration seeds ${seededRows} rows, snapshot has ${cities.length}`);
}
if (!migration.includes(meta.sha256)) {
  errors.push('migration does not include the source SHA-256');
}
if (!/^[0-9a-f]{64}$/.test(meta.sha256)) {
  errors.push('snapshot SHA-256 is not a 64-character lowercase hex digest');
}

for (const city of cities) {
  if (
    !Number.isFinite(city.lat) ||
    !Number.isFinite(city.lng) ||
    city.lat < -90 ||
    city.lat > 90 ||
    city.lng < -180 ||
    city.lng > 180
  ) {
    errors.push(`invalid coordinate for ${city.city}, ${city.stateCode}`);
    break;
  }
  if (!Number.isInteger(city.count) || city.count < 1) {
    errors.push(`invalid count for ${city.city}, ${city.stateCode}`);
    break;
  }
}

if (process.argv.includes('--source')) {
  const url =
    'https://raw.githubusercontent.com/deportationdata/ice/main/data/arrests-latest.parquet';
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    errors.push(`could not read source pointer: HTTP ${response.status}`);
  } else {
    const pointer = await response.text();
    const oid = pointer.match(/^oid sha256:([0-9a-f]{64})$/m)?.[1];
    if (!oid) {
      errors.push('source response is not a Git LFS pointer');
    } else if (oid !== meta.sha256) {
      errors.push(`source oid ${oid} != snapshot sha256 ${meta.sha256}`);
    } else {
      console.log(`Live source hash matched: ${oid}`);
    }
  }
}

if (errors.length > 0) {
  console.error('ICE heat-map verification failed:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log('ICE heat-map snapshot verified.');
console.log(`  ${cities.length.toLocaleString('en-US')} city points`);
console.log(`  ${total.toLocaleString('en-US')} mapped arrest records`);
console.log(`  highest city total: ${max.toLocaleString('en-US')}`);
console.log(`  source SHA-256: ${meta.sha256}`);
console.log(`  release: ${meta.periodStart} through ${meta.periodEnd}`);
