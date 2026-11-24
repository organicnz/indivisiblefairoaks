import type { Metadata } from 'next';
import { HomeChoir } from '@/components/home/HomeChoir';
import { HomeGalleryPreview } from '@/components/home/HomeGalleryPreview';
import { HomeGathering } from '@/components/home/HomeGathering';
import { HomeHero } from '@/components/home/HomeHero';
import { HomeNonviolence } from '@/components/home/HomeNonviolence';
import { HomePillars } from '@/components/home/HomePillars';
import { HomeQuickHits } from '@/components/home/HomeQuickHits';
import { HomeSupportCta } from '@/components/home/HomeSupportCta';
import { HomeVoterHub } from '@/components/home/HomeVoterHub';
import { CivicActionTicker } from '@/components/ui/CivicActionTicker';
import { pageMetadata } from '@/lib/metadata';
import { getHomePageData } from '@/lib/queries/home';

// NOTE: `page.tsx` and the root `layout.tsx` are the *same* App Router segment,
// and Next does not apply a segment's own `title.template` to that segment. The
// homepage therefore supplies an absolute title rather than a bare one.
export const metadata: Metadata = pageMetadata({
  title: 'Indivisible Fair Oaks-Carmichael | Grassroots Democracy in Action',
  description:
    'Join Indivisible Fair Oaks-Carmichael. We are a local grassroots chapter committed to resisting authoritarianism, defending democracy, and organizing our community.',
  path: '/',
});

export default async function HomePage() {
  const { galleryPhotos, tickerItems, card, dataPoints } = await getHomePageData();

  return (
    <div className="civic-page flex w-full flex-col">
      <HomeHero
        photos={galleryPhotos.filter((photo) => photo.is_hero || photo.is_pair)}
        dataPoints={dataPoints}
      />
      <HomeQuickHits dataPoints={dataPoints} />
      <CivicActionTicker items={tickerItems} initialData={dataPoints} />
      <HomeGathering card={card} dataPoints={dataPoints} />
      <HomePillars dataPoints={dataPoints} />
      <HomeChoir dataPoints={dataPoints} />
      <HomeVoterHub dataPoints={dataPoints} />
      <HomeGalleryPreview photos={galleryPhotos.slice(0, 6)} dataPoints={dataPoints} />
      <HomeNonviolence dataPoints={dataPoints} />
      <HomeSupportCta dataPoints={dataPoints} />
    </div>
  );
}
