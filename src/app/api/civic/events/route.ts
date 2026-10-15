import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPublicClient, createServerClient } from '@/lib/supabase-server';

const eventSchema = z.object({
  slug: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  category: z.enum([
    'Meetings',
    'Resistance Choir',
    'Voter Mobilization',
    'Rallies & Street Action',
  ]),
  date_label: z.string().trim().min(1, 'Date label is required').max(100),
  time_label: z.string().trim().min(1, 'Time label is required').max(100),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  location_name: z.string().trim().max(200).default(''),
  address: z.string().trim().max(300).default(''),
  description: z.string().trim().default(''),
  rsvp_url: z.string().trim().max(500).default(''),
  highlight: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toBasicFormat(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/**
 * GET /api/civic/events
 * Fetches all civic events directly from the Supabase DB events table.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    const supabase = createPublicClient();
    let query = supabase
      .from('events')
      .select(
        'slug, title, category, date_label, time_label, starts_at, ends_at, location_name, address, description, rsvp_url, highlight, sort_order'
      )
      .order('sort_order', { ascending: true })
      .order('starts_at', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rawEvents = data ?? [];
    const formatted = rawEvents.map((row) => ({
      id: row.slug,
      slug: row.slug,
      title: row.title,
      category: row.category,
      dateLabel: row.date_label,
      timeLabel: row.time_label,
      isoDateStart: toBasicFormat(row.starts_at),
      isoDateEnd: toBasicFormat(row.ends_at),
      locationName: row.location_name,
      address: row.address,
      description: row.description,
      rsvpUrl: row.rsvp_url,
      highlight: Boolean(row.highlight),
      sortOrder: row.sort_order,
    }));

    return NextResponse.json(
      { success: true, events: formatted },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch events from database' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/civic/events
 * Admin-authenticated upsert of a civic event into Supabase DB events table.
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
    const parsed = eventSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid event payload' },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const finalSlug = payload.slug
      ? slugify(payload.slug)
      : slugify(payload.title) || `event-${Date.now()}`;

    const upsertRow = {
      slug: finalSlug,
      title: payload.title,
      category: payload.category,
      date_label: payload.date_label,
      time_label: payload.time_label,
      starts_at: payload.starts_at || null,
      ends_at: payload.ends_at || null,
      location_name: payload.location_name,
      address: payload.address,
      description: payload.description,
      rsvp_url: payload.rsvp_url,
      highlight: payload.highlight,
      sort_order: payload.sort_order,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await authClient
      .from('events')
      .upsert(upsertRow, { onConflict: 'slug' })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save event' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/civic/events
 * Admin-authenticated deletion of a civic event from Supabase DB events table.
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
    const slug = searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'Event slug is required' }, { status: 400 });
    }

    const { error } = await authClient.from('events').delete().eq('slug', slug);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedSlug: slug }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete event' },
      { status: 500 }
    );
  }
}
