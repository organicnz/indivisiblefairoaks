import { Shield } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';

export function HomeNonviolence({ dataPoints }: { dataPoints: Record<string, string> }) {
  return (
    <section className="civic-section border-y border-border bg-secondary text-ink-on-dark">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <div className="mb-1 inline-flex size-12 items-center justify-center border border-white/25 text-accent-gold-on-dark">
          <Shield size={24} />
        </div>
        <DataPoint
          name="home.nonviolence.headline"
          as="h2"
          initialData={dataPoints}
          className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-4xl"
        >
          Our Core Commitment: Disciplined Non-Violent Action
        </DataPoint>
        <DataPoint
          name="home.nonviolence.desc"
          as="p"
          initialData={dataPoints}
          className="mx-auto max-w-2xl text-sm leading-relaxed text-ink-on-dark/80"
        >
          A core principle behind all Indivisible events is an unwavering commitment to nonviolent
          action. We expect all participants to act lawfully, avoid civil disobedience unless
          specifically planned and coordinated, de-escalate any potential confrontation with those
          who disagree with our values, and maintain peaceful solidarity.
        </DataPoint>
      </div>
    </section>
  );
}
