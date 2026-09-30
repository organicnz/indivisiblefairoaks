import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * Vercel cron entry point for the broadcast scheduler.
 *
 * vercel.json schedules this route every minute. It dispatches to the
 * `crm-broadcast-scheduler` Supabase Edge Function, which finds scheduled
 * broadcasts whose time has passed and sends them.
 *
 * The service key is passed as a Bearer token — the edge function requires it.
 */
export async function POST() {
  const functionUrl = env.CRM_BROADCAST_FUNCTION_URL;
  if (!functionUrl) {
    return NextResponse.json(
      { ok: false, error: 'CRM_BROADCAST_FUNCTION_URL is not configured' },
      { status: 503 }
    );
  }

  const key = env.SUPABASE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SECRET_KEY is not configured' },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      functionUrl.replace(/\/crm-broadcast-send$/, '/crm-broadcast-scheduler'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
        body: JSON.stringify({}),
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `scheduler responded ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'scheduler unreachable' },
      { status: 502 }
    );
  }
}
