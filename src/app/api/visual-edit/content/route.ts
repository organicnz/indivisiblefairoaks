import { type NextRequest, NextResponse } from 'next/server';
import { getContentBySlugForEdit, getContentForEdit, saveContent } from '@/lib/actions/content';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { adminApiFailureResponse } from '@/lib/admin-api-response';

/**
 * GET /api/visual-edit/content
 * Reads content row from Supabase DB by slug or numeric ID.
 * Requires admin authentication.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminApi();
    if (!auth.ok) return adminApiFailureResponse(auth);

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
    const auth = await requireAdminApi();
    if (!auth.ok) return adminApiFailureResponse(auth);

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
