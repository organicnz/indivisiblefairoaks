'use client';

import { Check, ExternalLink, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { promoteIceCrawlReportAction } from '@/lib/actions/ice-crawl';

type DiscoveryReport = {
  id: string;
  title: string;
  source_name: string;
  source_url: string;
  summary: string | null;
  published_at: string;
};

export function IceCrawlPromotion({ reports }: { reports: DiscoveryReport[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (reports.length === 0) return null;

  return (
    <section className="mb-5 border border-border bg-surface-card">
      <div className="flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
            Discovery summaries awaiting rights
          </h2>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          These cases were admitted automatically as attributed summaries. Promote one only after
          confirming the chapter may republish the source&apos;s full text.
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

      <div className="divide-y divide-border border-t border-border">
        {reports.map((report) => (
          <article key={report.id} className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                  {report.source_name} · summary only
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
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setActiveId(report.id);
                  startTransition(async () => {
                    const result = await promoteIceCrawlReportAction({ id: report.id });
                    setActiveId(null);
                    if (!result.success) {
                      setError(result.error);
                      return;
                    }
                    setMessage(result.message);
                    router.refresh();
                  });
                }}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 border border-primary bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white hover:bg-primary-dark disabled:opacity-55"
              >
                {pending && activeId === report.id ? (
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
    </section>
  );
}
