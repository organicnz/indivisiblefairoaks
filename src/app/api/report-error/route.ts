import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { errorFingerprint, errorReportSchema } from '@/lib/error-report';
import { clientKey, rateLimit } from '@/lib/rate-limit';

export const runtime = 'edge';

/**
 * Error beacon landing zone. Writes one row to error_reports via direct
 * PostgREST (anon insert-only RLS) — no session resolution, no cookies read,
 * and a 204 even when the insert fails so telemetry never disturbs the client.
 *
 * Abuse posture: 5 reports / 10 min / IP (in-memory, per isolate) + strict
 * zod bounds + server-computed fingerprint. The table exposes no read path
 * to anon, so this endpoint cannot be used to exfiltrate anything.
 */
export async function POST(req: Request) {
  const gate = rateLimit(clientKey(req.headers, 'report-error'), 5, 600_000);
  if (!gate.ok) {
    return NextResponse.json(
      { error: 'Too many error reports. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = errorReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid error report payload.' }, { status: 400 });
  }

  const report = parsed.data;
  const row = {
    fingerprint: await errorFingerprint(report.message, report.stack),
    digest: report.digest ?? null,
    message: report.message,
    stack: report.stack ?? null,
    component_stack: report.componentStack ?? null,
    path: report.path ?? null,
    category: report.category ?? 'other',
    user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
  };

  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/error_reports`, {
      method: 'POST',
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error('Error report insert failed:', res.status);
    }
  } catch (error) {
    // Swallowed by design — the client already got its ack.
    console.error('Error report insert threw:', error);
  }

  return new NextResponse(null, { status: 204 });
}
