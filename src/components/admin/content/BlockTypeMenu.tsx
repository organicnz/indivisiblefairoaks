'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { Block, CalloutTone } from '@/lib/blocks';
import { BLOCK_DEFINITIONS, type BlockKind, definitionFor } from './block-definitions';

export function BlockTypeMenu({
  block,
  onPick,
}: {
  block: Block;
  onPick: (kind: BlockKind, tone: CalloutTone) => void;
}) {
  const [open, setOpen] = useState(false);
  const def = definitionFor((block.type === 'unsupported' ? 'paragraph' : block.type) as BlockKind);
  const Icon = def.icon;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-primary dark:hover:text-primary-on-dark focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon size={13} aria-hidden="true" />
        {def.label}
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close block menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-border bg-surface-card p-1 shadow-float">
            {BLOCK_DEFINITIONS.map((entry) => {
              const EntryIcon = entry.icon;
              return (
                <button
                  key={entry.kind}
                  type="button"
                  onClick={() => {
                    onPick(entry.kind, entry.tones?.[0]?.tone ?? 'info');
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
                >
                  <EntryIcon
                    size={15}
                    className="mt-0.5 shrink-0 text-primary dark:text-primary-on-dark"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {entry.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">{entry.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
