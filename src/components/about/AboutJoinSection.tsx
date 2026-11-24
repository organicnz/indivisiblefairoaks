import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';

type AboutSectionProps = {
  dataPoints: Record<string, string>;
};

export function AboutJoinSection({ dataPoints }: AboutSectionProps) {
  return (
    <section className="border-t border-foreground/25 pt-10 text-center space-y-6">
      <DataPoint
        name="about.join.headline"
        as="h3"
        initialData={dataPoints}
        className="font-display text-3xl font-semibold tracking-[-0.03em]"
      >
        Ready to get involved?
      </DataPoint>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/events"
          className="inline-flex min-h-11 items-center bg-primary px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
        >
          <DataPoint name="about.join.btn_events" as="span" initialData={dataPoints}>
            See Upcoming Events
          </DataPoint>
        </Link>
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center border border-foreground/30 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink"
        >
          <DataPoint name="about.join.btn_contact" as="span" initialData={dataPoints}>
            Contact Us
          </DataPoint>
        </Link>
      </div>
    </section>
  );
}
