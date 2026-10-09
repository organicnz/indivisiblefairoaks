import { NextResponse } from 'next/server';
import { resolveEditContext } from '@/lib/edit-context';
import { getPublishedContent } from '@/lib/queries/content';
import { createServerClient } from '@/lib/supabase-server';
import type { VisualEditTarget } from '@/types/crm';

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
 * Extended to also support visual editor sections: when the pathname matches
 * a visual editing context (e.g., a CMS slug route), the button will offer
 * both CMS editing and visual section toggling.
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

  if (cmsResponse.target) {
    const visualTarget: VisualEditTarget = {
      kind: 'visual-section',
      sectionId: `content-${cmsResponse.target.editUrl.split('/').pop()}`,
      title: cmsResponse.target.label,
      type: 'cms',
    };

    return NextResponse.json({
      isAdmin: true,
      target: cmsResponse.target,
      visualEditEnabled: true,
      visualEditTarget: visualTarget,
    });
  }

  return NextResponse.json({
    isAdmin: true,
    target: null,
    visualEditEnabled: true,
    visualEditTarget: null,
  });
}

/**
 * Type for visual edit target.
 */
export type { VisualEditTarget } from '@/types/crm';
