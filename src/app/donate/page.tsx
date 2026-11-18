import type { Metadata } from 'next';
import { DonateDisclaimer } from '@/components/donate/DonateDisclaimer';
import { DonateImpactSection } from '@/components/donate/DonateImpactSection';
import { DonateMasthead } from '@/components/donate/DonateMasthead';
import { ActBlueDonationCalculator } from '@/components/ui/ActBlueDonationCalculator';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'Donate & Support',
  description:
    'Support Indivisible Fair Oaks-Carmichael via ActBlue. Every grassroots contribution powers our local organizing, choir rallies, and voter turnout campaigns.',
  path: '/donate',
});

export default async function DonatePage() {
  const dataPoints = await getDataPoints('donate');

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <DonateMasthead dataPoints={dataPoints} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* 10x Pro Interactive ActBlue Donation Calculator */}
        <ActBlueDonationCalculator initialData={dataPoints} />
        <DonateImpactSection dataPoints={dataPoints} />
        <DonateDisclaimer dataPoints={dataPoints} />
      </div>
    </div>
  );
}
