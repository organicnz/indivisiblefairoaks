import { type NextRequest, NextResponse } from 'next/server';
import { getContentBySlugForEdit, getContentForEdit, saveContent } from '@/lib/actions/content';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/visual-edit/content
 * Reads content row from Supabase DB by slug or numeric ID.
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
    const slug = searchParams.get('slug');
    const idParam = searchParams.get('id');

    if (idParam) {
      const id = Number(idParam);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: 'Invalid content id' }, { status: 400 });
      }
      const row = await getContentForEdit(id);
      return NextResponse.json({ content: row }, { status: 200 });
    }

    if (slug) {
      const row = await getContentBySlugForEdit(slug);
      return NextResponse.json({ content: row }, { status: 200 });
    }

    return NextResponse.json({ error: 'Either slug or id must be provided' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch content' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/visual-edit/content
 * Saves or updates content and records revision in Supabase DB with optimistic concurrency.
 * Requires admin authentication.
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const result = await saveContent(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save content' },
      { status: 500 }
    );
  }
}
