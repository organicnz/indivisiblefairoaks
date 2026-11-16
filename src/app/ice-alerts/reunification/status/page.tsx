import {
  ArrowLeft,
  Clock3,
  LockKeyhole,
  Phone,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { env } from '@/lib/env';
import {
  findReunificationStatus,
  getReunificationStore,
  isReunificationUuid,
  reunificationStatusDescription,
  reunificationStatusLabel,
  type ReunificationStatus,
} from '@/lib/ice-reunification';
import { pageMetadata } from '@/lib/metadata';

export const instant = false;

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Private Reunification Status — ICE Alert',
    description: 'A private status page for a family reunification request.',
    path: '/ice-alerts/reunification/status',
    robots: { index: false, follow: false },
  }),
  referrer: 'no-referrer',
};

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

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

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="civic-page min-h-screen w-full bg-background text-foreground">
      <header className="border-b border-border pt-(--header-clearance)">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a
            href="/ice-alerts/reunification"
            className="inline-flex min-h-8 items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Reunification request
          </a>
          <span className="civic-stamp">Private status / do not share</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">{children}</main>
    </div>
  );
}

function GenericMessage({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <Shell>
      <div className="border border-border bg-surface-card p-6 sm:p-8">
        <TriangleAlert className="size-6 text-accent" aria-hidden="true" />
        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{body}</p>
        <a
          href="/ice-alerts/reunification"
          className="mt-5 inline-flex min-h-9 items-center border border-border px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground"
        >
          Return to the private request page
        </a>
      </div>
    </Shell>
  );
}

export default async function ReunificationStatusPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  if (!isReunificationUuid(token)) {
    return (
      <GenericMessage
        title="This status link is incomplete."
        body="Open the exact link from your confirmation email. The link contains a private key; do not edit or shorten it."
      />
    );
  }

  const store = getReunificationStore();
  if (!store) {
    return (
      <GenericMessage
        title="Status lookup is not configured."
        body="The private request system is not fully configured on this deployment. Contact the chapter directly if you need an update."
      />
    );
  }

  let request;
  try {
    request = await findReunificationStatus(store, token);
  } catch {
    return (
      <GenericMessage
        title="Status is temporarily unavailable."
        body="The lookup could not be completed. Try again shortly, or contact the chapter using the address on the main site."
      />
    );
  }

  if (!request) {
    return (
      <GenericMessage
        title="No request matches this link."
        body="The link may be incorrect or expired. Use the exact link from your confirmation email, or contact the chapter."
      />
    );
  }

  const status = request.status;
  const contactEmail = env.ADMIN_ORDER_EMAIL || 'contact@indivisiblefairoaks.org';

  return (
    <Shell>
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
    </Shell>
  );
}
