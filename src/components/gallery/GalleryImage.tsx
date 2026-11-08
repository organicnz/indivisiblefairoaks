'use client';

import { ImageOff } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

type GalleryImageProps = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fallbackLabel?: string;
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
}: GalleryImageProps) {
  const [failed, setFailed] = useState(!src);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt ? `${alt} — ${fallbackLabel}` : fallbackLabel}
        data-testid="gallery-image-fallback"
        className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-surface-muted px-4 text-center text-muted-foreground dark:bg-secondary dark:text-ink-muted-on-dark"
      >
        <ImageOff size={22} aria-hidden="true" className="shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]">{fallbackLabel}</span>
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
