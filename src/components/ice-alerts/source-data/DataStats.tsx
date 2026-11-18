import { formatTimestamp, type SourceHealth } from './ice-data';

type DataStatsProps = {
  total: number;
  latestRetrievedAt: string | null;
  sources: SourceHealth[];
};

export function DataStats({ total, latestRetrievedAt, sources }: DataStatsProps) {
  return (
        <dl className="grid gap-px border-x border-b border-border bg-border sm:grid-cols-3">
          <div className="bg-surface-card p-5">
            <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Public reports
            </dt>
            <dd className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">
              {total.toLocaleString('en-US')}
            </dd>
          </div>
          <div className="bg-surface-card p-5">
            <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Newest retrieval
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]">
              {formatTimestamp(latestRetrievedAt)}
            </dd>
          </div>
          <div className="bg-surface-card p-5">
            <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Approved sources
            </dt>
            <dd className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">
              {sources.length.toLocaleString('en-US')}
            </dd>
          </div>
        </dl>
  );
}
