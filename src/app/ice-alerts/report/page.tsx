import {
  CalendarClock,
  LockKeyhole,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import { IceReportForm } from '@/components/ice-alerts/IceReportForm';
import { IntakeFormPanel } from '@/components/ice-alerts/intake/IntakeFormPanel';
import { IntakeHeader } from '@/components/ice-alerts/intake/IntakeHeader';
import { IntakeSteps } from '@/components/ice-alerts/intake/IntakeSteps';
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
      <IntakeHeader
        backHref="/ice-alerts"
        backLabel="Back to the rapid-response map"
        stamp="Private intake / city-level summaries only"
        icon={ShieldCheck}
        kicker="Private report intake"
        copyRegionId="ice-report-intro"
        title="Report what you saw."
        intro="This is a private, text-only report. Raw reports are never published. A unique, low-risk report may automatically publish a generated city-level summary; similar reports are combined. Reports with safety flags or no verified city are held for chapter review. Only the city, state, rough time, category, and a short unverified summary can appear on the ICE Alert page."
        badges={[
          { icon: LockKeyhole, label: 'Raw report stays private' },
          { icon: MapPin, label: 'City-level summaries only' },
          { icon: CalendarClock, label: '30-day private retention' },
        ]}
        emergencyBody="This form cannot dispatch help, provide legal advice, or promise a response. Do not approach or obstruct enforcement activity. If it is safe, observe from a distance."
        emergencyHref="https://stopice.net/?join=1"
        emergencyLabel="National text and online reporting"
      />

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)] lg:gap-12 lg:px-8 lg:py-10">
        <IntakeFormPanel
          eyebrow="Private report"
          titleId="ice-report-form-title"
          title="Tell us what you saw"
          description="Use only what you can confirm. The summary field is for the event, not for a person. A report that includes prohibited details may be rejected or held for review."
        >
          <IceReportForm />
        </IntakeFormPanel>

        <aside className="space-y-5">
          <IntakeSteps copyRegionId="ice-report-steps" steps={STEPS} />

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
