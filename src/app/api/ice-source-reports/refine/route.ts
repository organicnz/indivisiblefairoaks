import { connection, NextResponse } from 'next/server';
import {
  getIceCrawlStore,
  getSourceReportForRefinement,
  type IceSourceReportRefinementRow,
  saveSourceReportRefinement,
} from '@/lib/ice-crawl-store';
import { isSafeSourceDigest, refineSourceReportWithAi } from '@/lib/ice-source-refine';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { readJsonBodyWithLimit } from '@/lib/request-body';

export const maxDuration = 60;

const REPORT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_JSON_BODY_BYTES = 2_048;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;

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

  // This route can call the paid summarizer on a cache miss. Keep the local
  // gate ahead of the archive read so a flood cannot spend the AI budget even
  // when the edge function's own limiter is unavailable.
  const gate = rateLimit(
    clientKey(request.headers, 'ice-source-report-refine'),
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  );
  if (!gate.ok) {
    const response = json(
      {
        ok: false,
        code: 'rate-limited',
        message: 'Too many summary requests. Try again shortly.',
      },
      429
    );
    response.headers.set('Retry-After', String(gate.retryAfterSec));
    return response;
  }

  // The only body field is a report id. Refuse an oversized payload while it
  // streams instead of buffering it with `request.json()`.
  const read = await readJsonBodyWithLimit(request, MAX_JSON_BODY_BYTES);
  if (!read.ok) {
    return read.code === 'too-large'
      ? json({ ok: false, code: 'too-large', message: 'Request body is too large.' }, 413)
      : json({ ok: false, code: 'invalid-request', message: 'Invalid request.' }, 400);
  }

  const body = read.value;
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

  /*
   * The cache predates this validator and is writable by earlier code. Do not
   * serve a stored digest merely because it exists: if the model's old output
   * copied the publisher, opening the panel must regenerate it. Falling through
   * is deliberately fail-closed — if the endpoint cannot produce a safer digest,
   * the caller gets an error and the original-source link, never the copied
   * cache entry.
   */
  if (report.refined_text && isSafeSourceDigest(report.text_content, report.refined_text)) {
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
