'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Check, Copy, RotateCcw, X } from 'lucide-react';
import Image from 'next/image';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { formatWallEMessage } from '@/lib/walle-format';

type Citation = { title: string; url: string };
type Message = { id: string; role: 'user' | 'assistant'; content: string; citations?: Citation[] };

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
    key: 'walle.chip.signs',
    defaultLabel: '🪧 Yard Signs & Gear',
    prompt: 'Where can I get Defend Democracy yard signs and chapter gear?',
  },
  {
    key: 'walle.chip.partners',
    defaultLabel: '🤝 Coalition Partners',
    prompt: 'Who are our local coalition and civic partners?',
  },
];

function WallEAvatar({ small = false, inButton = false }: { small?: boolean; inButton?: boolean }) {
  const sizeClasses = inButton ? 'size-full' : small ? 'size-8' : 'size-11';
  return (
    <span
      aria-hidden="true"
      data-testid="walle-avatar"
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden shadow-xs ring-1 ring-white/25 bg-slate-900 ${sizeClasses}`}
    >
      <Image
        src="/walle-avatar.png"
        alt=""
        fill
        sizes={small ? '32px' : inButton ? '64px' : '44px'}
        className="object-cover scale-105"
        priority={!small}
      />
    </span>
  );
}

export function WallEChatWidget() {
  const { dataPoints } = useDataPoints('walle');
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  async function sendQuery(questionText: string) {
    const question = questionText.trim();
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    await sendQuery(input);
  }

  function resetChat() {
    setMessages([
      {
        id: 'starter',
        role: 'assistant',
        content:
          dataPoints['walle.starter_msg'] ||
          "Hi! I'm WALL-E. Ask me about our chapter, events, voter resources, or products.",
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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="fixed z-[60] floating-safe-position">
        <Dialog.Portal>
          <Dialog.Content
            aria-describedby={undefined}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
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
                <div className="ml-auto flex items-center gap-1">
                  {messages.length > 1 && (
                    <button
                      type="button"
                      onClick={resetChat}
                      title="Reset conversation"
                      aria-label="Reset conversation"
                      className="inline-flex size-9 items-center justify-center rounded-full text-white/70 transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold cursor-pointer"
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                    </button>
                  )}
                  <Dialog.Close
                    className="inline-flex size-9 items-center justify-center rounded-full text-white/70 transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold cursor-pointer"
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
                        ? 'rounded-br-md bg-primary dark:bg-primary-bright text-white shadow-raised shadow-primary/20'
                        : 'rounded-bl-md border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800 text-secondary dark:text-slate-100 shadow-sm'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      formatWallEMessage(message.content)
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                    {message.citations?.length ? (
                      <div className="mt-3 space-y-1.5 border-t border-slate-200 dark:border-slate-700/60 pt-2.5 text-xs">
                        <DataPoint
                          as="p"
                          name="walle.source_heading"
                          initialData={dataPoints}
                          className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          Explore the source
                        </DataPoint>
                        {message.citations.map((citation) => (
                          <a
                            key={citation.url}
                            href={citation.url}
                            className="block rounded-lg bg-slate-100/70 dark:bg-slate-700/60 border border-slate-200/60 dark:border-slate-600/40 px-2.5 py-1.5 font-semibold text-primary-ink dark:text-primary-on-dark transition-colors duration-200 hover:bg-primary/10 dark:hover:bg-primary/20"
                          >
                            <span className="mr-1">↗</span>
                            {citation.title}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {message.role === 'assistant' && message.id !== 'starter' && (
                      <div className="mt-2.5 flex items-center justify-end border-t border-slate-100 dark:border-slate-700/40 pt-1.5">
                        <button
                          type="button"
                          onClick={() => copyMessage(message.content, message.id)}
                          title="Copy response"
                          aria-label="Copy response"
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          {copiedId === message.id ? (
                            <>
                              <Check size={12} className="text-emerald-500" />
                              <span className="text-emerald-500 font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <DataPoint
                                as="span"
                                name="walle.action.copy"
                                initialData={dataPoints}
                              >
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
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-2 pl-1">
                    Suggested topics
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => sendQuery(item.prompt)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-primary dark:text-primary-on-dark shadow-xs hover:border-primary/40 dark:hover:border-primary-bright/40 hover:bg-primary/5 dark:hover:bg-primary/15 transition-all duration-200 active:scale-95 cursor-pointer"
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
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <WallEAvatar small />
                  <span className="rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-3 py-2 shadow-sm text-slate-700 dark:text-slate-200">
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
              className="flex gap-2 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs p-3"
            >
              <input
                ref={inputRef}
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
                className="rounded-full bg-primary dark:bg-primary-bright px-4 py-2.5 text-sm font-bold text-white shadow-raised transition-all duration-300 ease-out hover:bg-primary-dark dark:hover:bg-primary hover:shadow-float active:scale-95 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
