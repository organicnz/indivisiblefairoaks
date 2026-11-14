import { Archive, ArrowUpRight, Compass } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';
import { InteractiveLinksDirectory } from '@/components/ui/InteractiveLinksDirectory';
import { pageMetadata } from '@/lib/metadata';
import { getCoalitionLinks, getDataPoints } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'Coalition & Action Directory',
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
  // Sister Indivisible chapters, restored from the chapter's Google Sites Links
  // page (issue #150 — see migration 20261028120000, which mirrors these rows).
  {
    name: 'Indivisible Sacramento',
    category: 'Movement Partners',
    url: 'https://indivisiblesacramento.com',
    description: 'Neighboring Indivisible chapter organizing in Sacramento.',
  },
  {
    name: 'Indivisible Yolo',
    category: 'Movement Partners',
    url: 'https://www.indivisibleyolo.org',
    description: 'Neighboring Indivisible chapter organizing in Yolo County.',
  },
  {
    name: 'Indivisible Roseville',
    category: 'Movement Partners',
    url: 'https://www.indivisible-roseville-ca.org',
    description: 'Neighboring Indivisible chapter organizing in Roseville.',
  },
  {
    name: 'Indivisible El Dorado',
    category: 'Movement Partners',
    url: 'https://www.indivisibleeldorado.org',
    description: 'Neighboring Indivisible chapter organizing in El Dorado County.',
  },
  {
    name: 'Indivisible Elk Grove',
    category: 'Movement Partners',
    url: 'https://indivisibleegt.com',
    description: 'Neighboring Indivisible chapter organizing in Elk Grove.',
  },
  {
    name: '5 Calls',
    category: 'Civic Education',
    url: 'https://5calls.org',
    description: 'An easy way to call your elected officials with scripts for every issue.',
  },
  {
    name: 'NorCal Resist',
    category: 'Movement Partners',
    url: 'https://www.norcalresist.org',
    description:
      'Community members organizing for a better world through shared resources and support.',
  },
  {
    name: 'American River Democrats',
    category: 'Movement Partners',
    url: 'https://www.ardems.org',
    description: 'Community organization serving East Sacramento County communities.',
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
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        icon={Compass}
        eyebrow={
          <DataPoint name="links.hero.eyebrow" initialData={dataPoints}>
            Coalition &amp; Action Directory
          </DataPoint>
        }
        title={
          <DataPoint
            name="links.hero.headline"
            as="h1"
            initialData={dataPoints}
            className={MASTHEAD_TITLE}
          >
            Coalition &amp; Action Directory
          </DataPoint>
        }
        intro={
          <DataPoint
            name="links.hero.intro"
            as="p"
            initialData={dataPoints}
            className={MASTHEAD_INTRO}
          >
            Essential chapter quick-access links, nonpartisan voter tools, grassroots allies, and democracy defense
            resources vetted by our chapter.
          </DataPoint>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        <InteractiveLinksDirectory initialLinks={items} initialData={dataPoints} />

        <div className="flex flex-col items-start justify-between gap-5 border-y border-border bg-surface-card p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center border border-border bg-background text-accent">
              <Archive size={20} />
            </span>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
                Looking for an older link?
              </h2>
              <p className="mt-1 max-w-xl text-xs sm:text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
                The complete link list from the chapter’s Google Sites — including organization
                sites that are no longer active — is preserved in the archive with its original page
                context.
              </p>
            </div>
          </div>
          <Link
            href="/archive"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
          >
            Open archive
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
