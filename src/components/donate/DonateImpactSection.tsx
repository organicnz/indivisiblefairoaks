import { Megaphone, Music, Shield, Users } from 'lucide-react';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { DataPoint } from '@/components/ui/DataPoint';

type DonateImpactSectionProps = {
  dataPoints: Record<string, string>;
};

export function DonateImpactSection({ dataPoints }: DonateImpactSectionProps) {
  return (
        <div className="space-y-6">
          <DataPoint
            name="donate.impact.headline"
            as="h2"
            initialData={dataPoints}
            className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
          >
            Where Your Donation Goes
          </DataPoint>

          <CopyRegion id="donate-impact">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 border-t border-foreground/25 pt-6">
                <div className="flex size-10 items-center justify-center border border-border bg-background text-primary-ink">
                  <Users size={20} />
                </div>
                <DataPoint
                  name="donate.impact.spaces_title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  Community Meeting Spaces
                </DataPoint>
                <DataPoint
                  name="donate.impact.spaces_desc"
                  as="p"
                  initialData={dataPoints}
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  Rent for our monthly meeting spaces (such as St. Michael's Church hall) to provide
                  safe, welcoming gathering venues for residents and guest speakers.
                </DataPoint>
              </div>

              <div className="space-y-3 border-t border-foreground/25 pt-6">
                <div className="flex size-10 items-center justify-center border border-border bg-background text-accent">
                  <Music size={20} />
                </div>
                <DataPoint
                  name="donate.impact.choir_title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  Resistance Choir Sound Gear
                </DataPoint>
                <DataPoint
                  name="donate.impact.choir_desc"
                  as="p"
                  initialData={dataPoints}
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  Battery-powered amplifiers, portable microphones, sheet music printing, and
                  acoustic gear to carry our voices across busy intersections.
                </DataPoint>
              </div>

              <div className="space-y-3 border-t border-foreground/25 pt-6">
                <div className="flex size-10 items-center justify-center border border-border bg-background text-accent">
                  <Megaphone size={20} />
                </div>
                <DataPoint
                  name="donate.impact.banners_title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  Protest Banners & Supplies
                </DataPoint>
                <DataPoint
                  name="donate.impact.banners_desc"
                  as="p"
                  initialData={dataPoints}
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  Weatherproof protest signs, high-visibility banners for street demonstrations, art
                  supplies for youth rallies, and flyers.
                </DataPoint>
              </div>

              <div className="space-y-3 border-t border-foreground/25 pt-6">
                <div className="flex size-10 items-center justify-center border border-border bg-background text-primary-ink">
                  <Shield size={20} />
                </div>
                <DataPoint
                  name="donate.impact.voter_title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  Voter Outreach & Registration
                </DataPoint>
                <DataPoint
                  name="donate.impact.voter_desc"
                  as="p"
                  initialData={dataPoints}
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  Printed guides for youth pre-registration, rights restoration flyers for formerly
                  incarcerated community members, and postcard stamps.
                </DataPoint>
              </div>
            </div>
          </CopyRegion>
        </div>
  );
}
