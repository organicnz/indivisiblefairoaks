'use client';

import { AlertCircle, Check, Loader2, Truck } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { updateFulfillment } from '@/app/admin/actions';

export function FulfilmentEditor({
  orderId,
  trackingNumber,
  adminNotes,
}: {
  orderId: number;
  trackingNumber: string | null;
  adminNotes: string | null;
}) {
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const trackingRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateFulfillment(orderId, {
          tracking_number: trackingRef.current?.value.trim() || null,
          admin_notes: notesRef.current?.value.trim() || null,
        });
        setSaved(true);
        setHasChanges(false);
        setTimeout(() => setSaved(false), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={`tracking-${orderId}`}
            className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1.5"
          >
            <Truck size={11} /> Tracking number
          </label>
          <input
            id={`tracking-${orderId}`}
            ref={trackingRef}
            defaultValue={trackingNumber || ''}
            onChange={() => setHasChanges(true)}
            placeholder="e.g. USPS 9405 5000 0000 0000 0000 00"
            className="w-full rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor={`notes-${orderId}`}
            className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1.5"
          >
            Admin notes
          </label>
          <textarea
            id={`notes-${orderId}`}
            ref={notesRef}
            defaultValue={adminNotes || ''}
            onChange={() => setHasChanges(true)}
            rows={1}
            placeholder="Internal notes — not shown to the customer"
            className="w-full rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground focus:border-primary transition-colors resize-none"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || !hasChanges}
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-primary hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : saved ? (
            <>
              <Check size={12} /> Saved
            </>
          ) : (
            `Save fulfilment${hasChanges ? '' : ' (no changes)'}`
          )}
        </button>
        {error && (
          <div role="alert" className="flex items-start gap-2 text-xs font-bold text-accent-red">
            <AlertCircle size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </form>
  );
}
