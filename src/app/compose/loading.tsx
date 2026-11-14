/**
 * The composer route reads an auth-gated CMS row before it can render anything.
 * Without a loading boundary the whole segment is blank while that read runs;
 * with one, the page keeps its broadsheet masthead and says what is happening.
 */
export default function ComposerWorkspaceLoading() {
  return (
    <div
      className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] pt-(--header-clearance) text-foreground"
      aria-busy="true"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="border-b-2 border-foreground/15 py-8">
          <p className="civic-kicker">Composer workspace</p>
          <div className="mt-4 h-11 w-2/3 animate-pulse bg-surface-muted motion-reduce:animate-none sm:h-14" />
          <div className="mt-5 flex flex-wrap gap-x-3 gap-y-2">
            <span className="h-3 w-16 animate-pulse bg-surface-muted motion-reduce:animate-none" />
            <span className="h-3 w-24 animate-pulse bg-surface-muted motion-reduce:animate-none" />
            <span className="h-3 w-20 animate-pulse bg-surface-muted motion-reduce:animate-none" />
          </div>
        </div>

        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Opening the saved document…
        </p>

        <div className="mt-8 space-y-4" aria-hidden="true">
          <div className="h-4 w-full animate-pulse bg-surface-muted motion-reduce:animate-none" />
          <div className="h-4 w-11/12 animate-pulse bg-surface-muted motion-reduce:animate-none" />
          <div className="h-4 w-4/5 animate-pulse bg-surface-muted motion-reduce:animate-none" />
          <div className="mt-8 h-44 w-full animate-pulse bg-surface-muted motion-reduce:animate-none" />
          <div className="h-4 w-full animate-pulse bg-surface-muted motion-reduce:animate-none" />
          <div className="h-4 w-3/4 animate-pulse bg-surface-muted motion-reduce:animate-none" />
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          Loading the composer workspace.
        </p>
      </div>
    </div>
  );
}
