import { connection, NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * Uptime-monitor anchor. Always evaluated at request time (connection()
 * opts out of prerendering under Cache Components) so the response reflects
 * live conditions, not build-time state.
 */
export async function GET() {
  await connection();

  const startedAt = Date.now();
  let db: 'up' | 'degraded' | 'down' = 'down';
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/products?select=id&limit=1`, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    db = res.ok ? 'up' : 'degraded';
  } catch {
    db = 'down';
  }

  const latencyMs = Date.now() - startedAt;
  const status = db === 'up' ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      checks: { database: db },
      latencyMs,
      timestamp: new Date().toISOString(),
    },
    { status: status === 'ok' ? 200 : 503 }
  );
}
