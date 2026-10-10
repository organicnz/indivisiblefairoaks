import { NextResponse } from 'next/server';
import { resolveEditContext } from '@/lib/edit-context';
import { getPublishedContent } from '@/lib/queries/content';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Editorial button context: is the caller an admin, and does this pathname
 * resolve to something editable?
 *
 * Read-only and admin-gated. The lookup reuses `getPublishedContent`, so the
 * button appears exactly when the public page exists — same row, same
 * visibility predicates, no second query shape to drift. The public client
 * suffices because a draft has no public page and therefore no button; this
 * keeps the service-role client out of the route entirely (see the
 * `admin-client-scope` guard). The destination (`/admin/*`) enforces MFA
 * step-up itself; this endpoint only decides whether the header offers the
 * door. Non-admins get `{ isAdmin: false }` with no database touch, and
 * signed-out browsers never call it at all (the hook short-circuits on a
 * missing session), so anonymous traffic costs nothing on the Fluid pool.
 *
 * `visualEditEnabled` says the caller may use the in-page overlay at all,
 * which is a property of being an admin rather than of the path: every page is
 * editable through the overlay, including ones with no CMS row, because the
 * overlay can extract a block model from the live DOM and write a new row.
 */
export async function GET(req: Request) {
  const pathname = new URL(req.url).searchParams.get('path') ?? '/';

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      isAdmin: false,
      target: null,
      visualEditEnabled: false,
      visualEditTarget: null,
    });
  }

  // Check admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .single();

  const isAdmin = profile?.is_admin === true;

  if (!isAdmin) {
    return NextResponse.json({
      isAdmin: false,
      target: null,
      visualEditEnabled: false,
      visualEditTarget: null,
    });
  }

  // Try to resolve as CMS content first
  const cmsResponse = await resolveEditContext(pathname, {
    isAdmin: () => Promise.resolve(isAdmin),
    findContentBySlug: async (slug) => {
      const row = await getPublishedContent(slug);
      if (!row) return null;
      return {
        id: row.id,
        title: typeof row.title === 'string' && row.title ? row.title : slug,
        status: typeof row.status === 'string' ? row.status : 'draft',
      };
    },
  });

  return NextResponse.json({
    isAdmin,
    target: cmsResponse.target,
    visualEditEnabled: true,
  });
}
