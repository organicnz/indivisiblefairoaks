import { Shield } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';

const COMMITMENTS = ['Disciplined', 'Lawful', 'De-escalating', 'Peaceful'];

export function HomeNonviolence({ dataPoints }: { dataPoints: Record<string, string> }) {
  return (
    <section className="civic-section relative overflow-hidden border-b border-border bg-secondary text-ink-on-dark">
      <div
        aria-hidden="true"
        className="paper-grid pointer-events-none absolute inset-0 opacity-[0.06]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-28 select-none font-display text-[24rem] leading-none text-white/[0.03]"
      >
        &ldquo;
      </span>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative border border-white/15 p-5 sm:p-8 lg:p-10">
          <span
            aria-hidden="true"
            className="absolute left-2 top-2 size-4 border-l border-t border-white/30"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-2 right-2 size-4 border-b border-r border-white/30"
          />

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

            <div className="lg:col-span-7 lg:col-start-6 lg:pt-8">
              <div className="border-l-2 border-accent-gold-on-dark pl-5 sm:pl-7">
                <span
                  aria-hidden="true"
                  className="block font-display text-6xl leading-[0.45] text-accent-gold-on-dark/40"
                >
                  &ldquo;
                </span>
                <DataPoint
                  name="home.nonviolence.desc"
                  as="p"
                  initialData={dataPoints}
                  className="mt-4 max-w-3xl text-pretty font-display text-xl leading-relaxed text-ink-on-dark sm:text-2xl"
                >
                  A core principle behind all Indivisible events is an unwavering commitment to
                  nonviolent action. We expect all participants to act lawfully, avoid civil
                  disobedience unless specifically planned and coordinated, de-escalate any
                  potential confrontation with those who disagree with our values, and maintain
                  peaceful solidarity.
                </DataPoint>
              </div>

              <div
                aria-hidden="true"
                className="mt-8 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-white/15 pt-4 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-ink-muted-on-dark sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2"
              >
                {COMMITMENTS.map((commitment, index) => (
                  <span key={commitment} className="inline-flex items-center gap-x-2 sm:gap-x-4">
                    {index > 0 ? (
                      <span className="hidden size-1 bg-accent-gold-on-dark/70 sm:block" />
                    ) : null}
                    <span>{commitment}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
