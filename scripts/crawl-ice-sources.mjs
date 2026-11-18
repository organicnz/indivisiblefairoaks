#!/usr/bin/env bun
/**
 * Run every enabled public source through the same crawler the admin UI uses.
 * Intended for the scheduled/manual fallback path when the web request cannot
 * be triggered (for example a missing CRON_SECRET). Requires the server-only
 * Supabase service key; it never prints the key.
 */
import { crawlAllIceSources } from '../src/lib/ice-crawl.ts';
import { discoverNationwideIceCandidates } from '../src/lib/ice-crawl-discovery.ts';
import { backfillIceSourceLocations } from '../src/lib/ice-crawl-locations.ts';
import {
  getIceCrawlStore,
  insertIceCrawlDiscoveries,
} from '../src/lib/ice-crawl-store.ts';

try {
  const locations = await backfillIceSourceLocations();

  // Discovery is intentionally separate from publication. Every candidate is
  // queued for an admin rights decision before the crawler fetches it.
  let discovery = null;
  try {
    const store = getIceCrawlStore();
    if (store) {
      const found = await discoverNationwideIceCandidates();
      discovery = {
        query: found.query,
        provider: found.provider,
        providers: found.providers,
        found: found.candidates.length,
        queued: await insertIceCrawlDiscoveries(store, found.candidates),
        errors: found.errors,
      };
    }
  } catch (error) {
    discovery = {
      error: error instanceof Error ? error.message : 'Nationwide discovery failed.',
    };
  }

  const results = await crawlAllIceSources();
  const summaries = results.map((result) => result.summary);
  const errors = summaries.filter(
    (summary) => 'error' in summary || summary.status === 'error'
  ).length;
  console.log(
    JSON.stringify(
      {
        locations,
        discovery,
        sources: results.length,
        reports: summaries.reduce(
          (total, summary) => total + ('reportsFound' in summary ? summary.reportsFound : 0),
          0
        ),
        errors,
        partial: summaries.filter(
          (summary) => 'status' in summary && summary.status === 'partial'
        ).length,
        summaries: results,
      },
      null,
      2
    )
  );
  if (errors > 0) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Crawler failed.');
  process.exitCode = 1;
}
