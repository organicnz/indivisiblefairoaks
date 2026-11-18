'use client';

import { Link2 } from 'lucide-react';
import { INLINE_FORMATS } from './block-definitions';
import { LinkPopover } from './LinkPopover';

export function InlineToolbar({
  onApply,
  onOpenLinkEditor,
  onCloseLinkEditor,
  linkEditorOpen,
  restoreSelection,
}: {
  onApply: (command: string, value?: string) => void;
  onOpenLinkEditor: () => void;
  onCloseLinkEditor: () => void;
  linkEditorOpen: boolean;
  restoreSelection: () => void;
}) {
  return (
    <div className="mb-1 flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-1">
      {INLINE_FORMATS.map((format) => {
        const Icon = format.icon;
        return (
          <button
            key={format.command}
            type="button"
            // `onMouseDown` + preventDefault keeps the selection: a mousedown that
            // moves focus first would collapse the Range before the command ran.
            onMouseDown={(e) => {
              e.preventDefault();
              onApply(format.command);
            }}
            aria-label={format.label}
            title={`${format.label} (${format.key})`}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-card hover:text-primary dark:hover:text-primary-on-dark focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon size={14} />
          </button>
        );
      })}
      <button
        type="button"
        onMouseDown={(e) => {
          // Stash the selection before the popover takes focus, then let it open.
          e.preventDefault();
          onOpenLinkEditor();
        }}
        aria-label="Add or edit link"
        aria-expanded={linkEditorOpen}
        title="Add or edit link (Ctrl+K)"
        className={`rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
          linkEditorOpen
            ? 'bg-surface-card text-primary dark:text-primary-on-dark'
            : 'text-muted-foreground hover:bg-surface-card hover:text-primary dark:hover:text-primary-on-dark'
        }`}
      >
        <Link2 size={14} />
      </button>
      {/*
        Keyboard route for a link, since the mouse route needs a selection the
        author can only make with a pointer.
      */}
      {linkEditorOpen && (
        <div className="min-w-0 flex-1">
          <LinkPopover
            onApply={(href) => {
              onApply('createLink', href);
              onCloseLinkEditor();
            }}
            onRemove={onCloseLinkEditor}
            restoreSelection={restoreSelection}
          />
        </div>
      )}
    </div>
  );
}
