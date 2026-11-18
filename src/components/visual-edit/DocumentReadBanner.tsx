import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

export type DocumentLoadState = 'idle' | 'loading' | 'ready' | 'degraded';

export function DocumentReadBanner({
  state,
  onRetry,
}: {
  state: DocumentLoadState;
  onRetry?: () => void;
}) {
  if (state !== 'idle' && state !== 'loading' && state !== 'degraded') return null;

  const opening = state === 'idle' || state === 'loading';

  return (
    <div
      data-testid={opening ? 'composer-document-loading' : 'composer-document-error'}
      role={opening ? 'status' : 'alert'}
      className={`mx-3 mt-3 flex shrink-0 items-start gap-2 rounded-xl border p-2.5 ${
        opening
          ? 'border-white/15 bg-white/5 text-ink-on-dark'
          : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
      }`}
    >
      {opening ? (
        <Loader2
          size={14}
          className="mt-0.5 shrink-0 animate-spin text-accent-gold motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-400" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-wider">
          {opening ? 'Opening document' : 'Document not loaded'}
        </p>
        <p className="mt-1 text-[10px] leading-snug text-ink-muted-on-dark">
          {opening
            ? 'Reading the saved CMS copy before unlocking the canvas.'
            : 'The canvas is showing the rendered page, not the saved row. Editing and saving are locked until a reload succeeds.'}
        </p>
        {state === 'degraded' && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-200 transition-colors hover:bg-rose-500/20"
          >
            <RefreshCw size={11} aria-hidden="true" />
            Retry document load
          </button>
        ) : null}
      </div>
    </div>
  );
}
