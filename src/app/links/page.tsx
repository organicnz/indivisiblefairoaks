import { Compass, ExternalLink, Layers } from 'lucide-react';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import { getCoalitionLinks } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'Coalition & Action Links',
  description:
    'Recommended civic resources, grassroots coalition partners, voter registration links, and democracy defense organizations in California.',
  path: '/links',
});

interface LinkItem {
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
  // Supabase is the source of truth; the inline directory above is a fallback
  // for pre-migration deploys and DB outages.
  let items = LINKS_DATA;
  try {
    const rows = await getCoalitionLinks();
    if (rows.length > 0)
      items = rows.map((r) => ({
        name: r.name,
        category: r.category,
        url: r.url,
        description: r.description,
        badge: r.badge ?? undefined,
      }));
  } catch {
    // fall through to LINKS_DATA
  }
  const categories = Array.from(new Set(items.map((l) => l.category)));

  return (
    <div className="w-full bg-secondary text-white min-h-screen pt-24 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-white/10 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-bright/10 border border-primary-on-dark-muted/30 text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4">
            <Compass size={14} className="text-accent-gold" />
            <span>Civic Directory</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Coalition & Action Links
          </h1>
          <p className="text-lg text-ink-on-dark max-w-2xl mx-auto leading-relaxed">
            Essential websites, nonpartisan voter tools, grassroots allies, and democracy defense
            resources vetted by our chapter.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        {categories.map((category) => {
          const categoryItems = items.filter((l) => l.category === category);
          return (
            <div key={category} className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                <Layers className="text-accent-gold" size={20} />
                <span>{category}</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryItems.map((item) => (
                  <a
                    key={item.name}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 rounded-2xl bg-secondary/80 border border-white/10 hover:border-primary-bright/50 hover:bg-secondary transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-bold text-white text-base group-hover:text-primary-on-dark-muted transition-colors">
                          {item.name}
                        </h3>
                        {item.badge && (
                          <span className="px-2 py-0.5 rounded-full bg-accent-gold/20 text-accent-gold text-[10px] font-bold uppercase shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted-on-dark leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/10/80 flex items-center justify-between text-xs text-slate-500">
                      <span className="text-[11px] text-primary-on-dark-muted/90 font-mono truncate max-w-[240px]">
                        {item.url.replace(/^https?:\/\//, '')}
                      </span>
                      <ExternalLink
                        size={14}
                        className="text-ink-muted-on-dark group-hover:text-accent-gold transition-colors shrink-0"
                      />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
