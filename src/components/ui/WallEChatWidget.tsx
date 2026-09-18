'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';

type Citation = { title: string; url: string };
type Message = { id: string; role: 'user' | 'assistant'; content: string; citations?: Citation[] };

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
    if (messages.length || loading) endRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  return (
    <div className="fixed right-4 bottom-4 z-[120] sm:right-6 sm:bottom-6">
      {open && (
        <section
          aria-label="WALL-E site assistant"
          className="mb-3 flex h-[min(34rem,calc(100vh-7rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-primary/20 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between bg-secondary px-5 py-4 text-white">
            <div>
              <p className="font-outfit text-lg font-black">WALL-E</p>
              <p className="text-xs text-white/60">Your Fair Oaks guide</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close WALL-E"
              className="text-2xl text-white/70 hover:text-white"
            >
              ×
            </button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${message.role === 'user' ? 'bg-primary text-white' : 'bg-white text-secondary shadow-sm'}`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.citations?.length ? (
                    <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs">
                      {message.citations.map((citation) => (
                        <a
                          key={citation.url}
                          href={citation.url}
                          className="block text-primary underline"
                        >
                          {citation.title}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {loading && <p className="text-xs text-slate-500">WALL-E is checking the site…</p>}
            <div ref={endRef} />
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 bg-white p-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={600}
              placeholder="Ask WALL-E…"
              aria-label="Message WALL-E"
              className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close WALL-E assistant' : 'Open WALL-E assistant'}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl shadow-xl ring-4 ring-white transition-transform hover:scale-105"
      >
        🤖
      </button>
    </div>
  );
}
