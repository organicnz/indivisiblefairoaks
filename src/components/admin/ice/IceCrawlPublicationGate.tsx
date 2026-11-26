import { CheckCircle2, FileText, Globe2 } from 'lucide-react';
import Link from 'next/link';
import {
  iceSourceReportPublicationState,
  iceSourceReportPublicationStateLabel,
} from '@/lib/ice-discovery-publication';

type PublicReport = {
  id: string;
  title: string;
  source_name: string;
  published_at: string;
};

type DraftReport = {
  id: string;
  title: string;
  source_name: string;
  rights_status: 'confirmed' | 'unconfirmed';
  publication_status: 'draft' | 'published';
  published_at: string;
};

function dateLabel(value: string) {
  return value.slice(0, 10);
}

function ReportLine({
  report,
  state,
}: {
  report: PublicReport | DraftReport;
  state: ReturnType<typeof iceSourceReportPublicationState>;
}) {
  return (
    <li className="border-t border-border py-2 first:border-t-0 first:pt-0">
      <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
        {report.title}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        <span>{report.source_name}</span>
        <span aria-hidden="true">/</span>
        <span>{dateLabel(report.published_at)}</span>
        <span aria-hidden="true">/</span>
        <span>{iceSourceReportPublicationStateLabel(state)}</span>
      </p>
    </li>
  );
}

export function IceCrawlPublicationGate({
  autoPublish,
  publicCount,
  scheduledCount = 0,
  awaitingRightsCount,
  rightsConfirmedDraftCount,
  publicPreview,
  draftPreview,
}: {
  autoPublish: boolean;
  publicCount: number;
  scheduledCount?: number;
  awaitingRightsCount: number;
  rightsConfirmedDraftCount: number;
  publicPreview: PublicReport[];
  draftPreview: DraftReport[];
}) {
  const draftCount = awaitingRightsCount + rightsConfirmedDraftCount;
  const now = Date.now();

  return (
    <section
      className="mb-5 border border-border bg-surface-card"
      aria-labelledby="publication-gate"
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe2 className="size-4 text-primary" aria-hidden="true" />
            <h2
              id="publication-gate"
              className="font-display text-2xl font-semibold tracking-[-0.03em]"
            >
              Publication gate
            </h2>
          </div>
          <span
            className={
              autoPublish
                ? 'border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-accent'
                : 'border border-border bg-background px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground'
            }
          >
            Auto-publish {autoPublish ? 'on' : 'off'}
          </span>
        </div>
        <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">
          A report is public only when all three gates pass: publication submitted, republication
          rights confirmed by an admin, and the publication time reached. Discovery intake is a
          draft factory while the switch is off
          {autoPublish
            ? '; when it is on, confirming rights releases a submitted row automatically.'
            : '; confirming rights keeps the row here until an admin publishes it.'}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-foreground">
                <CheckCircle2 className="size-3.5 text-primary" aria-hidden="true" />
                Public now
              </p>
              <span className="font-mono text-lg font-bold tabular-nums">{publicCount}</span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              Submitted, rights-confirmed and live.{' '}
              {scheduledCount > 0 ? `${scheduledCount} scheduled for later. ` : ''}
              <Link
                href="/ice-alerts/web-reports"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Open the public archive
              </Link>
              .
            </p>
            {publicPreview.length > 0 ? (
              <ul className="mt-3">
                {publicPreview.map((report) => (
                  <ReportLine
                    key={report.id}
                    report={report}
                    state={iceSourceReportPublicationState(
                      {
                        rights_status: 'confirmed',
                        publication_status: 'published',
                        published_at: report.published_at,
                      },
                      now
                    )}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <FileText className="size-3.5" aria-hidden="true" />
                No public reports yet.
              </p>
            )}
          </div>

          <div className="border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-foreground">
                <FileText className="size-3.5 text-accent" aria-hidden="true" />
                Drafts
              </p>
              <span className="font-mono text-lg font-bold tabular-nums">{draftCount}</span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              {awaitingRightsCount} awaiting rights · {rightsConfirmedDraftCount} rights-confirmed
              but unpublished. Nothing here is visible to readers.
            </p>
            {draftPreview.length > 0 ? (
              <ul className="mt-3">
                {draftPreview.map((report) => (
                  <ReportLine
                    key={report.id}
                    report={report}
                    state={iceSourceReportPublicationState(report, now)}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                No drafts waiting.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
