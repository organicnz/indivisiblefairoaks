import { ExternalLink, HeartHandshake, LockKeyhole, Search, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { ReunificationForm } from '@/components/ice-alerts/ReunificationForm';
import { IntakeFormPanel } from '@/components/ice-alerts/intake/IntakeFormPanel';
import { IntakeHeader } from '@/components/ice-alerts/intake/IntakeHeader';
import { IntakeSteps } from '@/components/ice-alerts/intake/IntakeSteps';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Private Family Reunification Request — ICE Alert',
  description:
    'Start a private, consent-based family reunification request. Names, photos, and case details are never published on the ICE Alert map.',
  path: '/ice-alerts/reunification',
  robots: { index: false, follow: false },
});

const STEPS = [
  {
    number: '01',
    title: 'Tell us what you know',
    body: 'Share the details you can confirm. It is okay to leave fields blank. Do not include immigration status, social media, or guesses.',
  },
  {
    number: '02',
    title: 'A volunteer reviews it',
    body: 'The request stays private. A trained volunteer may check details against official resources and contact you for clarification.',
  },
  {
    number: '03',
    title: 'You get a private status',
    body: 'Use the emailed status link to see whether the request is received, being verified, or closed. No public profile is created.',
  },
] as const;

const RESOURCES = [
  {
    title: 'ICE Online Detainee Locator',
    href: 'https://locator.ice.gov/odls/',
    label: 'Search official locator',
  },
  {
    title: 'ACLU immigrant-rights guides',
    href: 'https://www.aclu.org/know-your-rights/immigrants-rights',
    label: 'Know your rights',
  },
  {
    title: 'Find a legal representative',
    href: 'https://www.ailalawyer.com/',
    label: 'Open AILA directory',
  },
] as const;

export default function ReunificationPage() {
  return (
    <div className="civic-page min-h-screen w-full bg-background text-foreground">
      <IntakeHeader
        backHref="/ice-alerts"
        backLabel="Back to the rapid-response map"
        stamp="Private intake / not a public alert"
        icon={HeartHandshake}
        kicker="Consent-based family support"
        copyRegionId="ice-reunification-intro"
        title="Family reunification"
        intro="A private request for help finding or contacting someone in immigration custody. It is not a public alert, a person profile, or a promise of release. Names, photos, and case details are never shown on the map."
        badges={[
          { icon: LockKeyhole, label: 'Private by default' },
          { icon: ShieldCheck, label: 'No public faces or identities' },
          { icon: Search, label: 'Manual verification' },
        ]}
        emergencyBody="This form cannot dispatch help, provide legal advice, or guarantee an outcome. If someone is in immediate danger, call 911 first. For a person already in custody, use the official locator as well."
        emergencyHref="https://locator.ice.gov/odls/"
        emergencyLabel="Official ICE locator"
      />

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)] lg:gap-12 lg:px-8 lg:py-10">
        <IntakeFormPanel
          eyebrow="Private request"
          titleId="reunification-form-title"
          title="Start a request"
          description="Share only what you can confirm. A volunteer will review it and may contact you. It usually takes a few minutes. Requests are kept for 90 days unless you ask us to delete them."
        >
          <ReunificationForm />
        </IntakeFormPanel>

        <aside className="space-y-5">
          <IntakeSteps copyRegionId="ice-reunification-steps" steps={STEPS} />

          <section className="border border-border bg-surface-card p-5">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <CopyRegion id="ice-reunification-privacy">
                <div>
                  <p className="civic-section-index">Privacy boundary</p>
                  <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                    Private, not published.
                  </h2>
                  <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
                    <li>No names, faces, or immigration status appear on the map.</li>
                    <li>Photos are optional and stored privately for verification only.</li>
                    <li>The status link is a private key; do not forward it.</li>
                    <li>A request does not create a legal case or guarantee release.</li>
                  </ul>
                </div>
              </CopyRegion>
            </div>
          </section>

          <section className="border border-border bg-surface-card p-5">
            <p className="civic-section-index">Official resources</p>
            <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
              Check custody directly.
            </h2>
            <div className="mt-4 space-y-3">
              {RESOURCES.map((resource) => (
                <a
                  key={resource.title}
                  href={resource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block border-t border-border pt-3 first:border-t-0 first:pt-0"
                >
                  <span className="flex items-center justify-between gap-3 text-sm font-semibold leading-snug">
                    {resource.title}
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground underline underline-offset-2 group-hover:text-foreground">
                    {resource.label}
                  </span>
                </a>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
