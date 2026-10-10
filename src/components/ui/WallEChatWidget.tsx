'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { type FormEvent, useEffect, useRef, useState } from 'react';

type Citation = { title: string; url: string };
type Message = { id: string; role: 'user' | 'assistant'; content: string; citations?: Citation[] };

function WallEAvatar({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-testid="walle-avatar"
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary p-1 shadow-lg ring-2 ring-white ${small ? 'size-9' : 'size-12'}`}
    >
      <span className="relative block aspect-[271/237] w-full overflow-hidden rounded-xl bg-white p-0.5">
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

const starter: Message = {
  id: 'starter',
  role: 'assistant',
  content: "Hi! I'm WALL-E. Ask me about our chapter, events, voter resources, or products.",
};

export function WallEChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([starter]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messages.length && !loading) return;
    // `scrollIntoView` is JS-driven, so the global prefers-reduced-motion CSS
    // guard cannot intercept it — the behaviour has to be chosen here.
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
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
          content: "I couldn't reach my notes just now. Please try again in a moment.",
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
            className="fixed z-[70] floating-safe-position-panel flex h-[min(38rem,calc(100dvh-7rem-var(--safe-area-top)-var(--safe-area-bottom)))] w-[min(25rem,calc(100vw-2rem-var(--safe-area-left)-var(--safe-area-right)))] flex-col overflow-hidden rounded-xl border border-primary/20 bg-white shadow-float data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-4 data-[state=closed]:fade-out-0 data-[state=open]:duration-300 data-[state=closed]:duration-200"
          >
            <Dialog.Title className="sr-only">WALL-E site assistant</Dialog.Title>
            <header className="relative overflow-hidden bg-secondary px-5 py-4 text-white">
              <div className="absolute -right-8 -top-10 size-28 rounded-full bg-primary/20 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <WallEAvatar />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-outfit text-lg font-black">WALL-E</p>
                    <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-200">
                      Online
                    </span>
                  </div>
                  <p className="text-xs text-white/65">
                    Your Fair Oaks guide · grounded in our site
                  </p>
                </div>
                <Dialog.Close
                  className="ml-auto inline-flex size-9 items-center justify-center rounded-full text-2xl leading-none text-white/70 transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
                  aria-label="Close WALL-E"
                >
                  <span aria-hidden="true">×</span>
                </Dialog.Close>
              </div>
              <div className="relative mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                Ask about events, voter resources, partners, or gear.
              </div>
            </header>
            <div
              className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4"
              aria-live="polite"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && <WallEAvatar small />}
                  <div
                    className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${message.role === 'user' ? 'rounded-br-md bg-primary text-white shadow-md shadow-primary/15' : 'rounded-bl-md border border-slate-100 bg-white text-secondary shadow-sm'}`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.citations?.length ? (
                      <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-2.5 text-xs">
                        <p className="font-bold uppercase tracking-wider text-slate-400">
                          Explore the source
                        </p>
                        {message.citations.map((citation) => (
                          <a
                            key={citation.url}
                            href={citation.url}
                            className="block rounded-lg bg-slate-50 px-2 py-1.5 font-semibold text-primary dark:text-primary-on-dark transition hover:bg-primary/10"
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
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <WallEAvatar small />
                  <span className="rounded-full bg-white px-3 py-2 shadow-sm">
                    WALL-E is checking the site…
                  </span>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 bg-white p-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={600}
                placeholder="Ask WALL-E…"
                aria-label="Message WALL-E"
                className="min-w-0 flex-1 rounded-full border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-colors duration-300 ease-out focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-raised transition-colors duration-300 ease-out hover:bg-primary-dark disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Send
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>

        <Dialog.Trigger asChild>
          <button
            type="button"
            aria-label={open ? 'Close WALL-E assistant' : 'Open WALL-E assistant'}
            className="group relative ml-auto flex size-16 items-center justify-center rounded-full bg-primary shadow-float shadow-primary/30 ring-4 ring-white transition-transform duration-300 ease-out hover:scale-105 motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <WallEAvatar />
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 size-4 rounded-full border-2 border-white bg-emerald-500"
            />
            {/* Tooltip is now also driven by focus, not hover only. */}
            <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-visible:opacity-100">
              Ask WALL-E
            </span>
          </button>
        </Dialog.Trigger>
      </div>
    </Dialog.Root>
  );
}
