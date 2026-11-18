import { AdminNewsHeader } from '@/components/admin/news/AdminNewsHeader';
import { NewsPublishingGuide } from '@/components/admin/news/NewsPublishingGuide';
import { RecentNewsSection } from '@/components/admin/news/RecentNewsSection';
import { CivicNewsletterManager } from '@/components/admin/civic/CivicNewsletterManager';
import { getCivicNewslettersAdmin } from '@/lib/actions/civic';
import { getContentList } from '@/lib/actions/content';
import { requireAdminPage } from '@/lib/admin-auth';

export const instant = false;

export async function generateMetadata() {
  return {
    title: 'News & Bulletins — Admin · Indivisible Fair Oaks',
    description:
      'Write chapter news in the block editor, manage the bulletin archive, and edit published stories.',
    robots: { index: false, follow: false },
  };
}

export default async function AdminNewsPage() {
  await requireAdminPage();

  const [recentNews, newsletterResult] = await Promise.all([
    getContentList({ type: 'post', pageSize: 6 }),
    getCivicNewslettersAdmin(),
  ]);
  const initialNewsletters = newsletterResult.success ? (newsletterResult.data ?? []) : undefined;
  const now = Date.now();

  return (
    <div className="space-y-6">
      <AdminNewsHeader />

      <RecentNewsSection rows={recentNews.rows} now={now} />

      <div id="bulletin-manager" className="scroll-mt-28">
        <CivicNewsletterManager initialNewsletters={initialNewsletters} />
      </div>

      <NewsPublishingGuide />
    </div>
  );
}
