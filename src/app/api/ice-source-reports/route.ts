import { connection, NextResponse } from 'next/server';
import {
  getIceCrawlStore,
  getPublishedSourceReportCount,
  getPublishedSourceReports,
} from '@/lib/ice-crawl-store';
import { parseIceSourceReportFilters } from '@/lib/ice-source-report-search';

export const maxDuration = 30;

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...CORS,
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function positiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const filters = parseIceSourceReportFilters(url.searchParams);
  const perPage = positiveInt(url.searchParams.get('per_page'), DEFAULT_PER_PAGE, MAX_PER_PAGE);
  const requestedPage = positiveInt(url.searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER);

  const store = getIceCrawlStore();
  if (!store) {
    return json(
      {
        ok: false,
        code: 'not-configured',
        message: 'The public source-report dataset is not configured on this deployment.',
      },
      503
    );
  }

  try {
    const total = await getPublishedSourceReportCount(store, filters);
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const page = Math.min(requestedPage, totalPages);
    const reports =
      total > 0
        ? await getPublishedSourceReports(
            store,
            perPage,
            (page - 1) * perPage,
            filters
          )
        : [];

    return json({
      ok: true,
      dataset: 'ice-source-reports',
      generatedAt: new Date().toISOString(),
      total,
      page,
      perPage,
      totalPages,
      filters,
      attribution:
        'Source text remains attributed to its original publisher. Reports are not independently verified by Indivisible Fair Oaks-Carmichael. Do not use this data to identify, locate, or harass any person.',
      reports,
    });
  } catch {
    return json(
      {
        ok: false,
        code: 'unavailable',
        message: 'The public source-report dataset is temporarily unavailable.',
      },
      500
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS,
  });
}
