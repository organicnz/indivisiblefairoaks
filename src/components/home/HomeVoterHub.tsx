import { ArrowRight, FileText, Shield, Vote, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { DataPoint } from '@/components/ui/DataPoint';

type VoterCard = {
  icon: LucideIcon;
  iconClassName: string;
  titleName: string;
  title: string;
  descriptionName: string;
  description: string;
  buttonName: string;
  buttonLabel: string;
};

const VOTER_CARDS: VoterCard[] = [
  {
    icon: FileText,
    iconClassName: 'text-primary-ink',
    titleName: 'home.voter.card1_title',
    title: 'Sacramento County Elected Officials',
    descriptionName: 'home.voter.card1_desc',
    description:
      'Direct contact information, phone numbers, and offices for local, state, and federal representatives serving our district.',
    buttonName: 'home.voter.card1_btn',
    buttonLabel: 'Access Guide & Directory',
  },
  {
    icon: Vote,
    iconClassName: 'text-accent',
    titleName: 'home.voter.card2_title',
    title: 'Pre-Registration at 16',
    descriptionName: 'home.voter.card2_desc',
    description:
      'California youth age 16 and 17 can pre-register now so they are automatically registered to cast their ballot the day they turn 18.',
    buttonName: 'home.voter.card2_btn',
    buttonLabel: 'Youth Voting Guide',
  },
  {
    icon: Shield,
    iconClassName: 'text-primary-ink',
    titleName: 'home.voter.card3_title',
    title: 'Rights Restoration & Unhoused Voting',
    descriptionName: 'home.voter.card3_desc',
    description:
      'Homeless is not voteless. Learn about voting rights restoration for formerly incarcerated Californians and unhoused residents.',
    buttonName: 'home.voter.card3_btn',
    buttonLabel: 'Read Rights Overview',
  },
];

export function HomeVoterHub({ dataPoints }: { dataPoints: Record<string, string> }) {
  return (
    <section className="py-16 md:py-24 bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <DataPoint
              name="home.voter.eyebrow"
              as="span"
              initialData={dataPoints}
              className="civic-kicker"
            >
              Empowering Every Voter
            </DataPoint>
            <DataPoint
              name="home.voter.headline"
              as="h2"
              initialData={dataPoints}
              className="mt-4 font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-5xl"
            >
              Voter Education &amp; Rights Hub
            </DataPoint>
          </div>
          <Link
            href="/voter-info"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary-ink dark:text-primary-on-dark hover:text-primary-dark dark:hover:text-primary-on-dark-muted transition-colors uppercase tracking-wider"
          >
            <DataPoint as="span" name="home.voter.view_all" initialData={dataPoints}>
              View All 7 Voter Guides
            </DataPoint>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <CopyRegion id="home-voter-hub">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {VOTER_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.titleName}
                  className="flex flex-col justify-between border-t border-foreground/25 pt-6 transition-colors hover:border-primary/60"
                >
                  <div>
                    <div
                      className={`mb-4 flex size-10 items-center justify-center border border-border bg-background ${card.iconClassName}`}
                    >
                      <Icon size={20} />
                    </div>
                    <DataPoint
                      name={card.titleName}
                      as="h3"
                      initialData={dataPoints}
                      className="text-lg font-bold text-foreground mb-2"
                    >
                      {card.title}
                    </DataPoint>
                    <DataPoint
                      name={card.descriptionName}
                      as="p"
                      initialData={dataPoints}
                      className="text-xs text-muted-foreground leading-relaxed mb-4"
                    >
                      {card.description}
                    </DataPoint>
                  </div>
                  <Link
                    href="/voter-info"
                    className="text-xs font-bold text-primary-ink dark:text-primary-on-dark hover:text-primary-dark dark:hover:text-primary-on-dark-muted flex items-center gap-1.5"
                  >
                    <DataPoint as="span" name={card.buttonName} initialData={dataPoints}>
                      {card.buttonLabel}
                    </DataPoint>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              );
            })}
          </div>
        </CopyRegion>
      </div>
    </section>
  );
}
