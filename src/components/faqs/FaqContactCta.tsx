import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';

type FaqContactCtaProps = {
  dataPoints: Record<string, string>;
};

export function FaqContactCta({ dataPoints }: FaqContactCtaProps) {
  return (
        <div className="mt-16 space-y-4 border-y border-border bg-surface-card p-8 text-center">
          <DataPoint
            initialData={dataPoints}
            name="faqs.still_have_questions"
            as="h3"
            className="font-display text-2xl font-semibold tracking-[-0.03em]"
          >
            Still have a question?
          </DataPoint>
          <DataPoint
            initialData={dataPoints}
            name="faqs.still_have_questions_sub"
            as="p"
            className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark max-w-md mx-auto"
          >
            Our volunteer organizing committee is always here to help you get connected.
          </DataPoint>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center border border-primary bg-primary px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2"
          >
            <DataPoint initialData={dataPoints} as="span" name="faqs.contact_button">
              Contact Us Directly
            </DataPoint>
          </Link>
        </div>
  );
}
