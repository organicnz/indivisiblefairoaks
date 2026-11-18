import { ArrowLeft, ExternalLink, Phone, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { CopyRegion } from '@/components/cms/CopyRegion';

type IntakeBadge = {
  icon: LucideIcon;
  label: string;
};

type IntakeHeaderProps = {
  backHref: string;
  backLabel: string;
  stamp: string;
  icon: LucideIcon;
  kicker: string;
  copyRegionId: string;
  title: string;
  intro: string;
  badges: IntakeBadge[];
  emergencyBody: ReactNode;
  emergencyHref: string;
  emergencyLabel: string;
};

export function IntakeHeader({
  backHref,
  backLabel,
  stamp,
  icon: Icon,
  kicker,
  copyRegionId,
  title,
  intro,
  badges,
  emergencyBody,
  emergencyHref,
  emergencyLabel,
}: IntakeHeaderProps) {
  return (
    <header className="border-b border-border pt-(--header-clearance)">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <a
          href={backHref}
          className="inline-flex min-h-8 items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {backLabel}
        </a>
        <span className="civic-stamp">{stamp}</span>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-8 pt-5 sm:px-6 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center border border-primary/30 bg-primary/10">
              <Icon className="size-5 text-primary" aria-hidden="true" />
            </span>
            <p className="civic-kicker">{kicker}</p>
          </div>
          <CopyRegion id={copyRegionId}>
            <div>
              <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {intro}
              </p>
            </div>
          </CopyRegion>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {badges.map(({ icon: BadgeIcon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <BadgeIcon className="size-3.5" aria-hidden="true" />
                {label}
              </span>
            ))}
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
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{emergencyBody}</p>
          <a
            href={emergencyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2"
          >
            {emergencyLabel}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}
