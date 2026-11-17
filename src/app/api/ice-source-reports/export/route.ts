import { connection, NextResponse } from 'next/server';
import {
  getIceCrawlStore,
  getPublishedSourceReportCount,
  getPublishedSourceReports,
} from '@/lib/ice-crawl-store';
import type { IceSourceReport } from '@/lib/ice-crawl-types';
import { serializeIceSourceReportsXml } from '@/lib/ice-source-report-export';
import { parseIceSourceReportFilters } from '@/lib/ice-source-report-search';

export const maxDuration = 60;

const CHUNK_SIZE = 1000;
const MAX_EXPORT_ROWS = 20_000;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
};

function errorJson(status: number, code: string, message: string) {
  return NextResponse.json(
    { ok: false, code, message },
    {
      status,
      headers: {
        ...CORS,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const format = (url.searchParams.get('format') ?? 'xml').trim().toLowerCase();
  if (format !== 'json' && format !== 'xml') {
    return errorJson(400, 'invalid-format', 'Choose format=json or format=xml.');
  }

  const filters = parseIceSourceReportFilters(url.searchParams);
  const store = getIceCrawlStore();
  if (!store) {
    return errorJson(
      503,
      'not-configured',
      'The public source-report dataset is not configured on this deployment.'
    );
  }

  try {
    const total = await getPublishedSourceReportCount(store, filters);
    if (total > MAX_EXPORT_ROWS) {
      return errorJson(
        413,
        'export-too-large',
        'This export is too large. Narrow it with q, kind, state, or city.'
      );
    }

    const reports: IceSourceReport[] = [];
    for (let offset = 0; offset < total; offset += CHUNK_SIZE) {
      const chunk = await getPublishedSourceReports(
        store,
        CHUNK_SIZE,
        offset,
        filters
      );
      if (chunk.length === 0) break;
      reports.push(...chunk);
    }

    const generatedAt = new Date().toISOString();
    const stamp = generatedAt.slice(0, 10);
    const attachment = `attachment; filename="ice-source-reports-${stamp}.${format}"`;
    const headers = {
      ...CORS,
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      'Content-Disposition': attachment,
      'X-Content-Type-Options': 'nosniff',
    };

    if (format === 'json') {
      return new NextResponse(
        JSON.stringify(
          {
            dataset: 'ice-source-reports',
            generatedAt,
            total: reports.length,
            filters,
            attribution:
              'Source text remains attributed to its original publisher. Reports are not independently verified by Indivisible Fair Oaks-Carmichael. Do not use this data to identify, locate, or harass any person.',
            reports,
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/json; charset=utf-8',
          },
        }
      );
    }

    return new NextResponse(
      serializeIceSourceReportsXml(reports, { generatedAt, filters }),
      {
        status: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/xml; charset=utf-8',
        },
      }
    );
  } catch {
    return errorJson(
      500,
      'unavailable',
      'The public source-report dataset is temporarily unavailable.'
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS,
  });
}
