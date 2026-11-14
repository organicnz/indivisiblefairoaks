import { ExternalLink, Handshake } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';
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
  let partners = [
    {
      slug: 'national-indivisible',
      name: 'National Indivisible Project',
      category: 'National Movement',
      description:
        'A grassroots movement of thousands of local chapters with a shared vision of a democracy by the people, of the people, and for all people.',
      url: 'https://indivisible.org',
    },
    {
      slug: 'indivisible-ca-statestrong',
      name: 'Indivisible California StateStrong',
      category: 'Statewide Coalition',
      description:
        'Connecting dozens of local Indivisible chapters across California to coordinate legislative advocacy in Sacramento and champion state-level progressive policy.',
      url: 'https://indivisibleca.org',
    },
    {
      slug: 'sister-district-sac',
      name: 'Sister District Sacramento',
      category: 'Electoral Partner',
      description:
        'Mobilizing volunteers to build lasting progressive power in state legislatures across the country by supporting critical swing-district candidates.',
      url: 'https://sisterdistrict.com',
    },
    {
      slug: '5calls',
      name: '5 Calls: Make Your Voice Heard',
      category: 'Civic Tech Partner',
      description:
        'The most effective, fast way for everyday citizens to call their elected officials about crucial democracy, healthcare, and civil rights bills.',
      url: 'https://5calls.org',
    },
    {
      slug: 'lwv-sacramento',
      name: 'League of Women Voters Sacramento County',
      category: 'Voting Rights & Nonpartisan Guides',
      description:
        'Empowering voters and defending democracy through nonpartisan ballot analysis, candidate forums, and local high school voter registration drives.',
      url: 'https://my.lwv.org/california/sacramento-county',
    },
    {
      slug: 'aclu-norcal',
      name: 'ACLU of Northern California',
      category: 'Civil Liberties & Legal Defense',
      description:
        'Guarding the constitutional rights of all Californians through strategic litigation, community education, and policy reform.',
      url: 'https://www.aclunc.org',
    },
  ];
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
      <PageMasthead
        icon={Handshake}
        eyebrow={
          <DataPoint initialData={dataPoints} name="partners.hero.eyebrow">
            Grassroots Coalition Network
          </DataPoint>
        }
        title={
          <DataPoint
            initialData={dataPoints}
            name="partners.hero.headline"
            as="h1"
            className={MASTHEAD_TITLE}
          >
            Our Coalition Partners & Allies
          </DataPoint>
        }
        intro={
          <DataPoint
            initialData={dataPoints}
            name="partners.hero.intro"
            as="p"
            className={MASTHEAD_INTRO}
          >
            We believe democracy is a team sport. Indivisible Fair Oaks-Carmichael works in close
            partnership with national organizations, California coalitions, and Sacramento community
            advocates.
          </DataPoint>
        }
      />

      <div className="max-w-5xl mx-auto space-y-12 px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((partner) => (
            <div
              key={partner.slug}
              className="group flex flex-col justify-between border-t border-foreground/25 pt-6 transition-colors hover:border-primary/60"
            >
              <div className="space-y-3">
                <DataPoint
                  initialData={dataPoints}
                  as="span"
                  name={`partner.${partner.slug}.category`}
                  className="text-[11px] font-mono text-primary-ink dark:text-accent-gold font-bold uppercase tracking-wider block"
                >
                  {partner.category}
                </DataPoint>
                <DataPoint
                  initialData={dataPoints}
                  as="h2"
                  name={`partner.${partner.slug}.name`}
                  className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground transition-colors group-hover:text-primary-ink"
                >
                  {partner.name}
                </DataPoint>
                <DataPoint
                  initialData={dataPoints}
                  as="p"
                  name={`partner.${partner.slug}.description`}
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  {partner.description}
                </DataPoint>
              </div>

              <div className="pt-6 border-t border-border dark:border-white/10">
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-primary-ink dark:text-primary-on-dark hover:text-primary-dark dark:hover:text-primary-on-dark-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
                >
                  <DataPoint initialData={dataPoints} as="span" name="partners.card.visit_link">
                    Visit Partner Website
                  </DataPoint>
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 border-y border-border bg-surface-card p-8 text-center">
          <DataPoint
            initialData={dataPoints}
            name="partners.cta.headline"
            as="h3"
            className="font-display text-2xl font-semibold tracking-[-0.03em]"
          >
            Looking to Partner with Our Chapter?
          </DataPoint>
          <DataPoint
            initialData={dataPoints}
            name="partners.cta.intro"
            as="p"
            className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark max-w-xl mx-auto"
          >
            If your organization shares our dedication to civil rights, progressive governance, and
            democratic defense, we’d love to collaborate on upcoming actions.
          </DataPoint>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center border border-primary bg-primary px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <DataPoint initialData={dataPoints} as="span" name="partners.cta.button">
              Connect With Our Coalition Team
            </DataPoint>
          </Link>
        </div>
      </div>
    </div>
  );
}
