import { Suspense } from 'react';
import { ContentList } from '@/components/admin/content/ContentList';
import { getContentList } from '@/lib/actions/content';
import { requireAdmin } from '@/lib/admin-auth';
import { CONTENT_TYPES, type ContentType } from '@/lib/content';

export const instant = false;

const PAGE_SIZE = 25;

export async function generateMetadata() {
  return {
    title: 'Pages & Posts — Admin · Indivisible Fair Oaks',
    description:
      'Create, edit and publish the pages, posts and action items on the Indivisible Fair Oaks–Carmichael site.',
    robots: { index: false, follow: false },
  };
}

function isContentType(value: string): value is ContentType {
  return (CONTENT_TYPES as readonly string[]).includes(value);
}

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; q?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const status = params.status === 'publish' || params.status === 'draft' ? params.status : 'all';
  const type = params.type && isContentType(params.type) ? params.type : 'all';
  const query = (params.q ?? '').trim();
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const { rows, totalCount } = await getContentList({
    status,
    type,
    query,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    // useSearchParams needs a Suspense boundary under Cache Components.
    <Suspense fallback={<div className="py-16 text-center text-sm text-slate-500">Loading…</div>}>
      <ContentList
        initialRows={rows}
        initialTotal={totalCount}
        initialPage={page}
        pageSize={PAGE_SIZE}
      />
    </Suspense>
  );
}
