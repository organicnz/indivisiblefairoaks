import { connection, NextResponse } from 'next/server';
import {
  getIceCrawlStore,
  getSourceReportForRefinement,
  saveSourceReportRefinement,
  type IceSourceReportRefinementRow,
} from '@/lib/ice-crawl-store';
import { refineSourceReportWithAi } from '@/lib/ice-source-refine';

export const maxDuration = 45;

const REPORT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * Return the cached, source-grounded digest for one published report. The
 * first request for a report calls the Supabase AI endpoint and stores the
 * result on the report row; later requests are a single database read.
 *
 * Raw `text_content` is deliberately never returned here. The public reading
 * panel must not turn into a republishing surface if the model is unavailable,
 * so the client falls back to the original-source link instead.
 */
export async function POST(request: Request) {
  await connection();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: 'invalid-request', message: 'Invalid request.' }, 400);
  }

  const id =
    body && typeof body === 'object' && 'id' in body && typeof body.id === 'string'
      ? body.id.trim()
      : '';
  if (!REPORT_ID.test(id)) {
    return json({ ok: false, code: 'invalid-report', message: 'Invalid report id.' }, 400);
  }

  const store = getIceCrawlStore();
  if (!store) {
    return json(
      {
        ok: false,
        code: 'not-configured',
        message: 'The source-report archive is not configured on this deployment.',
      },
      503
    );
  }

  let report: IceSourceReportRefinementRow | null;
  try {
    report = await getSourceReportForRefinement(store, id);
  } catch {
    return json(
      {
        ok: false,
        code: 'unavailable',
        message: 'The source report is temporarily unavailable.',
      },
      503
    );
  }

  if (!report) {
    return json({ ok: false, code: 'not-found', message: 'Source report not found.' }, 404);
  }

  if (report.refined_text) {
    return json({
      ok: true,
      text: report.refined_text,
      refinedAt: report.refined_at,
      cached: true,
    });
  }

  const refinement = await refineSourceReportWithAi({
    text: report.text_content,
    sourceUrl: report.source_url,
    sourceTitle: report.source_title ?? report.title,
  });

  if (!refinement) {
    return json(
      {
        ok: false,
        code: 'refinement-unavailable',
        message: 'The AI summary is temporarily unavailable.',
      },
      502
    );
  }

  if (!refinement.isReport) {
    return json(
      {
        ok: false,
        code: 'not-a-report',
        message: 'This source page does not contain a specific report to summarize.',
      },
      422
    );
  }

  const refinedAt = new Date().toISOString();
  try {
    await saveSourceReportRefinement(store, id, refinement.text, refinedAt);
  } catch (error) {
    // The digest is still safe and useful if the cache write loses a race or
    // the database is briefly unavailable. A later request will retry storage.
    console.error(
      '[ice-source-report-refine] cache write failed',
      error instanceof Error ? error.message : 'unknown-error'
    );
  }

  return json({
    ok: true,
    text: refinement.text,
    refinedAt,
    cached: false,
  });
}
