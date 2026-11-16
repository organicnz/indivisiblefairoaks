import {
  ArrowLeft,
  ExternalLink,
  HeartHandshake,
  LockKeyhole,
  Phone,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import { ReunificationForm } from '@/components/ice-alerts/ReunificationForm';
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
      <header className="border-b border-border pt-(--header-clearance)">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <a
            href="/ice-alerts"
            className="inline-flex min-h-8 items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to the rapid-response map
          </a>
          <span className="civic-stamp">Private intake / not a public alert</span>
        </div>

        <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-8 pt-5 sm:px-6 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center border border-primary/30 bg-primary/10">
                <HeartHandshake className="size-5 text-primary" aria-hidden="true" />
              </span>
              <p className="civic-kicker">Consent-based family support</p>
            </div>
            <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">
              Family reunification
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              A private request for help finding or contacting someone in immigration custody. It
              is not a public alert, a person profile, or a promise of release. Names, photos, and
              case details are never shown on the map.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <LockKeyhole className="size-3.5" aria-hidden="true" />
                Private by default
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                No public faces or identities
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Search className="size-3.5" aria-hidden="true" />
                Manual verification
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
              This form cannot dispatch help, provide legal advice, or guarantee an outcome. If
              someone is in immediate danger, call 911 first. For a person already in custody, use
              the official locator as well.
            </p>
            <a
              href="https://locator.ice.gov/odls/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2"
            >
              Official ICE locator
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)] lg:gap-12 lg:px-8 lg:py-10">
        <section aria-labelledby="reunification-form-title" className="min-w-0">
          <div className="border border-border bg-surface-card p-5 sm:p-7">
            <p className="civic-section-index">Private request</p>
            <h2
              id="reunification-form-title"
              className="mt-1.5 font-display text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl"
            >
              Start a request
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Share only what you can confirm. A volunteer will review it and may contact you. It
              usually takes a few minutes. Requests are kept for 90 days unless you ask us to
              delete them.
            </p>
            <div className="mt-5 border-t border-border pt-5">
              <ReunificationForm />
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="border border-border bg-surface-muted p-5">
            <p className="civic-section-index">What happens next</p>
            <ol className="mt-4 space-y-4">
              {STEPS.map((step) => (
                <li key={step.number} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-accent">
                      {step.number}
                    </span>
                    <h3 className="font-display text-lg font-semibold leading-tight tracking-[-0.02em]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="border border-border bg-surface-card p-5">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="civic-section-index">Privacy boundary</p>
                <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                  Private, not published.
                </h2>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>No names, faces, or immigration status appear on the map.</li>
              <li>Photos are optional and stored privately for verification only.</li>
              <li>The status link is a private key; do not forward it.</li>
              <li>A request does not create a legal case or guarantee release.</li>
            </ul>
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
      </main>
    </div>
  );
}
