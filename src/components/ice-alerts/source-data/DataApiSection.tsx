import { ArrowRight, Database, ExternalLink, Globe2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { API_EXAMPLES } from './ice-data';

export function DataApiSection() {
  return (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <section className="min-w-0 border border-border bg-surface-card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="civic-section-index">Read-only API</p>
                <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                  Query JSON over HTTPS.
                </h2>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The API returns the same public projection as the archive. Use <code>q</code>,{' '}
              <code>kind</code>, <code>state</code>, and <code>city</code> to filter; <code>page</code>{' '}
              and <code>per_page</code> page through results. <code>per_page</code> is capped at 100.
              The archive&apos;s Near me control uses the <code>locate</code> endpoint, which resolves
              coordinates to the nearest city with published reports and never returns a precise
              report location.
            </p>

            <div className="mt-4 space-y-2">
              {API_EXAMPLES.map((example) => (
                <code
                  key={example}
                  className="block overflow-x-auto border border-border bg-background px-3 py-2 font-mono text-[10px] leading-relaxed text-foreground"
                >
                  GET {example}
                </code>
              ))}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <h3 className="font-mono text-[10px] font-bold tracking-[0.1em] text-muted-foreground">
                Response shape
              </h3>
              <pre
                role="region"
                aria-label="Example JSON response"
                tabIndex={0}
                className="mt-2 overflow-x-auto border border-border bg-background p-3 font-mono text-[10px] leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
{`{
  "ok": true,
  "dataset": "ice-source-reports",
  "total": 3524,
  "page": 1,
  "perPage": 20,
  "totalPages": 177,
  "filters": { "query": "", "kind": "all", "stateCode": "", "city": "" },
  "reports": [ { "id": "...", "source_url": "...", "refined_text": "..." } ]
}`}
              </pre>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="border border-primary/30 bg-primary/5 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="civic-section-index">Use boundary</p>
                  <h2 className="mt-1.5 font-display text-xl font-semibold leading-tight tracking-[-0.025em]">
                    Attribution, not endorsement.
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                The chapter does not independently verify these reports. Source text remains the
                publisher&apos;s; its terms may apply. Do not use this dataset to identify, locate, or
                harass any person. Structured location is city-level. The data layer keeps the
                attributed source extract for research; the public reading panel shows a cached AI
                digest, not copied prose.
              </p>
            </section>

            <section className="border border-border bg-surface-muted p-5">
              <p className="civic-section-index">Removal &amp; corrections</p>
              <h2 className="mt-1.5 font-display text-xl font-semibold leading-tight tracking-[-0.025em]">
                Operate a source?
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                If you publish a source and want a report corrected or removed, contact the chapter
                with the exact source URL. Do not send personal information about anyone in a
                report.
              </p>
              <Link
                href="/contact"
                className="mt-3 inline-flex min-h-9 items-center gap-1.5 border border-border bg-background px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Contact the chapter
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </section>

            <section className="border border-border bg-surface-card p-5">
              <div className="flex items-center gap-2">
                <Globe2 className="size-4 text-accent" aria-hidden="true" />
                <h2 className="font-display text-xl font-semibold leading-tight tracking-[-0.025em]">
                  National source
                </h2>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                The seeded community source is the public Stop ICE Alerts Network export. The
                national network also publishes its own monthly XML files.
              </p>
              <a
                href="https://stopice.net/?data=1"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-9 items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                National data export
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </section>
          </aside>
        </div>
  );
}
