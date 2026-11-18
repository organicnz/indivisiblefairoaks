import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  LockKeyhole,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import { IceReportForm } from '@/components/ice-alerts/IceReportForm';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Private ICE Report — ICE Alert',
  description:
    'Submit a private, text-only report of suspected ICE activity. Raw text stays private. Unique low-risk reports may publish a generated city-level summary automatically, and similar reports are combined.',
  path: '/ice-alerts/report',
  robots: { index: false, follow: false },
});

const STEPS = [
  {
    number: '01',
    title: 'Send only what you saw',
    body: 'Use a city and state, a time within the last 24 hours, and a short first-person observation. Do not send names, faces, plates, street addresses, or contact details.',
  },
  {
    number: '02',
    title: 'A generated summary may publish',
    body: 'If the report is unique and low-risk, the chapter may automatically publish a generated summary: city, state, category, rough time, and a short unverified description. Raw text stays private.',
  },
  {
    number: '03',
    title: 'Similar reports are combined',
    body: 'A report that closely matches an existing report in the same city, state, and category within two hours is combined into one public entry. Reports with safety flags or no verified city are held for chapter review.',
  },
] as const;

const LIMITS = [
  'No attachments, photos, video, or audio.',
  'No street addresses or precise locations.',
  'No names, faces, plates, immigration status, or contact details.',
  'No automatic alert, dispatch, or guarantee of a response.',
] as const;

export default function IceReportPage() {
  return (
    <div className="civic-page min-h-screen w-full bg-background text-foreground">
      <header className="border-b border-border pt-(--header-clearance)">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <a
            href="/ice-alerts"
            className="inline-flex min-h-8 items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to the rapid-response map
          </a>
          <span className="civic-stamp">Private intake / city-level summaries only</span>
        </div>

        <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-8 pt-5 sm:px-6 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center border border-primary/30 bg-primary/10">
                <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              </span>
              <p className="civic-kicker">Private report intake</p>
            </div>
            <CopyRegion id="ice-report-intro">
              <div>
                <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">
                  Report what you saw.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  This is a private, text-only report. Raw reports are never published. A unique,
                  low-risk report may automatically publish a generated city-level summary; similar
                  reports are combined. Reports with safety flags or no verified city are held for
                  chapter review. Only the city, state, rough time, category, and a short unverified
                  summary can appear on the ICE Alert page.
                </p>
              </div>
            </CopyRegion>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <LockKeyhole className="size-3.5" aria-hidden="true" />
                Raw report stays private
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden="true" />
                City-level summaries only
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" aria-hidden="true" />
                30-day private retention
              </span>
            </div>
          </div>

          <div className="border-l-2 border-accent pl-4">
            <a
              href="tel:911"
              className="inline-flex items-start gap-2.5 text-sm font-semibold leading-snug text-foreground transition-colors hover:text-accent"
            >
              <Phone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              Immediate danger? Call 911.
            </a>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              This form cannot dispatch help, provide legal advice, or promise a response. Do not
              approach or obstruct enforcement activity. If it is safe, observe from a distance.
            </p>
            <a
              href="https://stopice.net/?join=1"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2"
            >
              National text and online reporting
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)] lg:gap-12 lg:px-8 lg:py-10">
        <section aria-labelledby="ice-report-form-title" className="min-w-0">
          <div className="border border-border bg-surface-card p-5 sm:p-7">
            <p className="civic-section-index">Private report</p>
            <h2
              id="ice-report-form-title"
              className="mt-1.5 font-display text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl"
            >
              Tell us what you saw
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Use only what you can confirm. The summary field is for the event, not for a person.
              A report that includes prohibited details may be rejected or held for review.
            </p>
            <div className="mt-5 border-t border-border pt-5">
              <IceReportForm />
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="border border-border bg-surface-muted p-5">
            <CopyRegion id="ice-report-steps">
              <div>
                <p className="civic-section-index">What happens next</p>
                <ol className="mt-4 space-y-4">
                  {STEPS.map((step) => (
                    <li
                      key={step.number}
                      className="border-t border-border pt-3 first:border-t-0 first:pt-0"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-accent">
                          {step.number}
                        </span>
                        <h3 className="font-display text-lg font-semibold leading-tight tracking-[-0.02em]">
                          {step.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {step.body}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </CopyRegion>
          </section>

          <section className="border border-border bg-surface-card p-5">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <CopyRegion id="ice-report-limits">
                <div>
                  <p className="civic-section-index">Hard limits</p>
                  <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                    What this form will not do.
                  </h2>
                  <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
                    {LIMITS.map((limit) => (
                      <li key={limit}>{limit}</li>
                    ))}
                  </ul>
                </div>
              </CopyRegion>
            </div>
          </section>

          <section className="border border-border bg-surface-card p-5">
            <CopyRegion id="ice-report-privacy">
              <div>
                <p className="civic-section-index">Privacy boundary</p>
                <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                  Minimized, not anonymous.
                </h2>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  We do not ask for your name or contact details. Hosting and abuse-prevention
                  systems may still process limited technical data. We cannot promise technical
                  anonymity. Raw reports are retained for up to 30 days and may be disclosed if
                  required by law. If a city-level summary is published, it contains no raw report
                  text.
                </p>
              </div>
            </CopyRegion>
          </section>
        </aside>
      </main>
    </div>
  );
}
