import { revalidatePath, revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { createPublicClient, createServerClient } from '@/lib/supabase-server';

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
    const group = searchParams.get('group');
    const key = searchParams.get('key');

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
      query = query.eq('group_name', group);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch data points' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-points
 * Admin-authenticated upsert of a single data point into Supabase DB data_points table.
 */
export async function POST(req: NextRequest) {
  try {
    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { data: profile } = await authClient
      .from('profiles')
      .select('is_admin')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }

    const json = await req.json();
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

    // Attempt to update via Supabase Edge Function if available
    const edgeBase = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
    const serviceRoleKey = env.SUPABASE_SECRET_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (process.env.NODE_ENV !== 'test' && edgeBase && serviceRoleKey) {
      try {
        const edgeRes = await fetch(`${edgeBase}/functions/v1/data-points`, {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(upsertRow),
          signal: AbortSignal.timeout(8_000),
        });

        if (edgeRes.ok) {
          const edgeJson = await edgeRes.json();
          try {
            revalidateTag('data-points', 'hours');
            revalidatePath('/');
          } catch {
            // Revalidation outside request lifecycle
          }
          return NextResponse.json(
            { success: true, dataPoint: edgeJson.record || upsertRow },
            { status: 200 }
          );
        }
      } catch {
        // Fall back to direct database upsert below
      }
    }

    const { data, error } = await authClient
      .from('data_points')
      .upsert(upsertRow, { onConflict: 'key' })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      revalidateTag('data-points', 'hours');
      revalidatePath('/');
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
    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { data: profile } = await authClient
      .from('profiles')
      .select('is_admin')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'key parameter required' }, { status: 400 });
    }

    const { error } = await authClient.from('data_points').delete().eq('key', key);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      revalidateTag('data-points', 'hours');
      revalidatePath('/');
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
