import { Megaphone, Shield, Users, Vote, type LucideIcon } from 'lucide-react';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { DataPoint } from '@/components/ui/DataPoint';

type Pillar = {
  icon: LucideIcon;
  titleName: string;
  title: string;
  descriptionName: string;
  description: string;
};

const PILLARS: Pillar[] = [
  {
    icon: Shield,
    titleName: 'home.pillars.p1_title',
    title: 'Stop Authoritarianism',
    descriptionName: 'home.pillars.p1_desc',
    description:
      'Countering anti-democratic overreach, defending executive accountability, and raising public alarm through visible resistance.',
  },
  {
    icon: Vote,
    titleName: 'home.pillars.p2_title',
    title: 'Defend Democratic Norms',
    descriptionName: 'home.pillars.p2_desc',
    description:
      'Safeguarding free and fair elections, expanding voting access, educating youth voters, and standing up for civil liberties.',
  },
  {
    icon: Megaphone,
    titleName: 'home.pillars.p3_title',
    title: 'Elect Bold Leaders',
    descriptionName: 'home.pillars.p3_desc',
    description:
      'Direct voter canvassing, phone banks, candidate accountability, and mobilizing high-turnout civic engagement in every cycle.',
  },
  {
    icon: Users,
    titleName: 'home.pillars.p4_title',
    title: 'Secure Progressive Policy',
    descriptionName: 'home.pillars.p4_desc',
    description:
      'Advocating for justice, reproductive autonomy, climate resilience, and economic equity through community solidarity.',
  },
];

export function HomePillars({ dataPoints }: { dataPoints: Record<string, string> }) {
  return (
    <section className="civic-section bg-surface-muted text-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="self-start lg:sticky lg:top-28 lg:col-span-4">
              <CopyRegion id="home-pillars">
                <div>
                  <DataPoint
                    name="home.pillars.eyebrow"
                    as="span"
                    initialData={dataPoints}
                    className="civic-kicker"
                  >
                    Our Core Principles
                  </DataPoint>
                  <DataPoint
                    name="home.pillars.headline"
                    as="h2"
                    initialData={dataPoints}
                    className="mt-5 max-w-md font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-foreground sm:text-5xl"
                  >
                    What We Stand For &amp; How We Win
                  </DataPoint>
                  <DataPoint
                    name="home.pillars.intro"
                    as="p"
                    initialData={dataPoints}
                    className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground"
                  >
                    Rooted in the national Indivisible Guide, our local chapter works tirelessly
                    across the Sacramento region to defend our constitutional democracy through
                    grassroots mobilization.
                  </DataPoint>
                </div>
              </CopyRegion>
            </div>

            <div className="grid gap-x-10 sm:grid-cols-2 lg:col-span-8">
              {PILLARS.map((pillar, index) => {
                const Icon = pillar.icon;
                return (
                  <article
                    key={pillar.titleName}
                    className="group min-w-0 border-t border-foreground/25 py-6 transition-colors duration-300 hover:border-primary/50 sm:py-7"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex size-9 shrink-0 items-center justify-center border border-foreground/20 bg-background transition-colors duration-300 group-hover:border-primary/40 group-hover:bg-surface-card">
                        <Icon
                          size={18}
                          strokeWidth={1.4}
                          className="text-primary transition-colors duration-300 group-hover:text-accent"
                          aria-hidden="true"
                        />
                      </span>
                      <span
                        aria-hidden="true"
                        className="font-mono text-[10px] font-bold tracking-[0.14em] text-muted-foreground"
                      >
                        0{index + 1}
                      </span>
                    </div>
                    <DataPoint
                      name={pillar.titleName}
                      as="h3"
                      initialData={dataPoints}
                      className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground"
                    >
                      {pillar.title}
                    </DataPoint>
                    <DataPoint
                      name={pillar.descriptionName}
                      as="p"
                      initialData={dataPoints}
                      className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground"
                    >
                      {pillar.description}
                    </DataPoint>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
