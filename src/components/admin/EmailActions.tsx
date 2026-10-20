'use client';

import { Check, Copy, Mail } from 'lucide-react';
import { useState } from 'react';

export function EmailActions({ email }: { email: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!email) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — no-op.
    }
  };

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      <a
        href={`mailto:${email}`}
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-surface-muted text-muted-foreground hover:bg-primary hover:text-white px-3 py-1.5 transition-colors"
      >
        <Mail size={11} /> Email customer
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-surface-muted text-muted-foreground hover:bg-surface-muted px-3 py-1.5 transition-colors"
      >
        {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
        {copied ? 'Copied' : 'Copy email'}
      </button>
    </div>
  );
}
