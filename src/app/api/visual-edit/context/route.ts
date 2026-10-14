import { type NextRequest, NextResponse } from 'next/server';
import { getVisualPageContext } from '@/lib/actions/visual';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/visual-edit/context
 * Edge API endpoint returning the full visual page context (content, revisions,
 * media assets, CRM stats, backend status) for visual editing.
 * Requires admin authentication.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const pathname = searchParams.get('pathname') || undefined;
    const slug = searchParams.get('slug') || undefined;
    const contentIdParam = searchParams.get('contentId');
    const contentId = contentIdParam ? Number(contentIdParam) : undefined;

    const context = await getVisualPageContext({
      pathname,
      slug,
      contentId,
    });

    return NextResponse.json(context, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load visual page context' },
      { status: 500 }
    );
  }
}
