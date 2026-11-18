import { ExternalLink, RefreshCw } from 'lucide-react';
import { formatTimestamp, statusClass, statusLabel, type SourceHealth } from './ice-data';

export function DataStatusSection({ sources }: { sources: SourceHealth[] }) {
  return (
        <section className="mt-8 border border-border bg-surface-card">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-5 sm:p-6">
            <div>
              <p className="civic-section-index">Source status</p>
              <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                What was checked, and when.
              </h2>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                A partial run means at least one page was blocked, skipped, or over the configured
                limit. It is not presented as complete.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 border border-border bg-surface-muted px-2.5 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              <RefreshCw className="size-3" aria-hidden="true" />
              Updated by the crawler
            </span>
          </div>

          {sources.length === 0 ? (
            <p className="p-5 text-xs leading-relaxed text-muted-foreground">
              Source status is unavailable on this deployment.
            </p>
          ) : (
            <div
              role="region"
              aria-label="Source status table; scroll horizontally to view all columns"
              tabIndex={0}
              className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <table className="w-full min-w-[44rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-muted">
                    <th className="px-4 py-2.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Source
                    </th>
                    <th className="px-4 py-2.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Last checked
                    </th>
                    <th className="px-4 py-2.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-right font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Pages
                    </th>
                    <th className="px-4 py-2.5 text-right font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      New last run
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.url} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground underline underline-offset-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {source.label}
                          <ExternalLink className="size-2.5" aria-hidden="true" />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatTimestamp(source.last_crawled_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] ${statusClass(source.last_status)}`}
                        >
                          {statusLabel(source.last_status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-foreground">
                        {source.last_page_count.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-foreground">
                        {source.last_report_count.toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
  );
}
