import { type NextRequest, NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase-server';

/**
 * GET /api/gallery
 * Edge API endpoint returning photos from Supabase DB `gallery_photos` table.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 200);

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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch gallery photos' },
      { status: 500 }
    );
  }
}
