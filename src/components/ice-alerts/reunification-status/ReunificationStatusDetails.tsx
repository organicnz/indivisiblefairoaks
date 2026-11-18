import { Clock3, LockKeyhole, Phone, ShieldCheck } from 'lucide-react';
import {
  reunificationStatusDescription,
  reunificationStatusLabel,
  type ReunificationStatus,
  type ReunificationStatusView,
} from '@/lib/ice-reunification';
import { StatusShell } from './StatusShell';

const statusStyles: Record<ReunificationStatus, string> = {
  received: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  verifying: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  verified: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  closed: 'border-border bg-surface-muted text-muted-foreground',
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

type ReunificationStatusDetailsProps = {
  request: ReunificationStatusView;
  contactEmail: string;
};

export function ReunificationStatusDetails({
  request,
  contactEmail,
}: ReunificationStatusDetailsProps) {
  const status = request.status;

  return (
    <StatusShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="civic-kicker">Private family reunification</p>
        <span className="civic-stamp">Not a public alert</span>
      </div>

      <div className="mt-4 border border-border bg-surface-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Reference
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-[0.08em] text-foreground">
              {request.reference_code}
            </p>
          </div>
          <span
            className={`inline-flex min-h-8 items-center border px-3 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] ${statusStyles[status]}`}
          >
            {reunificationStatusLabel(status)}
          </span>
        </div>

        <h1 className="mt-7 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
          {reunificationStatusLabel(status)}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {reunificationStatusDescription(status)}
        </p>

        {request.status_note ? (
          <div className="mt-5 border-l-2 border-primary bg-primary/5 p-4">
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Volunteer note
            </p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground">
              {request.status_note}
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
            Received {formatTimestamp(request.created_at)}
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
            Updated {formatTimestamp(request.updated_at)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="border border-border bg-surface-muted p-5">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">
                Keep this link private.
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                This page shows only the reference and status. It never displays the person&apos;s
                name, photo, case notes, or contact details.
              </p>
            </div>
          </div>
        </div>

        <div className="border border-border bg-surface-card p-5">
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">
                Need to correct something?
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Contact the chapter and include the reference code. Do not send new identity
                documents unless a volunteer asks you to.
              </p>
              <a
                href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                  `Private reunification ${request.reference_code}`
                )}`}
                className="mt-2 inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2"
              >
                Contact the chapter
              </a>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        This service cannot guarantee an outcome or a release date. Immediate danger? Call 911.
      </p>
    </StatusShell>
  );
}
