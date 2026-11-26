'use client';

import { Check, ExternalLink, LoaderCircle, Send, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { promoteIceCrawlReportAction, publishIceCrawlReportAction } from '@/lib/actions/ice-crawl';
import {
  iceSourceReportPublicationState,
  iceSourceReportPublicationStateLabel,
} from '@/lib/ice-discovery-publication';

type DiscoveryReport = {
  id: string;
  title: string;
  source_name: string;
  source_url: string;
  summary: string | null;
  publication_status: 'draft' | 'published';
  published_at: string;
};

type ConfirmedDraft = {
  id: string;
  title: string;
  source_name: string;
  source_url: string;
  rights_status: 'confirmed' | 'unconfirmed';
  publication_status: 'draft' | 'published';
  published_at: string;
};

export function IceCrawlPromotion({
  reports,
  confirmedDrafts = [],
  autoPublish = false,
}: {
  reports: DiscoveryReport[];
  confirmedDrafts?: ConfirmedDraft[];
  autoPublish?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (reports.length === 0 && confirmedDrafts.length === 0) return null;

  function run(
    id: string,
    action: () => Promise<{ success: boolean; message?: string; error?: string }>
  ) {
    setError(null);
    setMessage(null);
    setActiveId(id);
    startTransition(async () => {
      const result = await action();
      setActiveId(null);
      if (!result.success) {
        setError(result.error ?? 'That action failed.');
        return;
      }
      setMessage(result.message ?? 'Done.');
      router.refresh();
    });
  }

  return (
    <section className="mb-5 border border-border bg-surface-card">
      <div className="flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
            Discovery rights and publication
          </h2>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          These cases were admitted automatically as attributed summaries. Promoting one confirms
          the chapter may republish the source&apos;s full text
          {autoPublish
            ? ' and publishes it, because auto-publish is on.'
            : '. It stays a draft until you publish it below.'}
        </p>
      </div>

      {error ? (
        <p role="alert" className="mx-5 mb-4 border border-accent/40 bg-accent/10 p-3 text-xs">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mx-5 mb-4 border border-primary/30 bg-primary/5 p-3 text-xs">
          <Check className="mr-1 inline size-3.5" aria-hidden="true" />
          {message}
        </p>
      ) : null}

      {reports.length > 0 ? (
        <div className="border-t border-border">
          <p className="border-b border-border bg-background px-5 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Awaiting rights · {reports.length}
          </p>
          <div className="divide-y divide-border">
            {reports.map((report) => (
              <article key={report.id} className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                      {report.source_name} · summary only ·{' '}
                      {iceSourceReportPublicationStateLabel(
                        iceSourceReportPublicationState({
                          ...report,
                          rights_status: 'unconfirmed',
                        })
                      )}
                    </p>
                    <h3 className="mt-1 max-w-4xl font-display text-lg font-semibold leading-tight">
                      <a
                        href={report.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-border underline-offset-4 hover:text-primary"
                      >
                        {report.title}
                        <ExternalLink className="ml-1 inline size-3.5" aria-hidden="true" />
                      </a>
                    </h3>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(`promote-${report.id}`, () =>
                        promoteIceCrawlReportAction({ id: report.id })
                      )
                    }
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 border border-primary bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white hover:bg-primary-dark disabled:opacity-55"
                  >
                    {pending && activeId === `promote-${report.id}` ? (
                      <LoaderCircle className="size-3 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-3" />
                    )}
                    Confirm rights &amp; promote
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {confirmedDrafts.length > 0 ? (
        <div className="border-t border-border">
          <p className="border-b border-border bg-background px-5 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Rights confirmed · draft · {confirmedDrafts.length}
          </p>
          <div className="divide-y divide-border">
            {confirmedDrafts.map((report) => (
              <article key={report.id} className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                      {report.source_name} · full text · not public
                    </p>
                    <h3 className="mt-1 max-w-4xl font-display text-lg font-semibold leading-tight">
                      <a
                        href={report.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-border underline-offset-4 hover:text-primary"
                      >
                        {report.title}
                        <ExternalLink className="ml-1 inline size-3.5" aria-hidden="true" />
                      </a>
                    </h3>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(`publish-${report.id}`, () =>
                        publishIceCrawlReportAction({ id: report.id })
                      )
                    }
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 border border-primary bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white hover:bg-primary-dark disabled:opacity-55"
                  >
                    {pending && activeId === `publish-${report.id}` ? (
                      <LoaderCircle className="size-3 animate-spin" />
                    ) : (
                      <Send className="size-3" />
                    )}
                    Publish now
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
