import { ContentEditor } from '@/components/admin/content/ContentEditor';
import { requireAdmin } from '@/lib/admin-auth';
import { CONTENT_TYPES, type ContentType } from '@/lib/content';
import { env } from '@/lib/env';

export const instant = false;

interface AdminContentNewPageProps {
  searchParams?: Promise<{ type?: string }>;
}

export async function generateMetadata({ searchParams }: AdminContentNewPageProps) {
  const params = await searchParams;
  const isPost = params?.type === 'post';
  return {
    title: `${isPost ? 'New Post' : 'New Page'} — Admin · Indivisible Fair Oaks`,
    description: 'Write and publish a new page, post or action item.',
    robots: { index: false, follow: false },
  };
}

export default async function AdminContentNewPage({ searchParams }: AdminContentNewPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const requestedType = params?.type as ContentType | undefined;
  const initialType: ContentType =
    requestedType && CONTENT_TYPES.includes(requestedType) ? requestedType : 'page';

  return (
    <ContentEditor
      siteHost={new URL(env.NEXT_PUBLIC_SITE_URL).host}
      initial={{
        title: '',
        slug: '',
        excerpt: null,
        publishedAt: null,
        metadata: null,
        // A new page starts as a draft. Creating something live by accident is
        // much harder to undo than promoting a draft afterwards.
        type: initialType,
        status: 'draft',
        body: null,
        featuredImage: null,
      }}
    />
  );
}
