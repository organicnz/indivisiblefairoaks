import { Archive } from 'lucide-react';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { CopyRegion } from '@/components/cms/CopyRegion';
import type { LegacyDocumentRow, LegacyPageRow } from '@/lib/queries/legacy';
import { dateLabel } from './archive-format';

type ArchiveMastheadProps = {
  pages: LegacyPageRow[];
  documents: LegacyDocumentRow[];
  imageCount: number;
  videoCount: number;
  lastCaptured: string | undefined;
};

export function ArchiveMasthead({
  pages,
  documents,
  imageCount,
  videoCount,
  lastCaptured,
}: ArchiveMastheadProps) {
  return (
      <PageMasthead
        icon={Archive}
        eyebrow="Legacy Google Sites Archive"
        title={<h1 className={MASTHEAD_TITLE}>Chapter Archive</h1>}
        intro={
          <CopyRegion id="archive-intro">
            <p className={MASTHEAD_INTRO}>
              The public record of our earlier Google Sites — voter guides, newsletters, event flyers,
              choir films, and the links we used to organize. Raw site captures and uncleared files
              stay in a private preservation archive.
            </p>
          </CopyRegion>
        }
        meta={
          pages.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {[
                `${pages.length} pages`,
                `${documents.length} documents`,
                `${imageCount} images`,
                `${videoCount} videos`,
              ].map((label) => (
                <span key={label} className="civic-stamp">
                  {label}
                </span>
              ))}
              {lastCaptured ? (
                <span className="text-[11px] text-muted-foreground">
                  Captured {dateLabel(lastCaptured)}
                </span>
              ) : null}
            </div>
          ) : undefined
        }
      />
  );
}
