import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { CopyRegion } from '@/components/cms/CopyRegion';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE_DOCUMENT,
  PageMasthead,
} from '@/components/layout/PageMasthead';

type LegalPageShellProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  copyRegionId: string;
  children: ReactNode;
};

export function LegalPageShell({
  icon,
  eyebrow,
  title,
  intro,
  updated,
  copyRegionId,
  children,
}: LegalPageShellProps) {
  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        icon={icon}
        compact
        eyebrow={eyebrow}
        title={<h1 className={MASTHEAD_TITLE_DOCUMENT}>{title}</h1>}
        intro={<p className={MASTHEAD_INTRO}>{intro}</p>}
        meta={<span className="civic-stamp">Last updated {updated}</span>}
      />

      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <CopyRegion id={copyRegionId}>
          <div className="civic-prose">{children}</div>
        </CopyRegion>
      </div>
    </div>
  );
}
