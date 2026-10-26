'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Megaphone, RotateCcw, Sparkles, Wand2, Zap } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';

export type GhostwriterPreset = 'punchy' | 'inspire' | 'rally' | 'fix' | 'cta';

interface CivicGhostwriterProps {
  element: HTMLElement;
  onTextUpdated?: (newText: string) => void;
  defaultOpen?: boolean;
}

export const CivicGhostwriter: React.FC<CivicGhostwriterProps> = ({
  element,
  onTextUpdated,
  defaultOpen,
}) => {
  const [previousText, setPreviousText] = useState<string | null>(null);

  const applyTransformation = (preset: GhostwriterPreset) => {
    const original = element.textContent?.trim() || '';
    if (!original) {
      toast.error('Element has no text to transform');
      return;
    }

    setPreviousText(original);
    let transformed = original;

    switch (preset) {
      case 'punchy': {
        // Remove filler, shorten passive phrases
        transformed = original
          .replace(/\bin order to\b/gi, 'to')
          .replace(/\bat this point in time\b/gi, 'now')
          .replace(/\bdue to the fact that\b/gi, 'because')
          .replace(/\bwith regards to\b/gi, 'regarding')
          .replace(/\bwe are of the opinion that\b/gi, 'we believe')
          .replace(/\s{2,}/g, ' ');
        // If it's a headline, ensure clean title casing
        if (original.length < 60) {
          transformed = transformed
            .split(' ')
            .map((w) => (w.length > 3 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
            .join(' ');
        }
        break;
      }

      case 'inspire': {
        // Inject civic solidarity and grassroots momentum
        if (
          !original.toLowerCase().includes('people') &&
          !original.toLowerCase().includes('democracy') &&
          !original.toLowerCase().includes('together')
        ) {
          transformed = `${original.replace(/[.]+$/, '')} — People Power in Action!`;
        } else {
          transformed = original.replace(/\bI\b/g, 'We').replace(/\bmy\b/g, 'our');
        }
        break;
      }

      case 'rally': {
        // High-contrast, witty rally sign style
        transformed = original.replace(/[.!?]+$/, '');
        if (!transformed.includes('•') && original.length < 50) {
          transformed = `“${transformed.toUpperCase()}”`;
        }
        break;
      }

      case 'fix': {
        // Clean punctuation, capitalization, double spaces
        transformed = original
          .replace(/\s{2,}/g, ' ')
          .replace(/\s+([.,!?;:])/g, '$1')
          .replace(/\bi\b/g, 'I')
          .trim();
        // Capitalize first character
        if (transformed.length > 0) {
          transformed = transformed.charAt(0).toUpperCase() + transformed.slice(1);
        }
        break;
      }

      case 'cta': {
        // Make into an urgent action call
        if (!/^(join|take action|stand|act|defend|vote|speak)\b/i.test(original)) {
          transformed = `Take Action: ${original.charAt(0).toLowerCase() + original.slice(1)}`;
        }
        break;
      }
    }

    element.textContent = transformed;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    onTextUpdated?.(transformed);
    toast.success(`Transformed text (${preset})`);
  };

  const handleUndo = () => {
    if (previousText !== null) {
      element.textContent = previousText;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      onTextUpdated?.(previousText);
      setPreviousText(null);
      toast.info('Reverted to previous text');
    }
  };

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu.Root defaultOpen={defaultOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            title="AI Civic Ghostwriter & Text Polish"
            aria-label="AI Civic Ghostwriter"
            className="inline-flex items-center gap-1 rounded px-2 py-1 font-bold text-accent-gold hover:bg-white/10 hover:text-white transition-colors text-[11px] cursor-pointer"
          >
            <Sparkles size={12} className="text-accent-gold" />
            <span className="hidden sm:inline">AI Polish</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            side="top"
            sideOffset={8}
            className="z-50 w-56 rounded-xl border border-white/15 bg-secondary p-1.5 shadow-float text-white text-xs animate-in fade-in-0 zoom-in-95"
          >
            <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-ink-muted-on-dark border-b border-white/10 mb-1">
              Civic Ghostwriter
            </div>

            <DropdownMenu.Item
              onSelect={() => applyTransformation('punchy')}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-white/10 focus-visible:outline-none"
            >
              <Zap size={13} className="text-accent-gold" />
              <div>
                <span className="font-bold">Make Punchier</span>
                <p className="text-[10px] text-ink-muted-on-dark">Trim filler and sharpen rhythm</p>
              </div>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => applyTransformation('inspire')}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-white/10 focus-visible:outline-none"
            >
              <Wand2 size={13} className="text-emerald-400" />
              <div>
                <span className="font-bold">Inspire & Mobilize</span>
                <p className="text-[10px] text-ink-muted-on-dark">Solidarity & grassroots energy</p>
              </div>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => applyTransformation('rally')}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-white/10 focus-visible:outline-none"
            >
              <Sparkles size={13} className="text-amber-300" />
              <div>
                <span className="font-bold">Rally Sign Slogan</span>
                <p className="text-[10px] text-ink-muted-on-dark">Bold protest cardboard humor</p>
              </div>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => applyTransformation('fix')}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-white/10 focus-visible:outline-none"
            >
              <Check size={13} className="text-sky-400" />
              <div>
                <span className="font-bold">Fix Typos & Grammar</span>
                <p className="text-[10px] text-ink-muted-on-dark">Punctuation & spacing cleanup</p>
              </div>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => applyTransformation('cta')}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-white/10 focus-visible:outline-none"
            >
              <Megaphone size={13} className="text-rose-400" />
              <div>
                <span className="font-bold">Action Call (CTA)</span>
                <p className="text-[10px] text-ink-muted-on-dark">Drive volunteer mobilization</p>
              </div>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {previousText !== null && (
        <button
          type="button"
          onClick={handleUndo}
          title="Revert AI transformation"
          aria-label="Revert AI transformation"
          className="rounded p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RotateCcw size={12} />
        </button>
      )}
    </div>
  );
};
