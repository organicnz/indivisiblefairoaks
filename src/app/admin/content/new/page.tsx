import { ContentEditor } from '@/components/admin/content/ContentEditor';
import { requireAdmin } from '@/lib/admin-auth';
import { env } from '@/lib/env';

export const instant = false;

export async function generateMetadata() {
  return {
    title: 'New Page — Admin · Indivisible Fair Oaks',
    description: 'Write and publish a new page, post or action item.',
    robots: { index: false, follow: false },
  };
}

export default async function AdminContentNewPage() {
  await requireAdmin();
  return (
    <ContentEditor
      siteHost={new URL(env.NEXT_PUBLIC_SITE_URL).host}
      initial={{
        title: '',
        slug: '',
        excerpt: null,
        publishedAt: null,
        // A new page starts as a draft. Creating something live by accident is
        // much harder to undo than promoting a draft afterwards.
        type: 'page',
        status: 'draft',
        body: null,
        featuredImage: null,
      }}
    />
  );
}
