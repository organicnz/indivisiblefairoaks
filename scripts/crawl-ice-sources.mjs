#!/usr/bin/env bun
/**
 * Run every enabled public source through the same crawler the admin UI uses.
 * Intended for the scheduled/manual fallback path when the web request cannot
 * be triggered (for example a missing CRON_SECRET). Requires the server-only
 * Supabase service key; it never prints the key.
 */
import { crawlAllIceSources } from '../src/lib/ice-crawl.ts';

try {
  const summaries = await crawlAllIceSources();
  console.log(
    JSON.stringify(
      {
        sources: summaries.length,
        reports: summaries.reduce((total, summary) => total + summary.reportsFound, 0),
        errors: summaries.filter((summary) => summary.status === 'error').length,
        partial: summaries.filter((summary) => summary.status === 'partial').length,
        summaries,
      },
      null,
      2
    )
  );
  if (summaries.some((summary) => summary.status === 'error')) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Crawler failed.');
  process.exitCode = 1;
}
