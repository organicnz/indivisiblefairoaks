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
    <section className="civic-section bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="civic-section-head">
          <div className="min-w-0">
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
              className="mt-4 max-w-[18ch] font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-5xl"
            >
              Voter Education &amp; Rights Hub
            </DataPoint>
          </div>
          <Link
            href="/voter-info"
            className="civic-link-arrow group justify-self-start md:justify-self-end"
          >
            <DataPoint as="span" name="home.voter.view_all" initialData={dataPoints}>
              View All 7 Voter Guides
            </DataPoint>
            <ArrowRight
              size={15}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
            />
          </Link>
        </div>

        <CopyRegion id="home-voter-hub">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {VOTER_CARDS.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.titleName}
                  className="civic-panel civic-card-lift group relative flex h-full flex-col justify-between overflow-hidden p-5 hover:border-primary/50 sm:p-6"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100 motion-reduce:transition-none"
                  />
                  <div className="min-w-0">
                    <div className="mb-6 flex items-start justify-between gap-3">
                      <div
                        className={`flex size-11 items-center justify-center border border-border bg-background transition-colors duration-300 group-hover:border-primary/40 ${card.iconClassName}`}
                      >
                        <Icon size={20} aria-hidden="true" />
                      </div>
                      <span
                        aria-hidden="true"
                        className="pt-1 font-mono text-[10px] font-bold tracking-[0.16em] text-muted-foreground"
                      >
                        0{index + 1}
                      </span>
                    </div>
                    <DataPoint
                      name={card.titleName}
                      as="h3"
                      initialData={dataPoints}
                      className="font-display text-2xl font-semibold leading-snug tracking-[-0.03em] text-foreground"
                    >
                      {card.title}
                    </DataPoint>
                    <DataPoint
                      name={card.descriptionName}
                      as="p"
                      initialData={dataPoints}
                      className="mt-3 text-sm leading-relaxed text-muted-foreground"
                    >
                      {card.description}
                    </DataPoint>
                  </div>
                  <Link
                    href="/voter-info"
                    className="mt-6 flex min-h-11 items-center justify-between gap-3 border-t border-border pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-ink transition-colors hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card dark:text-primary-on-dark dark:hover:text-primary-on-dark-muted"
                  >
                    <DataPoint as="span" name={card.buttonName} initialData={dataPoints}>
                      {card.buttonLabel}
                    </DataPoint>
                    <ArrowRight
                      size={14}
                      aria-hidden="true"
                      className="transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transform-none"
                    />
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
