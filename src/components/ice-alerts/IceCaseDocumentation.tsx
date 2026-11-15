import { DATA, formatDateLabel, formatNumber } from './data';

export function IceCaseDocumentation() {
  return (
    <section
      id="ice-case-documentation"
      aria-labelledby="ice-case-documentation-title"
      className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20"
    >
      <div className="border-t border-foreground/20 pt-8">
        <p className="civic-section-index">Documentation &amp; dignity</p>
        <h2
          id="ice-case-documentation-title"
          className="mt-2 max-w-2xl font-display text-3xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-4xl"
        >
          Every record is a person.
        </h2>

        <div className="mt-4 grid gap-5 text-sm leading-relaxed text-muted-foreground lg:grid-cols-2 lg:gap-10">
          <p>
            The map counts {formatNumber(DATA.meta.mappedRecords)} de-duplicated ICE arrest
            records assigned to U.S. cities. Each one represents a person. Many are our
            neighbors; all deserve dignity.
          </p>
          <p>
            The city-level extract used by this page does not identify those people by name,
            and this page will not invent a victim, a face, a family, or a story to fill that
            absence. We document only what the release actually contains: city totals, the
            period, the source, and the limits.
          </p>
        </div>

        <div className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-3">
          <div className="bg-surface-muted p-4 sm:p-5">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              What is documented
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              De-duplicated records through {formatDateLabel(DATA.meta.periodEnd)}, grouped by
              the city named in the apprehension field and matched to a Census place point.
              The source, method, and known gaps are documented in the source panel and
              reading guide above.
            </p>
          </div>
          <div className="bg-surface-muted p-4 sm:p-5">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              What is not documented
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              This page has no individual case file, case number, street address, nationality,
              immigration status, photograph, or verified victim/community-member identity.
              We do not infer those from a city total.
            </p>
          </div>
          <div className="bg-surface-muted p-4 sm:p-5">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Adding a verified account
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              If the chapter has a consent-based, source-controlled case or memorial record,
              we can publish only what is verified and attributed. Do not send sensitive
              personal information through this page.{' '}
              <a
                href="/contact"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                Contact the chapter
              </a>
              .
            </p>
          </div>
        </div>

        <div className="mt-6 border-l-2 border-accent bg-accent/5 p-4 sm:p-5">
          <p className="max-w-3xl font-display text-lg font-semibold leading-snug tracking-[-0.02em] text-foreground">
            To the people behind every record, their families, and the communities carrying
            this history: you are not a data point here. We will not pretend the release
            tells us more than it does.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Latest available release: {formatDateLabel(DATA.meta.periodEnd)}.{' '}
            {DATA.meta.releaseNote}
          </p>
        </div>
      </div>
    </section>
  );
}
