import { connection, NextResponse } from 'next/server';
import {
  getIceCrawlStore,
  getPublishedSourceReportCitySummary,
} from '@/lib/ice-crawl-store';
import {
  iceSourceReportDisplayTitle,
  normalizeIceSourceReportCity,
} from '@/lib/ice-source-report-search';
import { US_STATE_CODES } from '@/lib/rapid-city-match';

export const maxDuration = 15;

function json(body: unknown, status = 200, cache = true) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': cache
        ? 'public, s-maxage=120, stale-while-revalidate=600'
        : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * A city-level index of the public web-source archive. This deliberately
 * returns metadata only: no source text, raw export title, or street address is
 * sent to the browser for the city-watch panel.
 */
export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const city = normalizeIceSourceReportCity(url.searchParams.get('city'));
  const stateCode = (url.searchParams.get('state') ?? '').trim().toUpperCase();

  if (!city || !US_STATE_CODES.has(stateCode)) {
    return json(
      {
        ok: false,
        code: 'invalid-place',
        message: 'Provide a U.S. city and state.',
      },
      400,
      false
    );
  }

  const store = getIceCrawlStore();
  if (!store) {
    return json(
      {
        ok: false,
        code: 'not-configured',
        message: 'The public source-report dataset is not configured on this deployment.',
      },
      503,
      false
    );
  }

  try {
    const { total, recent } = await getPublishedSourceReportCitySummary(
      store,
      city,
      stateCode,
      6
    );

    return json({
      ok: true,
      dataset: 'ice-source-report-city-summary',
      generatedAt: new Date().toISOString(),
      city,
      stateCode,
      total,
      recent: recent.map((report) => ({
        id: report.id,
        displayTitle: iceSourceReportDisplayTitle(report),
        sourceName: report.source_name,
        sourceUrl: report.source_url,
        publishedAt: report.source_published_at ?? report.published_at,
        kind: report.kind,
        extractionMethod: report.extraction_method,
      })),
    });
  } catch (error) {
    console.warn(
      'ICE source-report city summary failed',
      error instanceof Error ? error.message : 'unknown error'
    );
    return json(
      {
        ok: false,
        code: 'unavailable',
        message: 'The public source-report dataset is temporarily unavailable.',
      },
      500,
      false
    );
  }
}
