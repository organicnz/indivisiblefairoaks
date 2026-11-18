'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

export function AltTextDialog({
  value,
  saving,
  readRefusal,
  onValueChange,
  onCancel,
  onSave,
}: {
  value: string;
  saving: boolean;
  readRefusal: string | null;
  onValueChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onCancel();
      }}
    >
      <DialogContent className="max-w-md bg-surface-card text-foreground p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle>Edit alt text</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Describe the image for screen readers and search engines.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label
            htmlFor="alt-text-input"
            className="block text-xs font-bold text-foreground mb-1"
          >
            Alt text for accessibility
          </label>
          <input
            id="alt-text-input"
            type="text"
            autoFocus
            value={value}
            disabled={saving || Boolean(readRefusal)}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSave();
              }
            }}
            placeholder="A brief description of the image"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            data-confirm
            disabled={saving || Boolean(readRefusal)}
            aria-busy={saving}
            onClick={onSave}
            title={readRefusal ?? 'Save the image description'}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
