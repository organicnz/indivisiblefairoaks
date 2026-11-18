import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIp } from '@/lib/rate-limit';
import { readJsonBodyWithLimit } from '@/lib/request-body';
import { getIceHeatmapSnapshot } from '@/lib/queries/ice-heatmap';
const MAX_REQUEST_BYTES = 2_000;
// The edge function can spend up to 10s on its primary provider, 10s on the
// fallback and 6s on the Wikimedia image lookup in parallel.
const FUNCTION_TIMEOUT_MS = 30_000;
export const maxDuration = 30;

const requestSchema = z
  .object({
    city: z.string().trim().min(1).max(100),
    stateCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .transform((value) => value.toUpperCase()),
  })
  .strict();

function normalizeCity(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export async function POST(request: Request) {
  const body = await readJsonBodyWithLimit(request, MAX_REQUEST_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      { error: 'Invalid request.' },
      { status: body.code === 'too-large' ? 413 : 400 }
    );
  }

  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid city.' }, { status: 400 });
  }

  const snapshot = await getIceHeatmapSnapshot().catch(() => null);
  if (!snapshot) {
    return NextResponse.json(
      { error: 'City context is temporarily unavailable.' },
      { status: 503 }
    );
  }

  const cityIndex = snapshot.cities.findIndex(
    (candidate) =>
      candidate.stateCode.toUpperCase() === parsed.data.stateCode &&
      normalizeCity(candidate.city) === normalizeCity(parsed.data.city)
  );
  if (cityIndex < 0) {
    return NextResponse.json({ error: 'That city is not in this snapshot.' }, { status: 400 });
  }

  const city = snapshot.cities[cityIndex];
  const rank = cityIndex + 1;
  const sharePercent = Number(
    ((city.count / snapshot.meta.mappedRecords) * 100).toFixed(1)
  );

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) {
    return NextResponse.json(
      { error: 'City context is temporarily unavailable.' },
      { status: 503 }
    );
  }

  try {
    const ip = clientIp(request.headers);
    const response = await fetch(`${base.replace(/\/$/, '')}/functions/v1/ice-case-brief`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
        // The edge function sees this server's socket. Forward the visitor's
        // platform-validated address so its rate limit is not one shared bucket.
        ...(ip !== 'unknown' ? { 'x-real-ip': ip } : {}),
      },
      body: JSON.stringify({
        city: city.city,
        state: city.state,
        stateCode: city.stateCode,
        count: city.count,
        rank,
        sharePercent,
        mappedRecords: snapshot.meta.mappedRecords,
        periodStart: snapshot.meta.periodStart,
        periodEnd: snapshot.meta.periodEnd,
        sourceName: snapshot.meta.sourceName,
        sourceRelease: snapshot.meta.sourceRelease,
        sourceUrl: snapshot.meta.sourceUrl,
        sourceCitation: snapshot.meta.sourceCitation,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(FUNCTION_TIMEOUT_MS),
    });

    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        'cache-control': 'no-store',
        'content-type': response.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'City context is temporarily unavailable.' },
      { status: 503 }
    );
  }
}
