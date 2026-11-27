import { revalidatePath, revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { recordAdminAudit } from '@/lib/admin-audit';
import { env } from '@/lib/env';
import { readJsonBodyWithLimit } from '@/lib/request-body';
import { createPublicClient } from '@/lib/supabase-server';

/** Bounded JSON bodies: these routes are reachable by admins, not the open internet. */
const MAX_JSON_BODY_BYTES = 64_000;

const dataPointSchema = z.object({
  key: z.string().trim().min(1, 'Key is required').max(120),
  value: z.string(),
  group_name: z.string().trim().default('general'),
  label: z.string().trim().default(''),
});

/**
 * GET /api/data-points
 * Public edge-cached endpoint returning raw data points as key-value pairs and rows.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const group = searchParams.get('group')?.slice(0, 60);
    const key = searchParams.get('key')?.slice(0, 120);

    // 1. In non-test environments, attempt to fetch from the deployed Supabase Edge Function
    const edgeBase = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
    const edgeKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (process.env.NODE_ENV !== 'test' && edgeBase && edgeKey) {
      try {
        const edgeUrl = new URL(`${edgeBase}/functions/v1/data-points`);
        if (key) edgeUrl.searchParams.set('key', key);
        else if (group) edgeUrl.searchParams.set('group', group);

        const edgeRes = await fetch(edgeUrl.toString(), {
          headers: {
            apikey: edgeKey,
            Authorization: `Bearer ${edgeKey}`,
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(6_000),
        });

        if (edgeRes.ok) {
          const json = await edgeRes.json();
          if (json?.dataPoints) {
            return NextResponse.json(
              { success: true, dataPoints: json.dataPoints, rows: json.rows || [] },
              {
                status: 200,
                headers: {
                  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
                },
              }
            );
          }
        }
      } catch {
        // Fall back to direct database query below
      }
    }

    const supabase = createPublicClient();
    let query = supabase.from('data_points').select('key, value, group_name, label, updated_at');

    if (key) {
      query = query.eq('key', key);
    } else if (group) {
      const lower = group.toLowerCase();
      const aliases: Record<string, string[]> = {
        link: ['links', 'link'],
        links: ['links', 'link'],
        faq: ['faqs', 'faq'],
        faqs: ['faqs', 'faq'],
        partner: ['partners', 'partner'],
        partners: ['partners', 'partner'],
        term: ['terms', 'term'],
        terms: ['terms', 'term'],
      };
      const groups = aliases[lower] || [group];
      if (groups.length === 1) {
        query = query.eq('group_name', groups[0]);
      } else {
        query = query.in('group_name', groups);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('Data points query failed:', error);
      return NextResponse.json({ error: 'Failed to fetch data points' }, { status: 500 });
    }

    const rows = data ?? [];
    const dataPoints: Record<string, string> = {};
    for (const r of rows) {
      dataPoints[r.key] = r.value;
    }

    return NextResponse.json(
      { success: true, dataPoints, rows },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    console.error('Data points route failed:', err);
    return NextResponse.json({ error: 'Failed to fetch data points' }, { status: 500 });
  }
}

/**
 * POST /api/data-points
 * Admin-authenticated upsert of a single data point into Supabase DB data_points table.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminApi();
    if (!auth.ok) {
      return NextResponse.json(
        {
          error: auth.error,
          ...(auth.mfaRequired ? { mfaRequired: true } : {}),
          ...(auth.mfaEnrollmentRequired ? { mfaEnrollmentRequired: true } : {}),
        },
        { status: auth.status }
      );
    }

    const body = await readJsonBodyWithLimit(req, MAX_JSON_BODY_BYTES);
    if (!body.ok) {
      return NextResponse.json(
        { error: body.code === 'too-large' ? 'Request body is too large.' : 'Invalid JSON body.' },
        { status: body.code === 'too-large' ? 413 : 400 }
      );
    }
    const json = body.value;
    const parsed = dataPointSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid data point payload' },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const upsertRow = {
      key: payload.key,
      value: payload.value,
      group_name: payload.group_name || 'general',
      label: payload.label || payload.key,
      updated_at: new Date().toISOString(),
    };
    const auditSave = (
      outcome: 'success' | 'failure',
      targetLabel: string,
      after: unknown,
      error?: string
    ) =>
      recordAdminAudit(auth.session.adminClient, {
        actorUserId: auth.session.adminUserId,
        actorEmail: auth.session.adminEmail,
        action: 'data_point.save',
        targetType: 'data_point',
        targetId: payload.key,
        targetLabel,
        before: null,
        after,
        mfaLevel: auth.session.mfaLevel,
        outcome,
        error: error ?? null,
      });

    // The write goes straight to the database, with no service-key hop through
    // the `data-points` edge function.
    //
    // That hop used to run first, and it was pure duplication: this handler has
    // already authenticated the user and checked `profiles.is_admin`, and RLS
    // enforces `is_admin()` again on INSERT and UPDATE. What the hop added was a
    // network round trip, an 8s timeout, a second code path that could drift
    // from this one, and an edge function holding the service-role key with a
    // write branch nothing else called. Removing it means `data_points` is
    // writable by exactly one path, and that path cannot bypass RLS.
    //
    // The two checks agree for every current admin: `is_admin()` matches
    // `profiles.user_id = auth.uid()`, and every admin row has `user_id` set and
    // equal to `id`. The `.or()` above stays as a legacy-row tolerance.
    const { data, error } = await auth.session.supabase
      .from('data_points')
      .upsert(upsertRow, { onConflict: 'key' })
      .select('*')
      .single();

    if (error) {
      await auditSave('failure', upsertRow.label, upsertRow, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const saved = (data ?? null) as { label?: string } | null;
    await auditSave('success', saved?.label ?? upsertRow.label, data ?? upsertRow);

    try {
      // `revalidateTag(tag, profile)` is stale-while-revalidate, not expiry:
      // with the `hours` profile Next records `stale = now` but
      // `expired = now + 24h`, so the next request serves the old value and
      // refreshes behind it. An admin edit has to be on the next page load,
      // and `updateTag` is server-action-only, so `{ expire: 0 }` is the
      // route-handler spelling of immediate expiry.
      revalidateTag('data-points', { expire: 0 });
      // Link Tree and Partners copy lives in the same data_points table, so
      // editing either group must refresh those routes too, not just home.
      revalidatePath('/');
      revalidatePath('/links');
      revalidatePath('/partners');
      // The moved 2026 voter guides are prerendered on /archive, which carries
      // its own 15-minute ISR window. The tag expires the cached data entry;
      // the path expires the page that embedded it.
      revalidatePath('/archive');
    } catch {
      // Revalidation may throw outside request lifecycle or in tests
    }

    return NextResponse.json({ success: true, dataPoint: data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save data point' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/data-points
 * Admin-authenticated deletion of a data point by key.
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdminApi();
    if (!auth.ok) {
      return NextResponse.json(
        {
          error: auth.error,
          ...(auth.mfaRequired ? { mfaRequired: true } : {}),
          ...(auth.mfaEnrollmentRequired ? { mfaEnrollmentRequired: true } : {}),
        },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key')?.slice(0, 120);

    if (!key) {
      return NextResponse.json({ error: 'key parameter required' }, { status: 400 });
    }

    const auditDelete = (outcome: 'success' | 'failure', after: unknown, error?: string) =>
      recordAdminAudit(auth.session.adminClient, {
        actorUserId: auth.session.adminUserId,
        actorEmail: auth.session.adminEmail,
        action: 'data_point.delete',
        targetType: 'data_point',
        targetId: key,
        targetLabel: key,
        before: null,
        after,
        mfaLevel: auth.session.mfaLevel,
        outcome,
        error: error ?? null,
      });

    const { error } = await auth.session.supabase.from('data_points').delete().eq('key', key);
    if (error) {
      await auditDelete('failure', null, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await auditDelete('success', { deleted: true });

    try {
      // Immediate expiry, for the reason on POST: the `hours` profile would
      // serve one more stale page before the deletion became visible.
      revalidateTag('data-points', { expire: 0 });
      // Link Tree and Partners copy lives in the same data_points table, so
      // editing either group must refresh those routes too, not just home.
      revalidatePath('/');
      revalidatePath('/links');
      revalidatePath('/partners');
      revalidatePath('/archive');
    } catch {
      // Revalidation may throw outside request lifecycle or in tests
    }

    return NextResponse.json({ success: true, deleted: key }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete data point' },
      { status: 500 }
    );
  }
}
