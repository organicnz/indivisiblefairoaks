import { Sparkles } from 'lucide-react';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { DataPoint } from '@/components/ui/DataPoint';

type AboutSectionProps = {
  dataPoints: Record<string, string>;
};

export function AboutNonviolenceSection({ dataPoints }: AboutSectionProps) {
  return (
        <section className="border-y border-border bg-surface-card p-6 sm:p-8 space-y-4">
          <DataPoint
            name="about.nonviolence.headline"
            as="h3"
            initialData={dataPoints}
            className="flex items-center gap-2 font-display text-2xl font-semibold tracking-[-0.03em]"
          >
            <Sparkles className="text-accent dark:text-accent-gold" size={20} />
            <span>Commitment to Non-Violent Action & De-escalation</span>
          </DataPoint>
          <CopyRegion id="about-nonviolence">
            <DataPoint
              name="about.nonviolence.body"
              as="p"
              initialData={dataPoints}
              className="civic-prose text-sm"
            >
              A foundational pillar behind all Indivisible Fair Oaks-Carmichael events is a strict
              commitment to nonviolence. We expect all attendees to act lawfully, treat fellow
              citizens with dignity, and actively seek to de-escalate potential conflict with
              counter-protesters. Weapons of any kind are strictly prohibited at our gatherings.
            </DataPoint>
          </CopyRegion>
        </section>
  );
}
