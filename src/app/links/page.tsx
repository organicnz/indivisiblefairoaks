import type { Metadata } from 'next';
import { LinksArchiveCta } from '@/components/links/LinksArchiveCta';
import { LinksMasthead } from '@/components/links/LinksMasthead';
import { LINKS_DATA } from '@/components/links/links-fallback';
import { InteractiveLinksDirectory } from '@/components/ui/InteractiveLinksDirectory';
import { pageMetadata } from '@/lib/metadata';
import { getCoalitionLinks, getDataPoints } from '@/lib/queries/civic';

// "Link Tree" is the public name leadership requested in issue #164. The
// broadsheet redesign substituted "Coalition & Action Directory" without a
// recorded rename request, so the approved name is restored here.
export const metadata: Metadata = pageMetadata({
  title: 'Link Tree & Civic Directory',
  description:
    'Official chapter Link Tree, recommended civic resources, grassroots coalition partners, voter registration links, and democracy defense organizations in California.',
  path: '/links',
});

export default async function LinksPage() {
  const dataPoints = await getDataPoints('links');

  // Supabase is the source of truth; the inline directory is a fallback for
  // pre-migration deploys and DB outages.
  let items = LINKS_DATA;
  try {
    const rows = await getCoalitionLinks();
    if (rows.length > 0)
      items = rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        category: r.category,
        url: r.url,
        description: r.description,
        badge: r.badge ?? undefined,
      }));
  } catch {
    // fall through to LINKS_DATA
  }

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <LinksMasthead dataPoints={dataPoints} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        <InteractiveLinksDirectory initialLinks={items} initialData={dataPoints} />
        <LinksArchiveCta />
      </div>
    </div>
  );
}
