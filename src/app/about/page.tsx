import type { Metadata } from 'next';
import { AboutFoodDriveSection } from '@/components/about/AboutFoodDriveSection';
import { AboutJoinSection } from '@/components/about/AboutJoinSection';
import { AboutMasthead } from '@/components/about/AboutMasthead';
import { AboutMissionSection } from '@/components/about/AboutMissionSection';
import { AboutNonviolenceSection } from '@/components/about/AboutNonviolenceSection';
import { AboutWhoSection } from '@/components/about/AboutWhoSection';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'About Us',
  description:
    'Learn about Indivisible Fair Oaks-Carmichael, our mission, values, and grassroots organizing across Fair Oaks, Carmichael, and Sacramento County.',
  path: '/about',
});

export default async function AboutPage() {
  const dataPoints = await getDataPoints('about');

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <AboutMasthead dataPoints={dataPoints} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <AboutMissionSection dataPoints={dataPoints} />
        <AboutWhoSection dataPoints={dataPoints} />
        <AboutNonviolenceSection dataPoints={dataPoints} />
        <AboutFoodDriveSection dataPoints={dataPoints} />
        <AboutJoinSection dataPoints={dataPoints} />
      </div>
    </div>
  );
}
