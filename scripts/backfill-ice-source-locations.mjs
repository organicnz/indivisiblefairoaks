#!/usr/bin/env bun
/**
 * Fill city/state on already-published source reports using the preserved
 * source text and the verified city snapshot. Idempotent: it only scans rows
 * whose city is still null. Requires the server-only Supabase service key; it
 * never prints the key.
 */
import { backfillIceSourceLocations } from '../src/lib/ice-crawl-locations.ts';

try {
  const result = await backfillIceSourceLocations();
  console.log(JSON.stringify({ locations: result }, null, 2));
  if (result.updated !== result.matched) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Location backfill failed.');
  process.exitCode = 1;
}
