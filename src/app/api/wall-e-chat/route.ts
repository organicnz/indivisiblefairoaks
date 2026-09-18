import { NextResponse } from 'next/server';

const MAX_REQUEST_BYTES = 32_000;
const FUNCTION_TIMEOUT_MS = 15_000;

export async function POST(request: Request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) {
    return NextResponse.json({ error: 'Chat is temporarily unavailable.' }, { status: 503 });
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Please send a shorter question.' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/functions/v1/wall-e-chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
        'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
      },
      body: JSON.stringify(body),
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
