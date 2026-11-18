import { TriangleAlert } from 'lucide-react';
import { StatusShell } from './StatusShell';

type StatusMessageProps = {
  title: string;
  body: string;
};

export function StatusMessage({ title, body }: StatusMessageProps) {
  return (
    <StatusShell>
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
    </StatusShell>
  );
}
