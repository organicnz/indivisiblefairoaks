import { connection, type NextRequest, NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase-server';

/**
 * GET /api/gallery
 * Edge API endpoint returning photos from Supabase DB `gallery_photos` table.
 */
export async function GET(req: NextRequest) {
  // This handler reads `req.url` and must not run in the build-time prerender
  // pass. Without an explicit request-time signal Next attempts it, throws
  // NEXT_PRERENDER_INTERRUPTED, and the catch below reports that as a gallery
  // failure even though the route is dynamic. `connection()` is the same
  // boundary used by /api/geo and /api/health.
  await connection();

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category')?.slice(0, 120);
    // `Number(null)` is 0, so read presence explicitly: an absent parameter must
    // fall back to 100, not clamp the whole gallery to a single photo.
    const rawLimit = searchParams.get('limit');
    const requestedLimit = rawLimit === null ? Number.NaN : Number(rawLimit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(200, Math.max(1, Math.floor(requestedLimit)))
      : 100;

    const supabase = createPublicClient();
    let query = supabase
      .from('gallery_photos')
      .select(
        'id, slug, storage_path, caption, location, category, sign_quote, date_label, photographer, is_hero, is_pair, alt, sort_order'
      )
      .order('sort_order', { ascending: true })
      .limit(limit);

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Gallery query failed:', error);
      return NextResponse.json({ error: 'Failed to fetch gallery photos' }, { status: 500 });
    }

    const rows = data ?? [];
    const photos = rows.map((r) => {
      let url = '';
      if (r.storage_path) {
        if (r.storage_path.startsWith('http://') || r.storage_path.startsWith('https://')) {
          url = r.storage_path;
        } else {
          const { data: urlData } = supabase.storage.from('media').getPublicUrl(r.storage_path);
          url = urlData.publicUrl;
        }
      }
      return {
        id: r.slug,
        dbId: r.id,
        slug: r.slug,
        storage_path: r.storage_path,
        url,
        caption: r.caption,
        location: r.location,
        category: r.category,
        signQuote: r.sign_quote,
        date: r.date_label,
        photographer: r.photographer,
        is_hero: Boolean(r.is_hero),
        is_pair: Boolean(r.is_pair),
        alt: r.alt ?? undefined,
        sort_order: r.sort_order,
      };
    });

    return NextResponse.json(
      { success: true, photos },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    console.error('Gallery route failed:', err);
    return NextResponse.json({ error: 'Failed to fetch gallery photos' }, { status: 500 });
  }
}
