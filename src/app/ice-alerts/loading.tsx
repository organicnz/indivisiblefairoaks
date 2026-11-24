/**
 * `/ice-alerts` reads request-time search parameters and a live feed. Without
 * a concrete loading boundary, Cache Components emitted a zero-byte PPR shell
 * for the route; Vercel served that placeholder directly and the page was
 * blank. This boundary is the static shell: it paints immediately, then the
 * map and feed stream in behind it.
 */
export default function IceAlertsLoading() {
  return (
    <div className="civic-page min-h-screen w-full bg-background text-foreground" aria-busy="true">
      <div className="border-b border-border pt-(--header-clearance)">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="size-8 shrink-0 animate-pulse bg-surface-muted motion-reduce:animate-none" />
          <div className="space-y-2">
            <div className="h-5 w-40 animate-pulse bg-surface-muted motion-reduce:animate-none" />
            <div className="h-2.5 w-56 animate-pulse bg-surface-muted motion-reduce:animate-none" />
          </div>
          <div className="ml-auto h-8 w-64 animate-pulse bg-surface-muted motion-reduce:animate-none" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6 sm:pb-8 lg:px-8">
        <div className="mt-3 grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(23rem,0.82fr)]">
          <div className="h-[clamp(22rem,58vh,38rem)] animate-pulse border border-border bg-surface-muted motion-reduce:animate-none" />
          <div className="min-w-0 space-y-3">
            <div className="h-28 animate-pulse border border-border bg-surface-muted motion-reduce:animate-none" />
            <div className="h-44 animate-pulse border border-border bg-surface-muted motion-reduce:animate-none" />
            <div className="h-24 animate-pulse border border-border bg-surface-muted motion-reduce:animate-none" />
          </div>
        </div>

        <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Loading ICE alerts…
        </p>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Loading the ICE alert map and rapid-response feed.
      </p>
    </div>
  );
}
