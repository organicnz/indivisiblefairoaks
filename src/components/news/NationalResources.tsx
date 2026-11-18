import { Megaphone } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';

type NationalResourcesProps = {
  dataPoints: Record<string, string>;
};

export function NationalResources({ dataPoints }: NationalResourcesProps) {
  return (
        <div className="space-y-4 border-y border-border bg-surface-card p-8">
          <div className="flex items-center gap-3">
            <Megaphone className="text-accent-gold" size={22} />
            <DataPoint
              initialData={dataPoints}
              as="h2"
              name="news.national.title"
              className="font-display text-2xl font-semibold tracking-[-0.03em]"
            >
              National Indivisible Resources
            </DataPoint>
          </div>
          <DataPoint
            initialData={dataPoints}
            as="p"
            name="news.national.desc"
            className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed"
          >
            Indivisible Fair Oaks-Carmichael is one of thousands of grassroots groups nationwide
            following the proven guide created by former congressional staffers. For nationwide
            campaigns, toolkits, and legislative tracking, visit the national network at{' '}
            <a
              href="https://indivisible.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-ink dark:text-primary-on-dark-muted hover:underline font-semibold"
            >
              indivisible.org
            </a>
            .
          </DataPoint>
        </div>
  );
}
