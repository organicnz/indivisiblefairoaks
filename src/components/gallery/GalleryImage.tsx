'use client';

import { ImageOff } from 'lucide-react';
import Image from 'next/image';
import { type ReactNode, useState } from 'react';

type GalleryImageProps = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fallbackLabel?: string;
  /** Optional civic replacement for the generic error plate. */
  fallback?: ReactNode;
};

/**
 * Gallery photos come from storage rows, so a deleted or inaccessible object
 * can surface as a 400 from the image optimizer. Keep the layout intact and
 * show an honest fallback instead of leaving an empty media box.
 *
 * The `key` on the stateful child resets the error when a carousel or lightbox
 * moves to a different photo; a stale failure must not hide the next image.
 */
export function GalleryImage(props: GalleryImageProps) {
  return <GalleryImageState key={props.src} {...props} />;
}

function GalleryImageState({
  src,
  alt,
  className = '',
  sizes,
  priority = false,
  fallbackLabel = 'Photo unavailable',
  fallback,
}: GalleryImageProps) {
  const [failed, setFailed] = useState(!src);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt ? `${alt} — ${fallbackLabel}` : fallbackLabel}
        data-testid="gallery-image-fallback"
        className={
          fallback
            ? 'absolute inset-0 z-[1]'
            : 'civic-photo-fallback absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 overflow-hidden bg-secondary px-4 py-5 text-center text-ink-muted-on-dark'
        }
      >
        {fallback ?? (
          <div className="relative z-[1] flex flex-col items-center gap-2.5">
            <span className="flex size-11 items-center justify-center border border-white/15 bg-white/5 text-ink-muted-on-dark">
              <ImageOff size={19} aria-hidden="true" className="shrink-0" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
              {fallbackLabel}
            </span>
            {alt ? (
              <span className="line-clamp-2 max-w-[24ch] font-display text-sm font-semibold leading-snug text-ink-on-dark/70">
                {alt}
              </span>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
