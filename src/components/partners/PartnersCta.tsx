import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';

type PartnersCtaProps = {
  dataPoints: Record<string, string>;
};

export function PartnersCta({ dataPoints }: PartnersCtaProps) {
  return (
        <div className="space-y-4 border-y border-border bg-surface-card p-8 text-center">
          <DataPoint
            initialData={dataPoints}
            name="partners.cta.headline"
            as="h3"
            className="font-display text-2xl font-semibold tracking-[-0.03em]"
          >
            Looking to Partner with Our Chapter?
          </DataPoint>
          <DataPoint
            initialData={dataPoints}
            name="partners.cta.intro"
            as="p"
            className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark max-w-xl mx-auto"
          >
            If your organization shares our dedication to civil rights, progressive governance, and
            democratic defense, we’d love to collaborate on upcoming actions.
          </DataPoint>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center border border-primary bg-primary px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <DataPoint initialData={dataPoints} as="span" name="partners.cta.button">
              Connect With Our Coalition Team
            </DataPoint>
          </Link>
        </div>
  );
}
