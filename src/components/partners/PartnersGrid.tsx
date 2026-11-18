import { ExternalLink } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import type { Partner } from './partners-fallback';

type PartnersGridProps = {
  partners: Partner[];
  dataPoints: Record<string, string>;
};

export function PartnersGrid({ partners, dataPoints }: PartnersGridProps) {
  return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((partner) => (
            <div
              key={partner.slug}
              className="group flex flex-col justify-between border-t border-foreground/25 pt-6 transition-colors hover:border-primary/60"
            >
              <div className="space-y-3">
                <DataPoint
                  initialData={dataPoints}
                  as="span"
                  name={`partner.${partner.slug}.category`}
                  className="text-[11px] font-mono text-primary-ink dark:text-accent-gold font-bold uppercase tracking-wider block"
                >
                  {partner.category}
                </DataPoint>
                <DataPoint
                  initialData={dataPoints}
                  as="h2"
                  name={`partner.${partner.slug}.name`}
                  className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground transition-colors group-hover:text-primary-ink"
                >
                  {partner.name}
                </DataPoint>
                <DataPoint
                  initialData={dataPoints}
                  as="p"
                  name={`partner.${partner.slug}.description`}
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  {partner.description}
                </DataPoint>
              </div>

              <div className="pt-6 border-t border-border dark:border-white/10">
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-primary-ink dark:text-primary-on-dark hover:text-primary-dark dark:hover:text-primary-on-dark-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
                >
                  <DataPoint initialData={dataPoints} as="span" name="partners.card.visit_link">
                    Visit Partner Website
                  </DataPoint>
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </div>
            </div>
          ))}
        </div>
  );
}
