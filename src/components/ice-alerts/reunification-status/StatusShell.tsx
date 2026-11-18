import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function StatusShell({ children }: { children: ReactNode }) {
  return (
    <div className="civic-page min-h-screen w-full bg-background text-foreground">
      <header className="border-b border-border pt-(--header-clearance)">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a
            href="/ice-alerts/reunification"
            className="inline-flex min-h-8 items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Reunification request
          </a>
          <span className="civic-stamp">Private status / do not share</span>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
    </div>
  );
}
