import { ExternalLink } from 'lucide-react';
import { SECTION_TITLE } from '@/components/layout/PageMasthead';
import { NEIGHBORING_CHAPTERS } from '@/config/neighboring-chapters';

export function NeighboringChaptersSection() {
  return (
    <section aria-labelledby="neighboring-chapters-heading">
      <div className="civic-section-head civic-section-head--compact">
        <div>
          <p className="civic-section-index">Neighboring chapters</p>
          <h2 id="neighboring-chapters-heading" className={`mt-2 ${SECTION_TITLE}`}>
            From our neighbors
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
            We link to each chapter&apos;s own public page. A card here means we verified the source
            — not that we reprinted their newsletter.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {NEIGHBORING_CHAPTERS.map((chapter) => (
          <article
            key={chapter.href}
            className="flex flex-col justify-between gap-5 border border-border bg-surface-card p-5"
          >
            <div>
              <p className="civic-meta text-muted-foreground">{chapter.area}</p>
              <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em]">
                {chapter.name}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
                {chapter.description}
              </p>
            </div>

            <div className="space-y-3">
              <p className="inline-flex border border-border bg-surface-muted px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {chapter.newsletterStatus}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <a
                  href={chapter.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
                >
                  {chapter.linkLabel}
                  <ExternalLink size={14} aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {chapter.sourceLabel} · checked {chapter.checkedOn}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-5 text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
        Know a neighboring chapter with a public newsletter?{' '}
        <a
          href="mailto:contact@indivisiblefairoaks.org?subject=Neighboring%20chapter%20newsletter"
          className="font-semibold text-primary-ink underline decoration-primary/40 underline-offset-4 hover:decoration-primary dark:text-primary-on-dark"
        >
          Send us the link
        </a>{' '}
        so we can verify and add it.
      </p>
    </section>
  );
}
