import { type NextRequest, NextResponse } from 'next/server';
import { getVisualPageContext } from '@/lib/actions/visual';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { adminApiFailureResponse } from '@/lib/admin-api-response';

/**
 * GET /api/visual-edit/context
 * Edge API endpoint returning the full visual page context (content, revisions,
 * media assets, CRM stats, backend status) for visual editing.
 * Requires admin authentication.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminApi();
    if (!auth.ok) return adminApiFailureResponse(auth);

    const { searchParams } = new URL(req.url);
    const pathname = searchParams.get('pathname')?.slice(0, 2048) || undefined;
    const slug = searchParams.get('slug')?.slice(0, 120) || undefined;
    const contentIdParam = searchParams.get('contentId');
    let contentId: number | undefined;
    if (contentIdParam) {
      contentId = Number(contentIdParam);
      if (!Number.isInteger(contentId) || contentId <= 0) {
        return NextResponse.json({ error: 'Invalid content id' }, { status: 400 });
      }
    }

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
