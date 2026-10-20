import { ExternalLink, Handshake } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
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
      name: 'National Indivisible Project',
      category: 'National Movement',
      description:
        'A grassroots movement of thousands of local chapters with a shared vision of a democracy by the people, of the people, and for all people.',
      url: 'https://indivisible.org',
    },
    {
      name: 'Indivisible California StateStrong',
      category: 'Statewide Coalition',
      description:
        'Connecting dozens of local Indivisible chapters across California to coordinate legislative advocacy in Sacramento and champion state-level progressive policy.',
      url: 'https://indivisibleca.org',
    },
    {
      name: 'Sister District Sacramento',
      category: 'Electoral Partner',
      description:
        'Mobilizing volunteers to build lasting progressive power in state legislatures across the country by supporting critical swing-district candidates.',
      url: 'https://sisterdistrict.com',
    },
    {
      name: '5 Calls: Make Your Voice Heard',
      category: 'Civic Tech Partner',
      description:
        'The most effective, fast way for everyday citizens to call their elected officials about crucial democracy, healthcare, and civil rights bills.',
      url: 'https://5calls.org',
    },
    {
      name: 'League of Women Voters Sacramento County',
      category: 'Voting Rights & Nonpartisan Guides',
      description:
        'Empowering voters and defending democracy through nonpartisan ballot analysis, candidate forums, and local high school voter registration drives.',
      url: 'https://my.lwv.org/california/sacramento-county',
    },
    {
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
    <div className="bg-background text-foreground min-h-screen">
      {/* Header Banner with VGPU Constellation Network */}
      <div className="relative overflow-hidden bg-surface-muted border-b border-border text-foreground dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 dark:border-white/10 pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <VgpuCivicConstellation />
        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center text-center pointer-events-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary-ink dark:bg-primary-bright/10 dark:border-primary-on-dark-muted/30 dark:text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4">
            <Handshake size={14} className="text-accent-gold" />
            <DataPoint initialData={dataPoints} name="partners.hero.eyebrow">
              Grassroots Coalition Network
            </DataPoint>
          </div>
          <DataPoint
            initialData={dataPoints}
            name="partners.hero.headline"
            as="h1"
            className="text-4xl sm:text-5xl font-black text-foreground dark:text-white tracking-tight mb-4"
          >
            Our Coalition Partners & Allies
          </DataPoint>
          <div className="h-1.5 w-24 bg-accent-gold rounded-full mb-4" />
          <DataPoint
            initialData={dataPoints}
            name="partners.hero.intro"
            as="p"
            className="text-muted-foreground dark:text-ink-on-dark text-sm sm:text-base max-w-2xl leading-relaxed"
          >
            We believe democracy is a team sport. Indivisible Fair Oaks-Carmichael works in close
            partnership with national organizations, California coalitions, and Sacramento community
            advocates.
          </DataPoint>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-12 px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((partner) => (
            <div
              key={partner.name}
              data-data-point={'slug' in partner ? `partner.${partner.slug}` : undefined}
              className="p-6 rounded-2xl bg-surface-card border border-border hover:border-primary-bright/40 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <span className="text-[11px] font-mono text-primary-ink dark:text-accent-gold font-bold uppercase tracking-wider block">
                  {partner.category}
                </span>
                <h2 className="text-xl font-bold text-foreground dark:text-white group-hover:text-primary-ink dark:group-hover:text-primary-on-dark transition-colors">
                  {partner.name}
                </h2>
                <p className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                  {partner.description}
                </p>
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

        <div className="p-8 rounded-3xl bg-surface-card border border-border text-center space-y-4">
          <DataPoint
            initialData={dataPoints}
            name="partners.cta.headline"
            as="h3"
            className="text-xl font-bold text-foreground dark:text-white"
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
            className="inline-block px-6 py-3 rounded-xl bg-primary hover:bg-primary-dark dark:bg-primary-bright dark:hover:bg-primary-light text-white font-bold text-xs uppercase tracking-wider transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
