import { Mail } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';

type ChoirJoinCtaProps = {
  dataPoints: Record<string, string>;
};

export function ChoirJoinCta({ dataPoints }: ChoirJoinCtaProps) {
  return (
    <>
        {/* Join CTA */}
        <div className="space-y-4 border-y border-border bg-surface-card p-8 text-center">
          <DataPoint
            name="choir.join.title"
            as="h3"
            initialData={dataPoints}
            className="font-display text-3xl font-semibold tracking-[-0.03em]"
          >
            Ready to Sing With Us?
          </DataPoint>
          <DataPoint
            name="choir.join.desc"
            as="p"
            initialData={dataPoints}
            className="text-muted-foreground dark:text-ink-on-dark text-sm max-w-lg mx-auto"
          >
            You don&apos;t need to be a trained musician. If you have a heart for justice and a
            voice to lend, you belong in our choir.
          </DataPoint>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <a
              href="mailto:contact@indivisiblefairoaks.org?subject=Joining%20the%20Resistance%20Choir"
              className="inline-flex min-h-11 items-center gap-2 border border-accent-gold bg-accent-gold px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-strong transition-colors hover:brightness-95"
            >
              <Mail size={16} />
              <span>Email Choir Director</span>
            </a>
            <Link
              href="/events"
              className="inline-flex min-h-11 items-center gap-2 border border-foreground/30 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink"
            >
              View Calendar
            </Link>
          </div>
        </div>
    </>
  );
}
