import { ArrowRight, Mail } from 'lucide-react';
import Link from 'next/link';

export function NewslettersCallout() {
  return (
    <section
      aria-labelledby="newsletters-callout-heading"
      className="civic-panel relative overflow-hidden border-l-4 border-l-accent p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center border border-border bg-surface-muted text-primary-ink dark:text-primary-on-dark">
            <Mail size={21} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="civic-section-index">Newsletters</p>
            <h2
              id="newsletters-callout-heading"
              className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl"
            >
              Bulletins &amp; news blasts
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
              Monthly bulletins and the legacy newsletter PDFs now have a dedicated archive,
              separate from articles and meeting materials.
            </p>
          </div>
        </div>
        <Link
          href="/newsletters"
          className="group inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-primary bg-primary px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
        >
          Read newsletters &amp; bulletins
          <ArrowRight
            size={15}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
          />
        </Link>
      </div>
    </section>
  );
}
