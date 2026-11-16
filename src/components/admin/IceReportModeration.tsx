'use client';

import {
  AlertTriangle,
  Check,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  publishIceReportAction,
  recommendIceReport,
  rejectIceReport,
} from '@/lib/actions/ice-reports';
import {
  iceReportKindLabel,
  iceReportStatusLabel,
  type IceReportIntakeRow,
} from '@/lib/ice-report-shared';
import { US_STATE_OPTIONS } from '@/components/ice-alerts/us-state-options';

const inputClass =
  'mt-1 min-h-10 w-full border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground focus-visible:ring-2 focus-visible:ring-primary/40';

const labelClass =
  'block font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground';

function stableTimestamp(value: string) {
  return `${value.slice(0, 16).replace('T', ' ')} UTC`;
}

export function IceReportModeration({
  reports,
  currentAdminId,
}: {
  reports: IceReportIntakeRow[];
  currentAdminId: string;
}) {
  if (reports.length === 0) {
    return (
      <div className="border border-border bg-surface-card p-6">
        <p className="font-display text-xl font-semibold tracking-[-0.02em]">Queue is clear.</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          No reports are waiting for review. Raw reports are retained privately for up to 30 days.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {reports.map((report) => (
        <ModerationCard
          key={report.id}
          report={report}
          currentAdminId={currentAdminId}
        />
      ))}
    </div>
  );
}

function ModerationCard({
  report,
  currentAdminId,
}: {
  report: IceReportIntakeRow;
  currentAdminId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [publicCity, setPublicCity] = useState(report.public_city || report.city);
  const [publicStateCode, setPublicStateCode] = useState(
    report.public_state_code || report.state_code
  );
  const [publicSummary, setPublicSummary] = useState(report.public_summary || '');
  const [rejectionReason, setRejectionReason] = useState(report.rejection_reason || '');

  const isFirstReview = report.status === 'received';
  const isSecondReview = report.status === 'needs_second_review';
  const isOwnDraft = report.reviewer_one_id === currentAdminId;

  function run(action: () => Promise<{ success: boolean; error?: string }>, success: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error || 'That action failed.');
        return;
      }
      setNotice(success);
      router.refresh();
    });
  }

  return (
    <article className="border border-border bg-surface-card">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {iceReportStatusLabel(report.status)}
            </span>
            <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {iceReportKindLabel(report.kind)}
            </span>
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
            {report.city}, {report.state_code}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-2.5" aria-hidden="true" />
              Observed {stableTimestamp(report.observed_at)}
            </span>
            <span>Received {stableTimestamp(report.created_at)}</span>
          </p>
        </div>
        <span className="font-mono text-[9px] font-bold tracking-[0.08em] text-muted-foreground">
          {report.reference_code}
        </span>
      </header>

      <div className="space-y-4 p-4">
        <section>
          <p className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-accent">
            <LockKeyhole className="size-3" aria-hidden="true" />
            Private raw report
          </p>
          <p className="mt-1.5 border border-border bg-surface-muted p-3 text-xs leading-relaxed text-foreground">
            {report.summary}
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
            Do not paste this text into the public draft. Remove names, faces, plates, addresses,
            immigration status, contact details, and any exact location.
          </p>
        </section>

        {isFirstReview ? (
          <fieldset disabled={pending} className="space-y-3 border-t border-border pt-4">
            <legend className="font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              Prepare sanitized public draft
            </legend>
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
              <div>
                <label htmlFor={`public-city-${report.id}`} className={labelClass}>
                  Public city
                </label>
                <input
                  id={`public-city-${report.id}`}
                  value={publicCity}
                  onChange={(event) => setPublicCity(event.target.value)}
                  className={inputClass}
                  maxLength={80}
                />
              </div>
              <div>
                <label htmlFor={`public-state-${report.id}`} className={labelClass}>
                  State
                </label>
                <select
                  id={`public-state-${report.id}`}
                  value={publicStateCode}
                  onChange={(event) => setPublicStateCode(event.target.value)}
                  className={inputClass}
                >
                  {US_STATE_OPTIONS.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor={`public-summary-${report.id}`} className={labelClass}>
                Public summary (30–400 characters)
              </label>
              <textarea
                id={`public-summary-${report.id}`}
                value={publicSummary}
                onChange={(event) => setPublicSummary(event.target.value)}
                rows={4}
                maxLength={400}
                placeholder="Write a new, city-level summary. Do not copy the raw report."
                className={`${inputClass} resize-y leading-relaxed`}
              />
              <p className="mt-1 text-right font-mono text-[8px] font-bold text-muted-foreground">
                {publicSummary.length}/400
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  run(
                    () =>
                      recommendIceReport({
                        id: report.id,
                        publicCity,
                        publicStateCode,
                        publicSummary,
                      }),
                    'Sent to a second reviewer.'
                  )
                }
                className="inline-flex min-h-9 items-center gap-1.5 border border-primary bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              >
                {pending ? <LoaderCircle className="size-3 animate-spin" /> : <Check className="size-3" />}
                Send to second reviewer
              </button>
            </div>
          </fieldset>
        ) : null}

        {isSecondReview ? (
          <section className="space-y-2 border-t border-border pt-4">
            <p className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              <ShieldAlert className="size-3" aria-hidden="true" />
              Sanitized draft
            </p>
            <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">
              {report.public_city}, {report.public_state_code}
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">{report.public_summary}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => run(() => publishIceReportAction({ id: report.id }), 'Published.')}
                disabled={pending || isOwnDraft}
                title={isOwnDraft ? 'A different admin must approve this draft.' : undefined}
                className="inline-flex min-h-9 items-center gap-1.5 border border-primary bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-55"
              >
                {pending ? <LoaderCircle className="size-3 animate-spin" /> : <Check className="size-3" />}
                Approve and publish
              </button>
              {isOwnDraft ? (
                <p className="self-center text-[10px] leading-relaxed text-muted-foreground">
                  You prepared this draft. A second admin must approve it.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="space-y-2 border-t border-border pt-4">
          <label htmlFor={`reject-${report.id}`} className={labelClass}>
            Rejection reason (required to reject)
          </label>
          <input
            id={`reject-${report.id}`}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            maxLength={300}
            placeholder="e.g. identifying details or no usable city"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() =>
              run(
                () => rejectIceReport({ id: report.id, reason: rejectionReason }),
                'Report rejected and removed from the queue.'
              )
            }
            disabled={pending}
            className="inline-flex min-h-9 items-center gap-1.5 border border-accent/40 bg-accent/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            <X className="size-3" aria-hidden="true" />
            Reject report
          </button>
        </section>

        <div className="space-y-1">
          <p className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <MapPin className="size-3" aria-hidden="true" />
            Public pin is added from the city snapshot only at publication.
          </p>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Retention expires {stableTimestamp(report.retention_expires_at)}.
          </p>
        </div>

        {error ? (
          <p role="alert" className="flex items-start gap-2 border border-accent/40 bg-accent/10 p-2.5 text-[11px] leading-relaxed">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="border border-primary/30 bg-primary/5 p-2.5 text-[11px] leading-relaxed">
            {notice}
          </p>
        ) : null}
      </div>
    </article>
  );
}
