import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ExternalLink,
  Eye,
  FileWarning,
  HeartHandshake,
  Landmark,
  LockKeyhole,
  MapPin,
  Phone,
  Scale,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import { formatDateLabel } from './data';
import { formatRelativeTime, formatUpdateTime } from './rapid-alert-utils';
import type { RapidFeedSource } from './rapid-types';
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
    titleKey: 'ice.rapid.steps.safe.title',
    bodyKey: 'ice.rapid.steps.safe.body',
    title: 'Stay back. Stay safe.',
    body: 'Do not approach, confront, or obstruct enforcement activity. Move to a safe place before you do anything else.',
    icon: ShieldAlert,
  },
  {
    number: '02',
    titleKey: 'ice.rapid.steps.observe.title',
    bodyKey: 'ice.rapid.steps.observe.body',
    title: 'Observe from a distance.',
    body: 'If it is safe, note the time, general location, and what you can see. You may carefully film from a distance; filming in public is generally protected by the First Amendment. Do not publish names, faces, plates, or immigration status.',
    icon: Eye,
  },
  {
    number: '03',
    titleKey: 'ice.rapid.steps.share.title',
    bodyKey: 'ice.rapid.steps.share.body',
    title: 'Share and connect.',
    body: 'Use a trusted rapid-response network. Help people reach legal support and family. Do not use a sighting to identify, follow, or harass anyone.',
    icon: HeartHandshake,
  },
] as const;

const RESOURCES = [
  {
    titleKey: 'ice.rapid.resources.emergency.title',
    bodyKey: 'ice.rapid.resources.emergency.body',
    labelKey: 'ice.rapid.resources.emergency.label',
    title: 'Immediate danger',
    body: 'Call 911. This map cannot dispatch help or verify an emergency.',
    href: 'tel:911',
    label: 'Call 911',
    icon: Phone,
    external: false,
  },
  {
    titleKey: 'ice.rapid.resources.rights.title',
    bodyKey: 'ice.rapid.resources.rights.body',
    labelKey: 'ice.rapid.resources.rights.label',
    title: 'Know your rights',
    body: 'The ACLU’s immigrant-rights guides cover encounters at home, work, and in public.',
    href: 'https://www.aclu.org/know-your-rights/immigrants-rights',
    label: 'Open the ACLU guide',
    icon: BookOpen,
    external: true,
  },
  {
    titleKey: 'ice.rapid.resources.locator.title',
    bodyKey: 'ice.rapid.resources.locator.body',
    labelKey: 'ice.rapid.resources.locator.label',
    title: 'Find someone in detention',
    body: 'ICE’s Online Detainee Locator can search for an adult in custody by A-Number or name and country of birth.',
    href: 'https://locator.ice.gov/odls/',
    label: 'Open the locator',
    icon: Users,
    external: true,
  },
  {
    titleKey: 'ice.rapid.resources.report.title',
    bodyKey: 'ice.rapid.resources.report.body',
    labelKey: 'ice.rapid.resources.report.label',
    title: 'Report a sighting',
    body: 'Submit a private report. Raw text stays private; a unique, low-risk report may publish only a generated city-level summary, and similar reports are combined. Reports with safety flags or no verified city are held for review. Use the national network if you prefer. Never send names, plates, or addresses.',
    href: '/ice-alerts/report',
    label: 'Start a private report',
    icon: LockKeyhole,
    external: false,
  },
] as const;

const LIMITS = [
  {
    key: 'ice.rapid.limits.item1',
    text: 'No street addresses, number plates, names, faces, or immigration status.',
  },
  {
    key: 'ice.rapid.limits.item2',
    text: 'No claim that a community report is independently verified by this page.',
  },
  {
    key: 'ice.rapid.limits.item3',
    text: 'No live tracking of individual officers, vehicles, or people.',
  },
  {
    key: 'ice.rapid.limits.item4',
    text: 'No legal advice, dispatch, or guarantee that a report is current.',
  },
] as const;

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
          <p className="civic-section-index">
            <DataPoint name="ice.rapid.guide.eyebrow">Rapid response, safely</DataPoint>
          </p>
          <DataPoint
            as="h2"
            id="ice-guide-title"
            name="ice.rapid.guide.title"
            className="mt-2 max-w-lg font-display text-4xl font-semibold leading-[0.95] tracking-[-0.045em] sm:text-5xl"
          >
            If you see something, do this.
          </DataPoint>
          <DataPoint
            as="p"
            name="ice.rapid.guide.intro"
            className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground"
          >
            A community alert should help neighbors make a safety decision, not become a
            surveillance log. Keep observations short, locations general, and identity out of the
            map.
          </DataPoint>
          <div className="mt-5 border-l-2 border-accent pl-4">
            <p className="flex items-start gap-2 text-sm font-semibold leading-relaxed">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <DataPoint as="span" name="ice.rapid.guide.warning">
                Do not interfere with or obstruct enforcement activity.
              </DataPoint>
            </p>
            <DataPoint
              as="p"
              name="ice.rapid.guide.warning_detail"
              className="mt-1.5 text-xs leading-relaxed text-muted-foreground"
            >
              You can carefully observe or film from a safe distance. Filming in public is generally
              protected, but safety comes first. This is not legal advice.
            </DataPoint>
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
                <DataPoint
                  as="h3"
                  name={step.titleKey}
                  className="mt-3 font-display text-xl font-semibold leading-tight tracking-[-0.025em]"
                >
                  {step.title}
                </DataPoint>
                <DataPoint
                  as="p"
                  name={step.bodyKey}
                  className="mt-2 text-xs leading-relaxed text-muted-foreground"
                >
                  {step.body}
                </DataPoint>
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
              <DataPoint
                as="h3"
                name={resource.titleKey}
                className="mt-3 font-display text-lg font-semibold leading-tight tracking-[-0.02em]"
              >
                {resource.title}
              </DataPoint>
              <DataPoint
                as="p"
                name={resource.bodyKey}
                className="mt-1.5 flex-1 text-[11px] leading-relaxed text-muted-foreground"
              >
                {resource.body}
              </DataPoint>
              <span className="mt-3 inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2">
                <DataPoint as="span" name={resource.labelKey}>
                  {resource.label}
                </DataPoint>
                {resource.external ? (
                  <ExternalLink className="size-2.5" aria-hidden="true" />
                ) : null}
              </span>
            </a>
          );
        })}
      </div>

      <a
        href="https://detentionhelp.org/en/"
        target="_blank"
        rel="noopener noreferrer"
        className="group mt-4 flex flex-col gap-4 border border-border bg-surface-card p-4 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <div className="flex min-w-0 items-start gap-3">
          <Scale className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <DataPoint
              as="h3"
              name="ice.rapid.detention.title"
              className="font-display text-xl font-semibold leading-tight tracking-[-0.025em]"
            >
              DetentionHelp
            </DataPoint>
            <DataPoint
              as="p"
              name="ice.rapid.detention.body"
              className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground"
            >
              A free tool from immigrant-rights groups for people in ICE detention preparing a
              habeas petition, including people without a lawyer. It does not guarantee release.
            </DataPoint>
          </div>
        </div>
        <span className="inline-flex min-h-9 shrink-0 items-center gap-1.5 border border-border bg-background px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors group-hover:border-foreground">
          <DataPoint as="span" name="ice.rapid.detention.cta">
            Open DetentionHelp
          </DataPoint>
          <ExternalLink className="size-3" aria-hidden="true" />
        </span>
      </a>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border border-primary/30 bg-primary/5 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <HeartHandshake className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <DataPoint
              as="h3"
              name="ice.rapid.reunification.title"
              className="font-display text-xl font-semibold leading-tight tracking-[-0.025em]"
            >
              Family reunification request
            </DataPoint>
            <DataPoint
              as="p"
              name="ice.rapid.reunification.body"
              className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground"
            >
              A private, consent-based way to ask for help. Names, photos, and case details are
              never published on this map.
            </DataPoint>
          </div>
        </div>
        <a
          href="/ice-alerts/reunification"
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 border border-border bg-background px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <DataPoint as="span" name="ice.rapid.reunification.cta">
            Start a private request
          </DataPoint>
          <ArrowRight className="size-3" aria-hidden="true" />
        </a>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
        <div className="border border-border bg-surface-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <p className="civic-section-index">
                <DataPoint name="ice.rapid.limits.eyebrow">Hard limits</DataPoint>
              </p>
              <DataPoint
                as="h2"
                name="ice.rapid.limits.title"
                className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]"
              >
                What this map will not do.
              </DataPoint>
            </div>
          </div>
          <ul className="mt-4 grid gap-2">
            {LIMITS.map((limit) => (
              <li
                key={limit.key}
                className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
              >
                <span className="mt-1.5 size-1 shrink-0 bg-accent" aria-hidden="true" />
                <DataPoint as="span" name={limit.key}>
                  {limit.text}
                </DataPoint>
              </li>
            ))}
          </ul>
          <a
            href="#historical-foia"
            className="mt-4 inline-flex min-h-9 items-center gap-1.5 border border-border px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MapPin className="size-3" aria-hidden="true" />
            Explore the historical FOIA map
          </a>
        </div>

        <div className="border border-border bg-surface-muted p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="civic-section-index">
                <DataPoint name="ice.rapid.sources.eyebrow">Sources &amp; freshness</DataPoint>
              </p>
              <DataPoint
                as="h2"
                name="ice.rapid.sources.title"
                className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]"
              >
                Every layer says where it came from.
              </DataPoint>
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
                  {community?.status === 'unavailable'
                    ? 'Unavailable'
                    : community?.latestAt
                      ? `Latest ${formatRelativeTime(community.latestAt, now)}`
                      : 'No report'}
                </span>
              </div>
              <DataPoint
                as="p"
                name="ice.rapid.sources.community.body"
                className="mt-1 text-[11px] leading-relaxed text-muted-foreground"
              >
                Public nightly export. We use city centroids and a short, generalized description
                built from the report&apos;s public text, type, status, and timestamp. Street
                addresses, vehicle plates, contact details, and identities are never republished.
                Source-confirmed is the network&apos;s label.
              </DataPoint>
              <div className="mt-2 flex flex-wrap gap-3">
                <a
                  href="/ice-alerts/data"
                  className="inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2"
                >
                  <DataPoint as="span" name="ice.rapid.sources.community.api">
                    Chapter API &amp; downloads
                  </DataPoint>
                  <ArrowRight className="size-2.5" aria-hidden="true" />
                </a>
                <a
                  href={community?.sourceUrl ?? 'https://stopice.net/?data=1'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground underline underline-offset-2"
                >
                  <DataPoint as="span" name="ice.rapid.sources.community.export">
                    National data export
                  </DataPoint>
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
                  {official?.status === 'unavailable'
                    ? 'Unavailable'
                    : official?.latestAt
                      ? `Latest ${formatRelativeTime(official.latestAt, now)}`
                      : 'No release'}
                </span>
              </div>
              <DataPoint
                as="p"
                name="ice.rapid.sources.official.body"
                className="mt-1 text-[11px] leading-relaxed text-muted-foreground"
              >
                Official newsroom RSS. These are agency releases, not live enforcement locations. We
                summarize the topic and link out instead of reproducing names or case details, and
                we do not map releases as incidents.
              </DataPoint>
              <a
                href={official?.sourceUrl ?? 'https://www.ice.gov/newsroom'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2"
              >
                <DataPoint as="span" name="ice.rapid.sources.official.link">
                  ICE newsroom
                </DataPoint>
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
            </div>

            <div className="border-t border-border pt-3">
              <DataPoint
                as="h3"
                name="ice.rapid.sources.historical.title"
                className="font-display text-base font-semibold tracking-[-0.02em]"
              >
                Historical baseline: FOIA release
              </DataPoint>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                The optional city circles come from a processed ICE FOIA release covering{' '}
                {formatDateLabel(historicalMeta.periodStart)} through{' '}
                {formatDateLabel(historicalMeta.periodEnd)}, via the Deportation Data Project. They
                are historical totals, not current incidents.
              </p>
              <a
                href={historicalMeta.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2"
              >
                <DataPoint as="span" name="ice.rapid.sources.historical.link">
                  Deportation Data Project
                </DataPoint>
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
