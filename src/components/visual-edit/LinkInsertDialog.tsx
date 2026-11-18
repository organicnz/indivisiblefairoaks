'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

export type LinkModalState = {
  textareaId: string | null;
  url: string;
  text: string;
  editAnchor?: HTMLAnchorElement | null;
};

const QUICK_ROUTES = [
  { label: 'Home', path: '/' },
  { label: 'Events', path: '/events' },
  { label: 'News', path: '/news' },
  { label: 'Gallery', path: '/gallery' },
  { label: 'About', path: '/about' },
  { label: 'Donate', path: '/donate' },
  { label: 'Voter Info', path: '/voter-info' },
  { label: 'Contact', path: '/contact' },
] as const;

export function LinkInsertDialog({
  modal,
  onUrlChange,
  onTextChange,
  onCancel,
  onConfirm,
}: {
  modal: LinkModalState;
  onUrlChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-md bg-surface-card text-foreground p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle>{modal.editAnchor ? 'Edit link' : 'Insert link'}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {modal.editAnchor
              ? 'Change the destination URL for this link.'
              : modal.textareaId
                ? 'Enter the destination URL and optional link text.'
                : 'Enter the destination URL for the selected text.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="link-url" className="block text-xs font-bold text-foreground mb-1">
              URL
            </label>
            <input
              id="link-url"
              type="url"
              autoFocus
              value={modal.url}
              onChange={(e) => onUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onConfirm();
                }
              }}
              placeholder="https://example.com or /about"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
            />
            <div className="pt-1.5 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Quick route shortcuts:
              </span>
              <div className="flex flex-wrap gap-1">
                {QUICK_ROUTES.map((route) => (
                  <button
                    key={route.path}
                    type="button"
                    onClick={() => onUrlChange(route.path)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-mono transition-colors cursor-pointer ${
                      modal.url === route.path
                        ? 'bg-primary text-white font-bold'
                        : 'bg-surface-muted text-foreground hover:bg-border'
                    }`}
                  >
                    {route.path}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {modal.textareaId && (
            <div>
              <label htmlFor="link-text" className="block text-xs font-bold text-foreground mb-1">
                Link text (optional — uses selected text if empty)
              </label>
              <input
                id="link-text"
                type="text"
                value={modal.text}
                onChange={(e) => onTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onConfirm();
                  }
                }}
                placeholder="Link"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border"
          >
            Cancel
          </button>
          <button
            type="button"
            data-confirm
            disabled={!modal.url.trim()}
            onClick={onConfirm}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-40"
          >
            {modal.editAnchor ? 'Save link' : 'Insert link'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
