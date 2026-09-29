import { notFound } from 'next/navigation';
import { ContentEditor } from '@/components/admin/content/ContentEditor';
import { getContentForEdit } from '@/lib/actions/content';
import { requireAdmin } from '@/lib/admin-auth';
import { env } from '@/lib/env';

export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number.parseInt(id, 10);
  if (Number.isNaN(numericId)) {
    return {
      title: 'Page Not Found — Admin · Indivisible Fair Oaks',
      description: 'That page could not be found.',
      robots: { index: false, follow: false },
    };
  }
  const content = await getContentForEdit(numericId);
  return {
    title: `${content?.title ?? 'Edit page'} — Admin · Indivisible Fair Oaks`,
    description: `Edit the content, metadata and publication status of ${content?.title ?? 'this page'}.`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminContentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const numericId = Number.parseInt(id, 10);
  if (Number.isNaN(numericId)) notFound();

  const content = await getContentForEdit(numericId);
  if (!content) notFound();

  return (
    <ContentEditor
      // Derived on the server: reading window.location during render would
      // produce a hydration mismatch in the search preview.
      siteHost={new URL(env.NEXT_PUBLIC_SITE_URL).host}
      initial={{
        id: content.id,
        title: content.title,
        slug: content.slug,
        excerpt: content.excerpt,
        type: content.type ?? 'page',
        status: content.status ?? 'draft',
        body: content.body,
        featuredImage: content.featured_image,
      }}
    />
  );
}
