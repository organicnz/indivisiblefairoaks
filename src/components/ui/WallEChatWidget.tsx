'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import Image from 'next/image';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';

type Citation = { title: string; url: string };
type Message = { id: string; role: 'user' | 'assistant'; content: string; citations?: Citation[] };

function WallEAvatar({ small = false, inButton = false }: { small?: boolean; inButton?: boolean }) {
  if (inButton) {
    return (
      <span
        aria-hidden="true"
        data-testid="walle-avatar"
        className="relative block size-full rounded-full overflow-hidden"
      >
        <Image
          src="/walle-avatar.png"
          alt=""
          fill
          sizes="64px"
          className="object-cover scale-105"
          priority
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      data-testid="walle-avatar"
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary dark:bg-primary-bright p-1 shadow-lg ring-2 ring-white/80 dark:ring-white/20 ${small ? 'size-9' : 'size-12'}`}
    >
      <span className="relative block aspect-[271/237] size-full rounded-xl bg-white p-0.5 overflow-hidden">
        <Image
          src="/walle-avatar.png"
          alt=""
          fill
          sizes={small ? '28px' : '40px'}
          className="object-cover"
          priority={!small}
        />
      </span>
    </span>
  );
}

export function WallEChatWidget() {
  const { dataPoints } = useDataPoints('walle');
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'starter',
      role: 'assistant',
      content:
        dataPoints['walle.starter_msg'] ||
        "Hi! I'm WALL-E. Ask me about our chapter, events, voter resources, or products.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

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

  async function submit(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || loading) return;
    const next = [
      ...messages,
      { id: crypto.randomUUID(), role: 'user' as const, content: question },
    ];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const response = await fetch('/api/wall-e-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: question,
          history: next.slice(-8).map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = (await response.json()) as {
        answer?: string;
        citations?: Citation[];
        error?: string;
      };
      if (!response.ok || !data.answer) throw new Error(data.error || 'Unavailable');
      const answer = data.answer;
      if (!answer) throw new Error('Unavailable');
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', content: answer, citations: data.citations },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            dataPoints['walle.error_msg'] ||
            "I couldn't reach my notes just now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  /*
    The panel was a `<section aria-label>` that behaved like a modal but carried
    none of the semantics: no `aria-modal`, no focus trap (tab walked into the page
    behind), no Escape to close, no scroll lock, and focus was never moved into it
    or restored to the launcher. Radix supplies all of that.
  */
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="fixed z-[60] floating-safe-position">
        <Dialog.Portal>
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed z-[70] floating-safe-position-panel flex h-[min(36rem,calc(100dvh-12rem-var(--safe-area-top)-var(--safe-area-bottom)))] w-[min(25rem,calc(100vw-2rem-var(--safe-area-left)-var(--safe-area-right)))] flex-col overflow-hidden rounded-2xl border border-primary/20 dark:border-white/10 bg-white dark:bg-slate-900 shadow-float data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-4 data-[state=closed]:fade-out-0 data-[state=open]:duration-300 data-[state=closed]:duration-200"
          >
            <Dialog.Title className="sr-only">WALL-E site assistant</Dialog.Title>
            <header className="relative overflow-hidden bg-secondary px-5 py-4 text-white">
              <div className="absolute -right-8 -top-10 size-28 rounded-full bg-primary/20 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <WallEAvatar />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-outfit text-lg font-black tracking-tight">WALL-E</p>
                    <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
                      <DataPoint as="span" name="walle.badge" initialData={dataPoints}>
                        Online
                      </DataPoint>
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
                <Dialog.Close
                  className="ml-auto inline-flex size-9 items-center justify-center rounded-full text-white/70 transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
                  aria-label="Close WALL-E"
                >
                  <X size={18} strokeWidth={2.5} aria-hidden="true" />
                </Dialog.Close>
              </div>
              <DataPoint
                as="div"
                name="walle.prompt_tip"
                initialData={dataPoints}
                className="relative mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink-on-dark"
              >
                Ask about events, voter resources, partners, or gear.
              </DataPoint>
            </header>
            <div
              className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 p-4"
              aria-live="polite"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && <WallEAvatar small />}
                  <div
                    className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      message.role === 'user'
                        ? 'rounded-br-md bg-primary dark:bg-primary-bright text-white shadow-md shadow-primary/15'
                        : 'rounded-bl-md border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 text-secondary dark:text-slate-100 shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.citations?.length ? (
                      <div className="mt-3 space-y-1.5 border-t border-slate-200 dark:border-slate-700/60 pt-2.5 text-xs">
                        <DataPoint
                          as="p"
                          name="walle.source_heading"
                          initialData={dataPoints}
                          className="font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400"
                        >
                          Explore the source
                        </DataPoint>
                        {message.citations.map((citation) => (
                          <a
                            key={citation.url}
                            href={citation.url}
                            className="block rounded-lg bg-slate-50 dark:bg-slate-700/60 px-2 py-1.5 font-semibold text-primary dark:text-primary-on-dark transition hover:bg-primary/10 dark:hover:bg-primary/20"
                          >
                            <span className="mr-1">↗</span>
                            {citation.title}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <WallEAvatar small />
                  <span className="rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-3 py-2 shadow-sm text-slate-700 dark:text-slate-200">
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
              className="flex gap-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={600}
                placeholder={dataPoints['walle.input_placeholder'] || 'Ask WALL-E…'}
                aria-label="Message WALL-E"
                className="min-w-0 flex-1 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-2.5 text-sm outline-none transition-colors duration-300 ease-out focus:border-primary dark:focus:border-primary-bright focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 focus:ring-primary/15"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-full bg-primary dark:bg-primary-bright px-4 py-2.5 text-sm font-bold text-white shadow-raised transition-colors duration-300 ease-out hover:bg-primary-dark dark:hover:bg-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <DataPoint as="span" name="walle.btn.send" initialData={dataPoints}>
                  Send
                </DataPoint>
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>

        <Dialog.Trigger asChild>
          <button
            type="button"
            aria-label={
              open
                ? dataPoints['walle.btn.close_label'] || 'Close WALL-E assistant'
                : dataPoints['walle.launcher_label'] || 'Open WALL-E assistant'
            }
            onClick={(e) => {
              if (open) {
                e.preventDefault();
                setOpen(false);
              }
            }}
            className={`group relative ml-auto flex size-14 items-center justify-center rounded-full ${
              open
                ? 'bg-gradient-to-tr from-primary to-primary-bright dark:from-blue-950 dark:via-blue-900 dark:to-primary-bright'
                : 'bg-slate-950'
            } shadow-float shadow-primary/35 ring-2 ring-white/90 dark:ring-white/30 transition-all duration-300 ease-out hover:scale-105 hover:shadow-2xl active:scale-95 cursor-pointer motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2`}
          >
            {/* Ambient hover glow */}
            <span
              aria-hidden="true"
              className="absolute -inset-1 rounded-full bg-primary-bright/25 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            />
            {open ? (
              <span
                className="relative flex items-center justify-center text-white transition-transform duration-300 group-hover:rotate-90 animate-in fade-in zoom-in-75 duration-200"
                aria-hidden="true"
              >
                <X size={24} strokeWidth={2.5} />
              </span>
            ) : (
              <span className="relative flex size-full items-center justify-center animate-in fade-in zoom-in-75 duration-200">
                <WallEAvatar inButton />
                {/* Pulsing online status indicator */}
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center"
                >
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex size-3 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500 shadow-xs" />
                </span>
              </span>
            )}
            {/* Tooltip */}
            <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-full bg-secondary/95 dark:bg-slate-800/95 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs font-bold text-white dark:text-slate-100 opacity-0 shadow-lg transition-opacity duration-300 ease-out hover-capable:group-hover:opacity-100 group-focus-visible:opacity-100">
              {open ? (
                <DataPoint as="span" name="walle.tooltip.close" initialData={dataPoints}>
                  Close
                </DataPoint>
              ) : (
                <DataPoint as="span" name="walle.tooltip" initialData={dataPoints}>
                  Ask WALL-E
                </DataPoint>
              )}
            </span>
          </button>
        </Dialog.Trigger>
      </div>
    </Dialog.Root>
  );
}
