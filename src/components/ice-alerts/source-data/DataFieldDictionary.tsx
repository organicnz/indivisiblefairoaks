import { Radio, ShieldCheck } from 'lucide-react';
import { FIELDS } from './ice-data';

export function DataFieldDictionary() {
  return (
        <section className="mt-8 border border-border bg-surface-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Radio className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <p className="civic-section-index">Field dictionary</p>
              <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                What each record contains.
              </h2>
            </div>
          </div>
          <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {FIELDS.map(([field, description]) => (
              <div key={field} className="border-t border-border pt-2">
                <dt className="font-mono text-[10px] font-bold text-foreground">{field}</dt>
                <dd className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {description}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            Public exports contain only the readable projection. Raw crawled HTML, crawler errors,
            and source-management fields stay private. Reports from private intake never enter this
            dataset.
          </p>
        </section>
  );
}
