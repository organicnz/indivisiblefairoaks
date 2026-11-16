import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ExternalLink,
  Eye,
  FileWarning,
  HeartHandshake,
  Landmark,
  MapPin,
  Phone,
  Radio,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { formatDateLabel } from './data';
import type { RapidFeedSource } from './rapid-types';
import { formatRelativeTime, formatUpdateTime } from './rapid-alert-utils';
import type { HeatmapMeta } from './types';

type RapidResponseGuideProps = {
  historicalMeta: HeatmapMeta;
  community: RapidFeedSource | null;
  official: RapidFeedSource | null;
  now: number;
};

const STEPS = [
  {
    number: '01',
    title: 'Stay back. Stay safe.',
    body: 'Do not approach, confront, or obstruct enforcement activity. Move to a safe place before you do anything else.',
    icon: ShieldAlert,
  },
  {
    number: '02',
    title: 'Observe from a distance.',
    body: 'If it is safe, note the time, general location, and what you can see. You may carefully film from a distance; filming in public is generally protected by the First Amendment. Do not publish names, faces, plates, or immigration status.',
    icon: Eye,
  },
  {
    number: '03',
    title: 'Share and connect.',
    body: 'Use a trusted rapid-response network. Help people reach legal support and family. Do not use a sighting to identify, follow, or harass anyone.',
    icon: HeartHandshake,
  },
] as const;

const RESOURCES = [
  {
    title: 'Immediate danger',
    body: 'Call 911. This map cannot dispatch help or verify an emergency.',
    href: 'tel:911',
    label: 'Call 911',
    icon: Phone,
    external: false,
  },
  {
    title: 'Know your rights',
    body: 'The ACLU’s immigrant-rights guides cover encounters at home, work, and in public.',
    href: 'https://www.aclu.org/know-your-rights/immigrants-rights',
    label: 'Open the ACLU guide',
    icon: BookOpen,
    external: true,
  },
  {
    title: 'Find someone in detention',
    body: 'ICE’s Online Detainee Locator can search for an adult in custody by A-Number or name and country of birth.',
    href: 'https://locator.ice.gov/odls/',
    label: 'Open the locator',
    icon: Users,
    external: true,
  },
  {
    title: 'Report a sighting',
    body: 'This page does not collect reports. Report through the Stop ICE Alerts Network online, or text REPORT to 877-322-2299. Never send names, plates, or addresses.',
    href: 'https://stopice.net/',
    label: 'Open the reporting network',
    icon: Radio,
    external: true,
  },
] as const;

const LIMITS = [
  'No street addresses, number plates, names, faces, or immigration status.',
  'No claim that a community report is independently verified by this page.',
  'No live tracking of individual officers, vehicles, or people.',
  'No legal advice, dispatch, or guarantee that a report is current.',
];

export function RapidResponseGuide({
  historicalMeta,
  community,
  official,
  now,
}: RapidResponseGuideProps) {
  return (
    <section
      id="rapid-response-guide"
      aria-labelledby="ice-guide-title"
      className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20"
    >
      <div className="grid gap-8 border-t border-foreground/20 pt-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
        <div>
          <p className="civic-section-index">Rapid response, safely</p>
          <h2
            id="ice-guide-title"
            className="mt-2 max-w-lg font-display text-4xl font-semibold leading-[0.95] tracking-[-0.045em] sm:text-5xl"
          >
            If you see something, do this.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            A community alert should help neighbors make a safety decision, not become a
            surveillance log. Keep observations short, locations general, and identity out of the
            map.
          </p>
          <div className="mt-5 border-l-2 border-accent pl-4">
            <p className="flex items-start gap-2 text-sm font-semibold leading-relaxed">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              Do not interfere with or obstruct enforcement activity.
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              You can carefully observe or film from a safe distance. Filming in public is
              generally protected, but safety comes first. This is not legal advice.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="border-t border-foreground/25 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-accent">
                    {step.number}
                  </span>
                  <Icon className="size-4 text-foreground" aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-display text-xl font-semibold leading-tight tracking-[-0.025em]">
                  {step.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {RESOURCES.map((resource) => {
          const Icon = resource.icon;
          return (
            <a
              key={resource.title}
              href={resource.href}
              target={resource.external ? '_blank' : undefined}
              rel={resource.external ? 'noopener noreferrer' : undefined}
              className="group flex flex-col bg-surface-card p-4 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className="size-4 text-accent" aria-hidden="true" />
                <ArrowRight
                  className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold leading-tight tracking-[-0.02em]">
                {resource.title}
              </h3>
              <p className="mt-1.5 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                {resource.body}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2">
                {resource.label}
                {resource.external ? (
                  <ExternalLink className="size-2.5" aria-hidden="true" />
                ) : null}
              </span>
            </a>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border border-primary/30 bg-primary/5 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <HeartHandshake className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-display text-xl font-semibold leading-tight tracking-[-0.025em]">
              Family reunification request
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              A private, consent-based way to ask for help. Names, photos, and case details are
              never published on this map.
            </p>
          </div>
        </div>
        <a
          href="/ice-alerts/reunification"
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 border border-border bg-background px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Start a private request
          <ArrowRight className="size-3" aria-hidden="true" />
        </a>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
        <div className="border border-border bg-surface-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <p className="civic-section-index">Hard limits</p>
              <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                What this map will not do.
              </h2>
            </div>
          </div>
          <ul className="mt-4 grid gap-2">
            {LIMITS.map((limit) => (
              <li
                key={limit}
                className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
              >
                <span className="mt-1.5 size-1 shrink-0 bg-accent" aria-hidden="true" />
                {limit}
              </li>
            ))}
          </ul>
          <a
            href="/ice-alerts?view=history"
            className="mt-4 inline-flex min-h-9 items-center gap-1.5 border border-border px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MapPin className="size-3" aria-hidden="true" />
            Open the historical FOIA map
          </a>
        </div>

        <div className="border border-border bg-surface-muted p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="civic-section-index">Sources &amp; freshness</p>
              <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                Every layer says where it came from.
              </h2>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="border-t border-border pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold tracking-[-0.02em]">
                  Community: {community?.sourceName ?? 'Stop ICE Alerts Network'}
                </h3>
                <span
                  className={`civic-stamp ${
                    community?.status === 'stale'
                      ? 'border-accent-gold/60 bg-accent-gold/15 text-foreground'
                      : ''
                  }`}
                >
                  {community?.status === 'stale' ? 'Delayed export · ' : ''}
                  {community?.latestAt
                    ? `Latest ${formatRelativeTime(community.latestAt, now)}`
                    : 'No report'}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Public nightly export. We use city centroids and a short generated summary; the
                original export includes street addresses and vehicle details that we do not
                republish. Source-confirmed is the network&apos;s label.
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <a
                  href={community?.sourceUrl ?? 'https://stopice.net/?data=1'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2"
                >
                  Public data export
                  <ExternalLink className="size-2.5" aria-hidden="true" />
                </a>
                {community?.checkedAt ? (
                  <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    Checked {formatUpdateTime(community.checkedAt)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold tracking-[-0.02em]">
                  Official: {official?.sourceName ?? 'ICE Newsroom'}
                </h3>
                <span className="civic-stamp">
                  {official?.latestAt
                    ? `Latest ${formatRelativeTime(official.latestAt, now)}`
                    : 'No release'}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Official newsroom RSS. These are agency releases, not live enforcement locations.
                We summarize the topic and link out instead of reproducing names or case details,
                and we do not map releases as incidents.
              </p>
              <a
                href={official?.sourceUrl ?? 'https://www.ice.gov/newsroom'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2"
              >
                ICE newsroom
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
            </div>

            <div className="border-t border-border pt-3">
              <h3 className="font-display text-base font-semibold tracking-[-0.02em]">
                Historical baseline: FOIA release
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                The optional city circles come from a processed ICE FOIA release covering{' '}
                {formatDateLabel(historicalMeta.periodStart)} through{' '}
                {formatDateLabel(historicalMeta.periodEnd)}, via the Deportation Data Project.
                They are historical totals, not current incidents.
              </p>
              <a
                href={historicalMeta.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2"
              >
                Deportation Data Project
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
