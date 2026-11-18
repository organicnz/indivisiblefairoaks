'use client';

import {
  AlertTriangle,
  Check,
  ExternalLink,
  Globe2,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  approveIceCrawlDiscoveryAction,
  discoverIceCrawlCandidatesAction,
  rejectIceCrawlDiscoveryAction,
} from '@/lib/actions/ice-crawl';
import type { IceCrawlDiscovery } from '@/lib/ice-crawl-types';

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

export function IceCrawlDiscovery({
  discoveries,
  loadError = false,
}: {
  discoveries: IceCrawlDiscovery[];
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
                {discoveries.length} shown
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Searches GDELT, Bing News, major-outlet RSS and public Mastodon timelines for new
              ICE enforcement, detention and checkpoint coverage across the country. Discovery
              only stores a headline and link; a candidate is fetched and run through AI extraction
              only after an admin confirms republication rights.
            </p>
          </div>
        </div>
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

      {loadError ? (
        <p
          role="alert"
          className="mx-5 mb-5 flex items-start gap-2 border border-accent/40 bg-accent/10 p-3 text-xs leading-relaxed"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
          The discovery table could not be loaded. Apply the latest database migration and try again.
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
        <p role="status" className="mx-5 mb-5 border border-primary/30 bg-surface-card p-3 text-xs leading-relaxed">
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

      {!loadError && discoveries.length === 0 ? (
        <p className="mx-5 mb-5 border border-border bg-surface-card p-4 text-sm text-muted-foreground">
          No pending nationwide candidates. Run a scan, or add an approved source below for
          deeper coverage of a publisher you already trust.
        </p>
      ) : null}

      {discoveries.length > 0 ? (
        <div className="divide-y divide-border border-t border-border bg-surface-card">
          {discoveries.map((discovery) => (
            <article key={discovery.id} className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="border border-accent/35 bg-accent/5 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-accent">
                      Rights review required
                    </span>
                    <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      {discovery.publisher || hostname(discovery.url)}
                    </span>
                    <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      {dateLabel(discovery.published_at)}
                    </span>
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
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      runAction(
                        () => approveIceCrawlDiscoveryAction({ id: discovery.id }),
                        discovery.id
                      )
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
                      runAction(
                        () => rejectIceCrawlDiscoveryAction({ id: discovery.id }),
                        discovery.id
                      )
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
          ))}
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
