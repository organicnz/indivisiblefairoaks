import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/rate-limit';
import { readJsonBodyWithLimit } from '@/lib/request-body';

const MAX_REQUEST_BYTES = 32_000;
// The edge function can spend up to 12s on its primary provider and another 12s
// on the fallback. A 15s proxy deadline aborted that second, valid attempt.
const FUNCTION_TIMEOUT_MS = 30_000;
// Keep the platform function alive for the full edge fallback window.
export const maxDuration = 30;

export async function POST(request: Request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) {
    return NextResponse.json({ error: 'Chat is temporarily unavailable.' }, { status: 503 });
  }
  const body = await readJsonBodyWithLimit(request, MAX_REQUEST_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      {
        error:
          body.code === 'too-large' ? 'Please send a shorter question.' : 'Invalid request.',
      },
      { status: body.code === 'too-large' ? 413 : 400 }
    );
  }

  try {
    const ip = clientIp(request.headers);
    const response = await fetch(`${base.replace(/\/$/, '')}/functions/v1/wall-e-chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
        // Edge functions see the Next server's socket, not the visitor's. Pass
        // the platform-validated address through so the database rate limit is
        // per visitor instead of one shared bucket for the whole site.
        ...(ip !== 'unknown' ? { 'x-real-ip': ip } : {}),
      },
      body: JSON.stringify(body.value),
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
    return NextResponse.json({ error: 'Chat is temporarily unavailable.' }, { status: 503 });
  }
}
