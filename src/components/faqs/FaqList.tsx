import { DataPoint } from '@/components/ui/DataPoint';
import type { FAQGroup } from './faqs-data';

type FaqListProps = {
  faqs: FAQGroup[];
  dataPoints: Record<string, string>;
};

export function FaqList({ faqs, dataPoints }: FaqListProps) {
  return (
        <div className="space-y-12">
          {faqs.map((group) => {
            const categoryId = `faq-category-${group.category
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')}`;
            return (
              <section key={group.category} aria-labelledby={categoryId}>
                <h2
                  id={categoryId}
                  className="mb-6 flex items-center gap-3 font-display text-2xl font-semibold tracking-[-0.03em]"
                >
                  <span>{group.category}</span>
                  <div className="h-px bg-border dark:bg-white/5 flex-1" />
                </h2>
                <div className="space-y-4">
                  {group.questions.map((faq) => (
                    <div
                      key={faq.q}
                      className="space-y-2 border-t border-border py-4"
                    >
                      <DataPoint
                        initialData={dataPoints}
                        as="h3"
                        name={`faq.${faq.slug}.question`}
                        className="text-base sm:text-lg font-bold text-foreground dark:text-white"
                      >
                        {faq.q}
                      </DataPoint>
                      <DataPoint
                        initialData={dataPoints}
                        as="p"
                        name={`faq.${faq.slug}.answer`}
                        className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                      >
                        {faq.a}
                      </DataPoint>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
  );
}
