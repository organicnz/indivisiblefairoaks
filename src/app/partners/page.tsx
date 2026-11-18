import type { Metadata } from 'next';
import { PartnersCta } from '@/components/partners/PartnersCta';
import { PartnersGrid } from '@/components/partners/PartnersGrid';
import { PartnersMasthead } from '@/components/partners/PartnersMasthead';
import {
  PARTNER_FALLBACK,
  type Partner,
} from '@/components/partners/partners-fallback';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints, getPartners } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'Coalition Partners & Allies',
  description:
    'Meet the national and California grassroots partners, voting rights organizations, and local coalitions working alongside Indivisible Fair Oaks-Carmichael.',
  path: '/partners',
});

export default async function PartnersPage() {
  // Supabase is the source of truth; inline rows are a fallback for
  // pre-migration deploys and DB outages.
  let partners: Partner[] = PARTNER_FALLBACK;
  let dataPoints: Record<string, string> = {};
  try {
    const [rows, dp] = await Promise.all([
      getPartners().catch(() => []),
      getDataPoints('partners'),
    ]);
    if (rows.length > 0) partners = rows;
    dataPoints = dp;
  } catch {
    // fall through
  }

  return (
    <div className="civic-page min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PartnersMasthead dataPoints={dataPoints} />

      <div className="max-w-5xl mx-auto space-y-12 px-4 sm:px-6 lg:px-8 py-16">
        <PartnersGrid partners={partners} dataPoints={dataPoints} />
        <PartnersCta dataPoints={dataPoints} />
      </div>
    </div>
  );
}
