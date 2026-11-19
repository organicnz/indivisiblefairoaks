import { Shield } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';

export function HomeNonviolence({ dataPoints }: { dataPoints: Record<string, string> }) {
  return (
    <section className="civic-section border-y border-border bg-secondary text-ink-on-dark">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center border border-white/20 text-accent-gold-on-dark">
                <Shield size={20} aria-hidden="true" />
              </span>
              <span className="civic-kicker text-accent-gold-on-dark before:bg-accent-gold-on-dark">
                Our core commitment
              </span>
            </div>
            <DataPoint
              name="home.nonviolence.headline"
              as="h2"
              initialData={dataPoints}
              className="mt-7 max-w-[13ch] font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl"
            >
              Our Core Commitment: Disciplined Non-Violent Action
            </DataPoint>
          </div>

          <div className="lg:col-span-7 lg:col-start-6 lg:pt-12">
            <div className="border-l-2 border-accent-gold-on-dark pl-5 sm:pl-6">
              <DataPoint
                name="home.nonviolence.desc"
                as="p"
                initialData={dataPoints}
                className="max-w-3xl text-pretty font-display text-xl leading-relaxed text-ink-on-dark sm:text-2xl"
              >
                A core principle behind all Indivisible events is an unwavering commitment to
                nonviolent action. We expect all participants to act lawfully, avoid civil
                disobedience unless specifically planned and coordinated, de-escalate any potential
                confrontation with those who disagree with our values, and maintain peaceful
                solidarity.
              </DataPoint>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
