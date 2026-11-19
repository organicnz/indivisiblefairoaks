'use client';

import {
  AlertTriangle,
  Check,
  ExternalLink,
  LoaderCircle,
  Play,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  addIceCrawlSourceAction,
  runIceCrawlSourceAction,
  setIceCrawlSourceEnabledAction,
} from '@/lib/actions/ice-crawl';
import type { IceCrawlSource } from '@/lib/ice-crawl-types';

const inputClass =
  'mt-1 min-h-10 w-full border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground focus-visible:ring-2 focus-visible:ring-primary/40';

const labelClass =
  'block font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground';

function stableTimestamp(value: string | null) {
  return value ? `${value.slice(0, 16).replace('T', ' ')} UTC` : 'never';
}

function statusClass(status: IceCrawlSource['last_status']) {
  if (status === 'ok')
    return 'border-primary/35 bg-primary/5 text-primary-ink dark:text-primary-on-dark';
  if (status === 'partial') return 'border-accent/40 bg-accent/5 text-accent';
  if (status === 'blocked') return 'border-border bg-surface-muted text-muted-foreground';
  if (status === 'error') return 'border-accent/40 bg-accent/10 text-accent';
  return 'border-border bg-background text-muted-foreground';
}

export function IceCrawlManager({ sources }: { sources: IceCrawlSource[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [maxPages, setMaxPages] = useState('20');
  const [rights, setRights] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  function runAction(
    action: () => Promise<{ success: boolean; error?: string; summary?: unknown }>,
    success: string
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error || 'That action failed.');
        setActiveId(null);
        return;
      }
      setMessage(success);
      setActiveId(null);
      router.refresh();
    });
  }

  function addSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await addIceCrawlSourceAction({
        url,
        label,
        maxPages: Number(maxPages),
        rightsConfirmed: rights,
      });
      if (!result.success) {
        setError(result.error || 'Could not add the source.');
        return;
      }
      setUrl('');
      setLabel('');
      setMaxPages('20');
      setRights(false);
      setMessage('Source added. Run it when you are ready to collect.');
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <section className="border border-border bg-surface-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center border border-primary/30 bg-primary/5">
            <Plus className="size-4 text-primary" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
              Add an approved public source
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              A seed page or public feed. The crawler follows same-origin links, discovers
              RSS/Atom/JSON feeds and sitemaps, reads long pages in overlapping chunks, and stores
              every fetched page. A source page limit protects the target site and this deployment;
              when it is reached, the run is marked partial.
            </p>
          </div>
        </div>

        <form
          onSubmit={addSource}
          className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_8rem_auto] lg:items-end"
        >
          <div>
            <label htmlFor="ice-crawl-url" className={labelClass}>
              Public seed URL <span className="text-accent">*</span>
            </label>
            <input
              id="ice-crawl-url"
              type="url"
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.org/ice-reports"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="ice-crawl-label" className={labelClass}>
              Source label <span className="text-accent">*</span>
            </label>
            <input
              id="ice-crawl-label"
              required
              maxLength={120}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Example News"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="ice-crawl-max-pages" className={labelClass}>
              Max pages
            </label>
            <input
              id="ice-crawl-max-pages"
              type="number"
              min={1}
              max={200}
              value={maxPages}
              onChange={(event) => setMaxPages(event.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={pending || !rights}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 border border-primary bg-primary px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-55"
          >
            {pending && !activeId ? (
              <LoaderCircle className="size-3 animate-spin" />
            ) : (
              <Plus className="size-3" />
            )}
            Add source
          </button>
        </form>

        <label className="mt-3 flex items-start gap-2.5 border border-border bg-surface-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            checked={rights}
            onChange={(event) => setRights(event.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            I confirm that Indivisible Fair Oaks-Carmichael may republish public text from this
            source, and that the source is not private, login-gated, or a vehicle for harassment.
          </span>
        </label>
      </section>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 border border-accent/40 bg-accent/10 p-3 text-xs leading-relaxed"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          role="status"
          className="border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed"
        >
          <Check className="mr-1 inline size-3.5" aria-hidden="true" />
          {message}
        </p>
      ) : null}

      {sources.length === 0 ? (
        <p className="border border-border bg-surface-card p-5 text-sm text-muted-foreground">
          No sources have been added yet. Add a public page or feed above, then run it.
        </p>
      ) : (
        <div className="grid gap-4">
          {sources.map((source) => (
            <article key={source.id} className="border border-border bg-surface-card">
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] ${statusClass(source.last_status)}`}
                    >
                      {source.last_status ?? 'never run'}
                    </span>
                    <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      Max {source.max_pages} pages
                    </span>
                    {!source.enabled ? (
                      <span className="border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                        Disabled
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-2 flex items-center gap-2 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                    {source.label}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${source.label}`}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </h2>
                  <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">
                    {source.url}
                  </p>
                  <p className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    Last run {stableTimestamp(source.last_crawled_at)} / {source.last_page_count}{' '}
                    pages / {source.last_report_count} reports
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(source.id);
                      runAction(
                        () => runIceCrawlSourceAction({ id: source.id }),
                        `Crawl finished for ${source.label}.`
                      );
                    }}
                    disabled={pending}
                    className="inline-flex min-h-9 items-center gap-1.5 border border-primary bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-55"
                  >
                    {pending && activeId === source.id ? (
                      <LoaderCircle className="size-3 animate-spin" />
                    ) : (
                      <Play className="size-3" />
                    )}
                    Run now
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runAction(
                        () =>
                          setIceCrawlSourceEnabledAction({
                            id: source.id,
                            enabled: !source.enabled,
                          }),
                        source.enabled ? 'Source disabled.' : 'Source enabled.'
                      )
                    }
                    disabled={pending}
                    className="inline-flex min-h-9 items-center gap-1.5 border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-55"
                  >
                    {source.enabled ? <X className="size-3" /> : <Check className="size-3" />}
                    {source.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
              {source.last_error ? (
                <p className="flex items-start gap-2 border-t border-border bg-surface-muted px-4 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
                  <AlertTriangle
                    className="mt-0.5 size-3 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  {source.last_error}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
        Scheduled runs use <code className="font-mono">POST /api/ice-crawl/run</code> with the cron
        bearer token. The source allowlist remains the publication boundary: nationwide discovery
        queues external headlines, but an article is only fetched after an admin confirms the
        chapter may republish it.
      </p>
    </div>
  );
}
