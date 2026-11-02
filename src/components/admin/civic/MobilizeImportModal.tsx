'use client';

import { Download, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { importMobilizeEvent } from '@/lib/actions/mobilize';

interface MobilizeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (event: { slug: string; title: string }) => void;
}

export function MobilizeImportModal({ isOpen, onClose, onSuccess }: MobilizeImportModalProps) {
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUrl = url.trim();
    if (!targetUrl) {
      toast.error('Please enter or paste a Mobilize event URL');
      return;
    }

    setImporting(true);
    try {
      const result = await importMobilizeEvent(targetUrl);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.data.converted
          ? `Linked existing card “${result.data.title}” to Mobilize`
          : `Added “${result.data.title}” to the calendar`
      );
      if (result.data.warnings.length > 0) {
        toast.message(result.data.warnings[0]);
      }

      setUrl('');
      onSuccess({ slug: result.data.slug, title: result.data.title });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="size-8 rounded-lg bg-primary/10 text-primary-bright dark:bg-primary-bright/15 dark:text-accent-gold flex items-center justify-center">
              <Download size={16} />
            </div>
            <DialogTitle className="text-xl font-black text-foreground dark:text-white">
              Import Mobilize Event
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
            Paste the link to any Mobilize event (e.g. posted by Christiana, national Indivisible,
            or partner groups). We will instantly fetch the event schedule, location, description,
            and RSVP link directly into the chapter calendar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleImport} className="space-y-4 mt-2">
          <div>
            <label
              htmlFor="mobilize-import-url"
              className="block text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-ink-muted-on-dark mb-1.5"
            >
              Mobilize Event URL
            </label>
            <input
              id="mobilize-import-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.mobilize.us/nokings/event/1074514/"
              disabled={importing}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-border dark:border-white/10 bg-surface-muted dark:bg-white/5 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-ink-muted-on-dark text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
            <p className="mt-1 text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
              Tip: Supports single event URLs from any organization (e.g.{' '}
              <code>mobilize.us/indivisible/event/1011420/</code> or{' '}
              <code>mobilize.us/nokings/event/1074514/</code>).
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/admin/events"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-bright dark:text-accent-gold hover:underline"
            >
              <span>Manage full sync rules in /admin/events</span>
              <ExternalLink size={11} aria-hidden="true" />
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 rounded-xl border border-border dark:border-white/10 text-xs font-semibold hover:bg-surface-muted dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={importing || !url.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-bright hover:bg-primary-light text-white text-xs font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {importing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Import Event</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
