import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/admin-auth';
import { resolveEditContext } from '@/lib/edit-context';
import { getPublishedContent } from '@/lib/queries/content';

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
 */
export async function GET(req: Request) {
  const pathname = new URL(req.url).searchParams.get('path') ?? '/';
  return NextResponse.json(
    await resolveEditContext(pathname, {
      isAdmin: () => isAdminUser(),
      findContentBySlug: async (slug) => {
        const row = await getPublishedContent(slug);
        if (!row) return null;
        // Narrowed, not cast: a null title must read as the slug, never as
        // the string "null" in a tooltip.
        return {
          id: row.id,
          title: typeof row.title === 'string' && row.title ? row.title : slug,
          status: typeof row.status === 'string' ? row.status : 'draft',
        };
      },
    })
  );
}
