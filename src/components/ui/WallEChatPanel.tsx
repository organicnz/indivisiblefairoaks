'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Check, Copy, RotateCcw, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { fetchWithTimeout } from '@/lib/service-fetch';
import { formatWallEMessage } from '@/lib/walle-format';
import { WallEAvatar } from './WallEChatAvatar';

type Citation = { title: string; url: string };
type Message = { id: string; role: 'user' | 'assistant'; content: string; citations?: Citation[] };
export type Availability = 'idle' | 'checking' | 'online' | 'offline';

const STATUS_LABELS: Record<Availability, string> = {
  idle: 'Site guide',
  checking: 'Checking…',
  online: 'Online',
  offline: 'Unavailable',
};

const STATUS_TONES: Record<Availability, string> = {
  idle: 'bg-white/15 text-white',
  checking: 'bg-amber-300/20 text-amber-200',
  online: 'bg-emerald-400/20 text-emerald-300',
  offline: 'bg-rose-400/20 text-rose-200',
};

const SUGGESTIONS = [
  {
    key: 'walle.chip.events',
    defaultLabel: '📅 Upcoming Events',
    prompt: 'What upcoming events does our chapter have scheduled?',
  },
  {
    key: 'walle.chip.voter',
    defaultLabel: '🗳️ Voter Resources',
    prompt: 'Where can I find voter registration and election info?',
  },
  {
    // The store was retired. Keep the key for the existing data-point row,
    // but do not invite a question WALL-E has no live source to answer.
    key: 'walle.chip.signs',
    defaultLabel: '🤝 Get Involved',
    prompt: 'How can I get involved with the chapter?',
  },
  {
    key: 'walle.chip.partners',
    defaultLabel: '🤝 Coalition Partners',
    prompt: 'Who are our local coalition and civic partners?',
  },
];

export function WallEChatPanel({
  availability,
  onAvailabilityChange,
}: {
  availability: Availability;
  onAvailabilityChange: (availability: Availability) => void;
}) {
  const { dataPoints } = useDataPoints('walle');
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'starter',
      role: 'assistant',
      content:
        dataPoints['walle.starter_msg'] ||
        "Hi! I'm WALL-E. Ask me about our chapter, events, voter resources, or actions.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<{ controller: AbortController; id: number } | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (dataPoints['walle.starter_msg']) {
      setMessages((prev) => {
        if (prev.length === 1 && prev[0].id === 'starter') {
          return [{ ...prev[0], content: dataPoints['walle.starter_msg'] }];
        }
        return prev;
      });
    }
  }, [dataPoints]);

  useEffect(() => {
    if (!messages.length && !loading) return;
    // `scrollIntoView` is JS-driven, so the global prefers-reduced-motion CSS
    // guard cannot intercept it — the behaviour has to be chosen here.
    const prefersReducedMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    endRef.current?.scrollIntoView?.({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }, [messages.length, loading]);

  useEffect(() => {
    return () => {
      requestRef.current?.controller.abort();
      requestRef.current = null;
    };
  }, []);

  async function sendQuery(questionText: string) {
    const question = questionText.trim();
    // A ref guard, not just `loading`: two chip clicks can arrive before React
    // renders the disabled state, and a second request would duplicate the
    // question and spend another rate-limit slot.
    if (!question || requestRef.current) return;

    const controller = new AbortController();
    const requestId = ++requestSeq.current;
    requestRef.current = { controller, id: requestId };
    const next = [
      ...messages,
      { id: crypto.randomUUID(), role: 'user' as const, content: question },
    ];
    setMessages(next);
    setInput('');
    setLoading(true);
    onAvailabilityChange('checking');
    let responseStatus = 0;
    let serverError = '';
    try {
      const response = await fetchWithTimeout(
        '/api/wall-e-chat',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message: question,
            // Exclude the message being sent: the edge function appends it as the
            // current turn, and sending it in history duplicated it in the prompt.
            history: next
              .slice(0, -1)
              .slice(-8)
              .map(({ role, content }) => ({ role, content })),
          }),
          signal: controller.signal,
        },
        30_000
      );
      responseStatus = response.status;
      const data = (await response.json()) as {
        answer?: string;
        citations?: Citation[];
        error?: string;
      };
      if (requestRef.current?.id !== requestId) return;
      if (!response.ok || !data.answer) {
        serverError = typeof data.error === 'string' ? data.error.trim().slice(0, 300) : '';
        throw new Error(serverError || 'Unavailable');
      }
      const answer = data.answer;
      onAvailabilityChange('online');
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', content: answer, citations: data.citations },
      ]);
    } catch {
      // Reset aborts the request and invalidates its id. Neither the late
      // response nor its error belongs in the fresh conversation.
      if (controller.signal.aborted || requestRef.current?.id !== requestId) return;
      onAvailabilityChange(responseStatus > 0 && responseStatus < 500 ? 'online' : 'offline');
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            serverError ||
            dataPoints['walle.error_msg'] ||
            "I couldn't reach my notes just now. Please try again in a moment.",
        },
      ]);
    } finally {
      if (requestRef.current?.id === requestId) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await sendQuery(input);
  }

  function resetChat() {
    const pending = requestRef.current;
    if (pending) {
      // Invalidate first: the abort rejection may run before React processes
      // the reset, and it must not be mistaken for a real failure.
      requestSeq.current += 1;
      requestRef.current = null;
      pending.controller.abort();
      setLoading(false);
      onAvailabilityChange('idle');
    }
    setMessages([
      {
        id: 'starter',
        role: 'assistant',
        content:
          dataPoints['walle.starter_msg'] ||
          "Hi! I'm WALL-E. Ask me about our chapter, events, voter resources, or actions.",
      },
    ]);
    setInput('');
  }

  async function copyMessage(content: string, id: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard write failed or restricted
    }
  }

  /*
    The panel was a `<section aria-label>` that behaved like a modal but carried
    none of the semantics: no `aria-modal`, no focus trap (tab walked into the page
    behind), no Escape to close, no scroll lock, and focus was never moved into it
    or restored to the launcher. Radix supplies all of that.
  */
  return (
    <Dialog.Portal>
      <Dialog.Content
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
        className="fixed z-[70] floating-safe-position-panel flex h-[min(36rem,calc(100dvh-12rem-var(--safe-area-top)-var(--safe-area-bottom)))] w-[min(25rem,calc(100vw-2rem-var(--safe-area-left)-var(--safe-area-right)))] flex-col overflow-hidden rounded-sm border border-primary/20 bg-surface-card shadow-float data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-4 data-[state=closed]:fade-out-0 data-[state=open]:duration-300 data-[state=closed]:duration-200 dark:border-white/10"
      >
        <Dialog.Title className="sr-only">WALL-E site assistant</Dialog.Title>
        <header className="relative overflow-hidden bg-secondary px-5 py-4 text-white">
          <div className="relative flex items-center gap-3">
            <WallEAvatar />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-display text-xl font-semibold tracking-[-0.02em]">WALL-E</p>
                {/* Deliberately not a DataPoint: a stored "Online" label
                        would re-create the false status this replaced. */}
                <span
                  role="status"
                  aria-live="polite"
                  className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${STATUS_TONES[availability]}`}
                >
                  {STATUS_LABELS[availability]}
                </span>
              </div>
              <DataPoint
                as="p"
                name="walle.subtitle"
                initialData={dataPoints}
                className="text-xs text-ink-on-dark"
              >
                Your Fair Oaks guide · grounded in our site
              </DataPoint>
            </div>
            <div className="ml-auto flex items-center gap-1">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={resetChat}
                  title={dataPoints['walle.action.clear'] || 'Reset conversation'}
                  aria-label={dataPoints['walle.action.clear'] || 'Reset conversation'}
                  className="inline-flex size-9 cursor-pointer items-center justify-center rounded-sm text-white/70 transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                </button>
              )}
              <Dialog.Close
                className="inline-flex size-9 cursor-pointer items-center justify-center rounded-sm text-white/70 transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
                aria-label="Close WALL-E"
              >
                <X size={18} strokeWidth={2.5} aria-hidden="true" />
              </Dialog.Close>
            </div>
          </div>
          <DataPoint
            as="div"
            name="walle.prompt_tip"
            initialData={dataPoints}
            className="relative mt-4 rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink-on-dark"
          >
            Ask about events, voter resources, partners, or getting involved.
          </DataPoint>
        </header>
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Chat messages"
          className="flex-1 space-y-4 overflow-y-auto bg-surface-muted p-4 dark:bg-secondary"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && <WallEAvatar small />}
              <div
                className={`max-w-[84%] rounded-sm px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-primary text-white dark:bg-primary-bright'
                    : 'border border-border bg-surface-card text-foreground dark:border-white/10 dark:text-ink-on-dark'
                }`}
              >
                {message.role === 'assistant' ? (
                  formatWallEMessage(message.content)
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
                {message.citations?.length ? (
                  <div className="mt-3 space-y-1.5 border-t border-border dark:border-white/10 pt-2.5 text-xs">
                    <DataPoint
                      as="p"
                      name="walle.source_heading"
                      initialData={dataPoints}
                      className="font-bold uppercase tracking-wider text-muted-foreground dark:text-ink-muted-on-dark"
                    >
                      Explore the source
                    </DataPoint>
                    {message.citations.map((citation) => (
                      <a
                        key={citation.url}
                        href={citation.url}
                        className="block rounded-sm border border-border bg-surface-muted px-2.5 py-1.5 font-semibold text-primary-ink transition-colors duration-200 hover:bg-primary/10 dark:border-white/10 dark:bg-white/5 dark:text-primary-on-dark dark:hover:bg-primary/20"
                      >
                        <span className="mr-1">↗</span>
                        {citation.title}
                      </a>
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' && message.id !== 'starter' && (
                  <div className="mt-2.5 flex items-center justify-end border-t border-border dark:border-white/10 pt-1.5">
                    <button
                      type="button"
                      onClick={() => copyMessage(message.content, message.id)}
                      title="Copy response"
                      aria-label="Copy response"
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground dark:text-ink-muted-on-dark hover:bg-surface-muted dark:hover:bg-white/10 hover:text-foreground dark:hover:text-ink-on-dark transition-colors cursor-pointer"
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check size={12} className="text-emerald-500" />
                          <span className="text-emerald-500 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <DataPoint as="span" name="walle.action.copy" initialData={dataPoints}>
                            Copy
                          </DataPoint>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Suggestion Chips shown when conversation has only starter greeting */}
          {messages.length === 1 && !loading && (
            <div className="pt-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-ink-muted-on-dark mb-2 pl-1">
                Suggested topics
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => sendQuery(item.prompt)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-border bg-surface-card px-3 py-1.5 text-xs font-semibold text-primary-ink transition-colors duration-200 hover:border-primary/40 hover:bg-primary/5 dark:border-white/10 dark:text-primary-on-dark dark:hover:border-primary-bright/40 dark:hover:bg-primary/15"
                  >
                    <DataPoint as="span" name={item.key} initialData={dataPoints}>
                      {item.defaultLabel}
                    </DataPoint>
                  </button>
                ))}
              </div>
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-ink-muted-on-dark">
              <WallEAvatar small />
              <span className="rounded-sm border border-border bg-surface-card px-3 py-2 text-foreground dark:text-ink-on-dark">
                <DataPoint as="span" name="walle.checking" initialData={dataPoints}>
                  WALL-E is checking the site…
                </DataPoint>
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <form
          onSubmit={submit}
          className="flex gap-2 border-t border-border dark:border-white/10 bg-surface-card/95 dark:bg-secondary/95 backdrop-blur-xs p-3"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={600}
            placeholder={dataPoints['walle.input_placeholder'] || 'Ask WALL-E…'}
            aria-label="Message WALL-E"
            className="min-w-0 flex-1 rounded-sm border border-border bg-surface-muted px-4 py-2.5 text-sm text-foreground outline-none transition-colors duration-300 ease-out placeholder:text-muted-foreground focus:border-primary focus:bg-surface-card focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-secondary/90 dark:text-white dark:placeholder:text-ink-muted-on-dark dark:focus:border-primary-bright"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-sm bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors duration-300 ease-out hover:bg-primary-dark disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-primary-bright dark:hover:bg-primary"
          >
            <DataPoint as="span" name="walle.btn.send" initialData={dataPoints}>
              Send
            </DataPoint>
          </button>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
