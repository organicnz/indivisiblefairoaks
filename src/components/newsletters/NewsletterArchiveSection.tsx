import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { InteractiveNewslettersList } from '@/components/ui/InteractiveNewslettersList';
import type { NewsletterRow } from '@/lib/queries/civic';

type NewsletterArchiveSectionProps = {
  newsletters: NewsletterRow[];
  dataPoints: Record<string, string>;
};

export function NewsletterArchiveSection({
  newsletters,
  dataPoints,
}: NewsletterArchiveSectionProps) {
  return (
        <section aria-labelledby="newsletter-archive-heading" className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="civic-section-index">Chapter-owned bulletins</p>
              <h2
                id="newsletter-archive-heading"
                className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]"
              >
                <DataPoint name="news.archive.title" as="span" initialData={dataPoints}>
                  Past Bulletins &amp; Archives
                </DataPoint>
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
                Email-style updates from our chapter organizers. Use the topic filters to find a
                bulletin, or search the archive by title or subject.
              </p>
            </div>
            <Link
              href="/news"
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
            >
              News &amp; updates
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <InteractiveNewslettersList initialNewsletters={newsletters} initialData={dataPoints} />
        </section>
  );
}
