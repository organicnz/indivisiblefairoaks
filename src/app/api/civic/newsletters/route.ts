import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPublicClient, createServerClient } from '@/lib/supabase-server';

const newsletterSchema = z.object({
  slug: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  date_label: z.string().trim().min(1, 'Date label is required').max(100),
  description: z.string().trim().default(''),
  topics: z.array(z.string().trim()).default([]),
  sort_order: z.number().int().default(0),
  published_at: z.string().nullable().optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * GET /api/civic/newsletters
 * Fetches all chapter newsletters directly from Supabase DB newsletters table.
 */
export async function GET() {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('newsletters')
      .select('slug, title, date_label, description, topics, sort_order, published_at, created_at')
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, newsletters: data ?? [] },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch newsletters from database' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/civic/newsletters
 * Admin-authenticated upsert of a newsletter into Supabase DB newsletters table.
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
    const parsed = newsletterSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid newsletter payload' },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const finalSlug = payload.slug
      ? slugify(payload.slug)
      : slugify(payload.title) || `newsletter-${Date.now()}`;

    const upsertRow = {
      slug: finalSlug,
      title: payload.title,
      date_label: payload.date_label,
      description: payload.description,
      topics: payload.topics,
      sort_order: payload.sort_order,
      published_at: payload.published_at || new Date().toISOString(),
    };

    const { data, error } = await authClient
      .from('newsletters')
      .upsert(upsertRow, { onConflict: 'slug' })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, newsletter: data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save newsletter' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/civic/newsletters
 * Admin-authenticated deletion of a newsletter from Supabase DB newsletters table.
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
      return NextResponse.json({ error: 'Newsletter slug is required' }, { status: 400 });
    }

    const { error } = await authClient.from('newsletters').delete().eq('slug', slug);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedSlug: slug }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete newsletter' },
      { status: 500 }
    );
  }
}
