import { cmsSlugForPath, type EditContextResponse, editUrlForContentId } from './edit-target';

/**
 * Resolve the editorial button's context for a pathname (server half).
 *
 * Split from the route handler so the decision table is unit-testable without
 * a Next.js runtime: the route injects the real admin check and lookup, tests
 * inject fakes. Deliberately dependency-shaped rather than importing
 * `admin-auth` directly — importing a server module here would drag
 * `next/headers` into every test that touches the contract.
 */

export interface EditContextDeps {
  isAdmin: () => Promise<boolean>;
  findContentBySlug: (
    slug: string
  ) => Promise<{ id: number; title: string; status: string } | null>;
}

/**
 * Admin first, data second: a non-admin learns nothing about which slugs
 * exist, and an admin on a non-CMS page costs no database read at all.
 */
export async function resolveEditContext(
  pathname: string | null | undefined,
  deps: EditContextDeps
): Promise<EditContextResponse> {
  if (!(await deps.isAdmin())) return { isAdmin: false, target: null };
  const slug = cmsSlugForPath(pathname);
  if (!slug) return { isAdmin: true, target: null };
  const row = await deps.findContentBySlug(slug);
  if (!row) return { isAdmin: true, target: null };
  return {
    isAdmin: true,
    target: {
      kind: 'cms',
      editUrl: editUrlForContentId(row.id),
      label: row.title,
      status: row.status,
    },
  };
}
