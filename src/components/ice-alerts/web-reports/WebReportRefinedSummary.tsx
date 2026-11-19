'use client';

import { LoaderCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';

type DigestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'error'; message: string };

type WebReportRefinedSummaryProps = {
  reportId: string;
  initialText: string | null;
  sourceUrl: string;
};

const digestCache = new Map<string, string>();

async function readDigest(reportId: string): Promise<string> {
  const cached = digestCache.get(reportId);
  if (cached) return cached;

  const response = await fetch('/api/ice-source-reports/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: reportId }),
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: unknown;
    text?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok || payload?.ok !== true || typeof payload.text !== 'string') {
    throw new Error(
      typeof payload?.message === 'string'
        ? payload.message
        : 'The AI summary is temporarily unavailable.'
    );
  }

  digestCache.set(reportId, payload.text);
  return payload.text;
}

/**
 * The source extract stays on the server. Opening this panel requests the
 * cached AI digest; if it cannot be produced, the panel shows the original
 * source link rather than falling back to the publisher's copied wording.
 */
export function WebReportRefinedSummary({
  reportId,
  initialText,
  sourceUrl,
}: WebReportRefinedSummaryProps) {
  const [state, setState] = useState<DigestState>(
    initialText ? { status: 'ready', text: initialText } : { status: 'idle' }
  );

  async function loadDigest() {
    if (state.status !== 'idle') return;
    setState({ status: 'loading' });
    try {
      const text = await readDigest(reportId);
      setState({ status: 'ready', text });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'The AI summary is temporarily unavailable.',
      });
    }
  }

  return (
    <details
      className="group mt-3 border border-border bg-background"
      onToggle={(event) => {
        if (event.currentTarget.open) void loadDigest();
      }}
    >
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="size-3 text-accent" aria-hidden="true" />
          Read AI-refined summary
        </span>
        <span
          className="text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-border px-3 py-3 text-xs leading-relaxed text-foreground">
        {state.status === 'loading' ? (
          <p role="status" className="flex items-center gap-2 text-muted-foreground">
            <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
            Refining the source into a short, attributed digest…
          </p>
        ) : null}

        {state.status === 'ready' ? <div className="whitespace-pre-line">{state.text}</div> : null}

        {state.status === 'error' ? (
          <p role="status" className="text-muted-foreground">
            {state.message}{' '}
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Open the original source
            </a>
            .
          </p>
        ) : null}

        {state.status === 'ready' ? (
          <p className="mt-3 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">
            AI-generated digest grounded in the linked source. It paraphrases the source and is not
            independently verified; open the original for exact wording.
          </p>
        ) : null}
      </div>
    </details>
  );
}
