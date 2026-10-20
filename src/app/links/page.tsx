import { Compass } from 'lucide-react';
import type { Metadata } from 'next';
import { DataPoint } from '@/components/ui/DataPoint';
import { InteractiveLinksDirectory } from '@/components/ui/InteractiveLinksDirectory';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { pageMetadata } from '@/lib/metadata';
import { getCoalitionLinks, getDataPoints } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'Coalition & Action Links',
  description:
    'Recommended civic resources, grassroots coalition partners, voter registration links, and democracy defense organizations in California.',
  path: '/links',
});

interface LinkItem {
  slug?: string;
  name: string;
  category: string;
  url: string;
  description: string;
  badge?: string;
}

const LINKS_DATA: LinkItem[] = [
  {
    name: 'Indivisible National',
    category: 'Movement Partners',
    url: 'https://indivisible.org',
    description:
      'The national movement to elect progressive leaders and rebuild our democracy. Guides, toolkits, and national call campaigns.',
    badge: 'National Hub',
  },
  {
    name: 'Indivisible California State Network',
    category: 'Movement Partners',
    url: 'https://indivisibleca.org',
    description:
      'Coordinating Indivisible chapters across California for Sacramento legislative advocacy and statewide election protection.',
  },
  {
    name: 'Mobilize.us Indivisible Directory',
    category: 'Movement Partners',
    url: 'https://www.mobilize.us/indivisible/',
    description:
      'Find upcoming local meetings, rallies, text banks, and phone banks organized by Indivisible chapters across California.',
  },
  {
    name: 'California Online Voter Registration',
    category: 'Voter Resources',
    url: 'https://registertovote.ca.gov',
    description:
      'Register to vote online or update your address and party registration with the California Secretary of State.',
    badge: 'Official SOS',
  },
  {
    name: "Where's My Ballot? (BallotTrax)",
    category: 'Voter Resources',
    url: 'https://wheresmyballot.sos.ca.gov',
    description:
      'Track when your vote-by-mail ballot is printed, mailed, received, and counted by your county elections office.',
  },
  {
    name: 'Sacramento County Elections Division',
    category: 'Voter Resources',
    url: 'https://elections.saccounty.gov',
    description:
      'Official county portal for ballot drop-off locations, Vote Center hours, and official election results.',
  },
  {
    name: 'League of Women Voters of Sacramento County',
    category: 'Civic Education',
    url: 'https://www.lwvsacramento.org',
    description:
      'Trusted, nonpartisan in-depth analysis of statewide ballot propositions and local candidate debates.',
  },
  {
    name: 'ACLU of Northern California',
    category: 'Civic Education',
    url: 'https://www.aclunc.org',
    description:
      'Defending civil liberties, constitutional rights, and public protest protections across Northern California.',
  },
  {
    name: 'ActBlue Contribution Portal',
    category: 'Support',
    url: 'https://secure.actblue.com/donate/indivisiblefoc1432155925',
    description:
      'Direct contribution portal to support Indivisible Fair Oaks-Carmichael grassroots organizing.',
    badge: 'Support Our Work',
  },
];

export default async function LinksPage() {
  const dataPoints = await getDataPoints('links');

  // Supabase is the source of truth; the inline directory above is a fallback
  // for pre-migration deploys and DB outages.
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
    <div className="w-full bg-background text-foreground min-h-screen pt-(--header-clearance) pb-20">
      {/* Header Banner with VGPU Constellation Network */}
      <section className="relative overflow-hidden bg-secondary text-white border-b border-border py-16">
        <VgpuCivicConstellation />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-bright/10 border border-primary-on-dark-muted/30 text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4">
            <Compass size={14} className="text-accent-gold" />
            <DataPoint name="links.hero.eyebrow" initialData={dataPoints}>
              Civic Directory
            </DataPoint>
          </div>
          <DataPoint
            name="links.hero.headline"
            as="h1"
            initialData={dataPoints}
            className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4"
          >
            Coalition &amp; Action Links
          </DataPoint>
          <DataPoint
            name="links.hero.intro"
            as="p"
            initialData={dataPoints}
            className="text-lg text-ink-on-dark max-w-2xl mx-auto leading-relaxed"
          >
            Essential websites, nonpartisan voter tools, grassroots allies, and democracy defense
            resources vetted by our chapter.
          </DataPoint>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <InteractiveLinksDirectory initialLinks={items} />
      </div>
    </div>
  );
}
