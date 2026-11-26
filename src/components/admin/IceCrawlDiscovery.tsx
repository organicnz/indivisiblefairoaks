'use client';

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe2,
  Layers,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  approveIceCrawlDiscoveryAction,
  discoverIceCrawlCandidatesAction,
  rejectIceCrawlDiscoveryAction,
  triageIceCrawlDiscoveriesAction,
} from '@/lib/actions/ice-crawl';
import {
  ICE_DISCOVERY_MAX_ATTEMPTS,
  type IceCrawlDiscovery as IceCrawlDiscoveryRow,
  type IceCrawlDiscoveryTriageConfidence,
  iceDiscoveryAttemptsExhausted,
  iceDiscoveryConfidenceLabel,
  iceDiscoveryRelevanceLabel,
} from '@/lib/ice-crawl-types';

function hostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

function dateLabel(value: string | null) {
  return value ? value.slice(0, 10) : 'date not stated';
}

function confidenceClass(confidence: IceCrawlDiscoveryTriageConfidence | null) {
  if (confidence === 'high') {
    return 'border-primary/40 bg-primary/10 text-primary-ink dark:text-primary-on-dark';
  }
  if (confidence === 'medium') {
    return 'border-accent/35 bg-accent/5 text-accent';
  }
  return 'border-border bg-background text-muted-foreground';
}

export function IceCrawlDiscovery({
  discoveries,
  topConfidence = [],
  total = discoveries.length,
  exhaustedTotal = 0,
  collapsedDuplicates = 0,
  page = 1,
  pageSize = 30,
  sort = 'oldest',
  loadError = false,
}: {
  discoveries: IceCrawlDiscoveryRow[];
  topConfidence?: IceCrawlDiscoveryRow[];
  total?: number;
  exhaustedTotal?: number;
  collapsedDuplicates?: number;
  page?: number;
  pageSize?: number;
  sort?: 'oldest' | 'confidence';
  loadError?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runAction(
    action: () => Promise<{ success: boolean; message?: string; error?: string; warning?: string }>,
    id: string | null
  ) {
    setError(null);
    setMessage(null);
    setWarning(null);
    setActiveId(id);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error || 'That action failed.');
        setActiveId(null);
        return;
      }
      setMessage(result.message || 'Done.');
      if (result.warning) setWarning(result.warning);
      setActiveId(null);
      router.refresh();
    });
  }

  function queueHref(nextPage: number, nextSort: 'oldest' | 'confidence' = sort) {
    const params = new URLSearchParams();
    if (nextPage > 1) params.set('discoveryPage', String(nextPage));
    if (nextSort !== 'oldest') params.set('discoverySort', nextSort);
    const query = params.toString();
    return query ? `/admin/ice-crawl?${query}` : '/admin/ice-crawl';
  }

  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function discoveryRow(discovery: IceCrawlDiscoveryRow, keyPrefix = 'queue') {
    const attempts = discovery.attempt_count ?? 0;
    const exhausted = iceDiscoveryAttemptsExhausted(attempts);
    return (
      <article key={`${keyPrefix}-${discovery.id}`} className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="border border-accent/35 bg-accent/5 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-accent">
                Rights review required
              </span>
              {exhausted ? (
                <span className="inline-flex items-center gap-1 border border-accent/50 bg-accent/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-accent">
                  <AlertTriangle className="size-2.5" aria-hidden="true" />
                  Retry limit reached · {attempts}/{ICE_DISCOVERY_MAX_ATTEMPTS}
                </span>
              ) : attempts > 0 ? (
                <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Retry {attempts}/{ICE_DISCOVERY_MAX_ATTEMPTS} used
                </span>
              ) : null}
              <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {discovery.publisher || hostname(discovery.url)}
              </span>
              <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {dateLabel(discovery.published_at)}
              </span>
              {discovery.triage_score !== null ? (
                <>
                  <span
                    className={`border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] ${confidenceClass(discovery.triage_confidence)}`}
                  >
                    {iceDiscoveryConfidenceLabel(discovery.triage_confidence)}
                  </span>
                  <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    {discovery.triage_score}/100
                  </span>
                  {discovery.triage_relevance ? (
                    <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      {iceDiscoveryRelevanceLabel(discovery.triage_relevance)}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Not triaged
                </span>
              )}
            </div>
            <h3 className="mt-2 max-w-4xl font-display text-xl font-semibold leading-tight tracking-[-0.02em]">
              <a
                href={discovery.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-border underline-offset-4 transition-colors hover:text-primary"
              >
                {discovery.title}
                <ExternalLink className="ml-1 inline size-3.5" aria-hidden="true" />
              </a>
            </h3>
            <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">
              {discovery.url}
            </p>
            {discovery.triage_reason ? (
              <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
                <Sparkles className="mr-1 inline size-3 text-primary" aria-hidden="true" />
                {discovery.triage_reason}
              </p>
            ) : null}
            {discovery.review_note ? (
              <p
                className={`mt-2 max-w-3xl break-words text-[11px] leading-relaxed ${
                  exhausted ? 'text-accent' : 'text-muted-foreground'
                }`}
              >
                <AlertTriangle className="mr-1 inline size-3 shrink-0" aria-hidden="true" />
                <span className="font-semibold">
                  {exhausted ? 'Retry stopped:' : 'Last automatic attempt:'}
                </span>{' '}
                {discovery.review_note}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                runAction(() => approveIceCrawlDiscoveryAction({ id: discovery.id }), discovery.id)
              }
              disabled={pending}
              className="inline-flex min-h-9 items-center gap-1.5 border border-primary bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-55"
            >
              {pending && activeId === discovery.id ? (
                <LoaderCircle className="size-3 animate-spin" />
              ) : (
                <ShieldCheck className="size-3" />
              )}
              Approve rights &amp; crawl
            </button>
            <button
              type="button"
              onClick={() =>
                runAction(() => rejectIceCrawlDiscoveryAction({ id: discovery.id }), discovery.id)
              }
              disabled={pending}
              className="inline-flex min-h-9 items-center gap-1.5 border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-55"
            >
              <X className="size-3" />
              Reject
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <section className="mb-5 border border-primary/30 bg-primary/5">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center border border-primary/30 bg-primary/10">
            <Globe2 className="size-4 text-primary" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
                Nationwide discovery
              </h2>
              <span className="border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-primary-ink dark:text-primary-on-dark">
                {total} pending
              </span>
              {exhaustedTotal > 0 ? (
                <span className="inline-flex items-center gap-1 border border-accent/45 bg-accent/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-accent">
                  <AlertTriangle className="size-2.5" aria-hidden="true" />
                  {exhaustedTotal} at retry limit
                </span>
              ) : null}
              {collapsedDuplicates > 0 ? (
                <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {collapsedDuplicates} duplicate story/stories collapsed
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Searches GDELT, Bing News, major-outlet RSS and public Mastodon timelines for new ICE
              enforcement, detention and checkpoint coverage across the country. AI triage ranks the
              headline backlog and collapses syndicated copies; a candidate is fetched and admitted
              only as an attributed summary, and it stays out of public reports until an admin
              confirms republication rights.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runAction(triageIceCrawlDiscoveriesAction, '__triage__')}
            disabled={pending || total === 0}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 border border-primary/40 bg-surface-card px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-primary-ink transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-55 dark:text-primary-on-dark"
          >
            {pending && activeId === '__triage__' ? (
              <LoaderCircle className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3" />
            )}
            AI triage backlog
          </button>
          <button
            type="button"
            onClick={() => runAction(discoverIceCrawlCandidatesAction, null)}
            disabled={pending}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 border border-primary bg-primary px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-55"
          >
            {pending && activeId === null ? (
              <LoaderCircle className="size-3 animate-spin" />
            ) : (
              <ScanSearch className="size-3" />
            )}
            Scan nationwide web
          </button>
        </div>
      </div>

      {loadError ? (
        <p
          role="alert"
          className="mx-5 mb-5 flex items-start gap-2 border border-accent/40 bg-accent/10 p-3 text-xs leading-relaxed"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
          The discovery table could not be loaded. Apply the latest database migration and try
          again.
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mx-5 mb-5 flex items-start gap-2 border border-accent/40 bg-accent/10 p-3 text-xs leading-relaxed"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          role="status"
          className="mx-5 mb-5 border border-primary/30 bg-surface-card p-3 text-xs leading-relaxed"
        >
          <Check className="mr-1 inline size-3.5" aria-hidden="true" />
          {message}
        </p>
      ) : null}
      {warning ? (
        <p className="mx-5 mb-5 flex items-start gap-2 border border-accent/35 bg-accent/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
          {warning}
        </p>
      ) : null}

      {topConfidence.length > 0 ? (
        <div className="border-t border-primary/20 bg-surface-card">
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">
                Highest ICE-enforcement confidence
              </h3>
              <span className="border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-primary-ink dark:text-primary-on-dark">
                AI ranked
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
              These are ranked first because the model found a concrete ICE enforcement signal, not
              because they have been approved. Rights review is still required before publication.
            </p>
          </div>
          <div className="divide-y divide-border border-t border-border">
            {topConfidence.map((discovery) => discoveryRow(discovery, 'top'))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-5 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {total === 0
            ? 'No reviewable candidates'
            : `Showing ${firstRow}–${lastRow} of ${total} · ${sort === 'oldest' ? 'Oldest first' : 'Highest confidence'}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={queueHref(1, sort === 'oldest' ? 'confidence' : 'oldest')}
            className="inline-flex min-h-8 items-center border border-border bg-background px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-foreground"
          >
            <Layers className="mr-1 size-3" aria-hidden="true" />
            {sort === 'oldest' ? 'Sort by confidence' : 'Sort oldest first'}
          </Link>
          <Link
            href={queueHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`inline-flex min-h-8 items-center border border-border bg-background px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] transition-colors hover:border-foreground ${
              page <= 1 ? 'pointer-events-none opacity-40' : 'text-foreground'
            }`}
          >
            <ChevronLeft className="mr-1 size-3" aria-hidden="true" />
            Previous
          </Link>
          <Link
            href={queueHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={`inline-flex min-h-8 items-center border border-border bg-background px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] transition-colors hover:border-foreground ${
              page >= totalPages ? 'pointer-events-none opacity-40' : 'text-foreground'
            }`}
          >
            Next
            <ChevronRight className="ml-1 size-3" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {!loadError && total === 0 ? (
        <p className="mx-5 mb-5 border border-border bg-surface-card p-4 text-sm text-muted-foreground">
          No pending nationwide candidates. Run a scan, or add an approved source below for deeper
          coverage of a publisher you already trust.
        </p>
      ) : null}

      {!loadError && total > 0 && discoveries.length === 0 ? (
        <p className="mx-5 mb-5 border border-border bg-surface-card p-4 text-sm text-muted-foreground">
          This page is empty. Use the pagination controls to return to the oldest pending
          candidates.
        </p>
      ) : null}

      {discoveries.length > 0 ? (
        <div className="divide-y divide-border border-t border-border bg-surface-card">
          {discoveries.map((discovery) => discoveryRow(discovery))}
        </div>
      ) : null}

      <p className="flex items-start gap-2 px-5 py-4 text-[10px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
        Coverage is broad but not a literal copy of the internet: public news indexes, major-outlet
        feeds and public Mastodon posts. Private, login-gated and unindexed pages, plus Facebook,
        Instagram, TikTok, X and Bluesky posts, require an official API or an approved source.
      </p>
    </section>
  );
}
