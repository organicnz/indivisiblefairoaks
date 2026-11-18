'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, MapPin, Share2, X } from 'lucide-react';
import Link from 'next/link';
import { GalleryImage } from '@/components/gallery/GalleryImage';
import { galleryAltText, galleryCaption } from '@/lib/gallery-alt';
import type { GalleryPhoto } from '@/lib/queries/content-client';

type GalleryLightboxProps = {
  photo: GalleryPhoto | null;
  copiedLink: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShare: () => void;
};

/**
 * Radix owns the focus trap, initial focus, restoration, scroll lock, inert
 * background, and Escape handling. The old hand-rolled dialog had none of
 * those. Thumbnails are not priority-loaded, so opening the page does not spend
 * its LCP budget on a modal image.
 */
export function GalleryLightbox({
  photo,
  copiedLink,
  onClose,
  onNext,
  onPrevious,
  onShare,
}: GalleryLightboxProps) {
  return (
    <Dialog.Root open={Boolean(photo)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        {photo && (
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-[160] flex items-center justify-center p-4 focus:outline-none sm:p-6 md:p-10"
          >
            <Dialog.Close className="absolute right-6 top-6 z-50 inline-flex size-11 items-center justify-center rounded-sm border border-white/20 bg-secondary/80 text-ink-on-dark transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold">
              <X size={20} aria-hidden="true" />
              <span className="sr-only">Close image viewer</span>
            </Dialog.Close>

            <button
              type="button"
              onClick={onPrevious}
              className="absolute left-4 z-50 inline-flex size-11 items-center justify-center rounded-sm border border-white/20 bg-secondary/80 text-ink-on-dark transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold sm:left-6"
            >
              <ChevronLeft size={24} aria-hidden="true" />
              <span className="sr-only">Previous image</span>
            </button>

            <button
              type="button"
              onClick={onNext}
              className="absolute right-4 z-50 inline-flex size-11 items-center justify-center rounded-sm border border-white/20 bg-secondary/80 text-ink-on-dark transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold sm:right-6"
            >
              <ChevronRight size={24} aria-hidden="true" />
              <span className="sr-only">Next image</span>
            </button>

            <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-secondary shadow-float">
              <div className="relative h-[min(55vh,70vw)] w-full bg-black sm:h-[65vh]">
                <GalleryImage
                  src={photo.url}
                  alt={galleryAltText(photo)}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1024px"
                  className="object-contain"
                />
              </div>

              <div className="flex flex-col items-start justify-between gap-4 border-t border-white/10 bg-secondary p-6 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm border border-primary-on-dark-muted/40 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-primary-on-dark-muted">
                      {photo.category}
                    </span>
                    <span className="font-mono text-xs text-ink-muted-on-dark">
                      {photo.date}
                    </span>
                  </div>

                  <Dialog.Title className="text-lg font-bold text-white sm:text-xl">
                    {galleryCaption(photo)}
                  </Dialog.Title>

                  {photo.signQuote && (
                    <div className="my-1 inline-block bg-accent-gold px-3 py-1 text-xs font-bold tracking-tight text-ink-strong">
                      Featured Sign: “{photo.signQuote}”
                    </div>
                  )}
                  <div className="flex flex-col gap-1 pt-0.5 text-xs text-ink-muted-on-dark sm:flex-row sm:items-center sm:gap-3">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-accent-gold" />
                      <span>{photo.location}</span>
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span>Photo: {photo.photographer}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onShare}
                    className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm border border-white/20 bg-white/5 px-4 text-xs font-semibold text-ink-on-dark transition-colors hover:bg-white/10"
                  >
                    <Share2 size={14} />
                    <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
                  </button>
                  <Link
                    href="/events"
                    className="inline-flex min-h-11 items-center rounded-sm bg-primary px-4 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-dark"
                  >
                    Attend Next Action
                  </Link>
                </div>
              </div>
            </div>
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
