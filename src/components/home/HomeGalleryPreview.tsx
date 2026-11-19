'use client';

import { ArrowRight, Camera, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { FALLBACK_GALLERY_PHOTOS } from '@/config/gallery-fallback';
import { GalleryImage } from '@/components/gallery/GalleryImage';
import { DataPoint } from '@/components/ui/DataPoint';
import { galleryAltText, galleryCaption } from '@/lib/gallery-alt';
import { getGalleryPhotos, type GalleryPhoto } from '@/lib/queries/content-client';
import type { GalleryPhotoView } from '@/types/gallery';

interface PreviewPhoto {
  id: string;
  alt: string;
  title: string;
  location: string;
  category: string;
  image: string;
}

const toPreviewPhoto = (photo: GalleryPhotoView | GalleryPhoto): PreviewPhoto => ({
  id: photo.id,
  alt: galleryAltText(photo),
  title: galleryCaption(photo),
  location: photo.location || '',
  category: photo.category || '',
  image: photo.url || '',
});

const FALLBACK_PREVIEW_PHOTOS = FALLBACK_GALLERY_PHOTOS.map(toPreviewPhoto);

export function HomeGalleryPreview({
  photos: initialPhotos,
  dataPoints,
}: {
  photos?: GalleryPhotoView[];
  dataPoints?: Record<string, string>;
} = {}) {
  const [previewPhotos, setPreviewPhotos] = useState<PreviewPhoto[]>(() => {
    if (initialPhotos && initialPhotos.length > 0) {
      return initialPhotos.map(toPreviewPhoto);
    }
    return FALLBACK_PREVIEW_PHOTOS;
  });

  useEffect(() => {
    // The home server component always supplies this prop (possibly empty).
    // Treat a supplied array as authoritative; only a standalone mount with no
    // prop should pay for a second gallery request.
    if (initialPhotos) return;
    getGalleryPhotos().then((photos) => {
      // Map gallery_photos rows to PreviewPhoto format.
      const mapped = photos.map(toPreviewPhoto);

      // A successful but empty read must not blank the homepage section; the
      // checked-in fallback stays visible until the archive has real rows.
      if (mapped.length > 0) setPreviewPhotos(mapped);
    });
  }, [initialPhotos]);

  const displayedPhotos = previewPhotos.slice(0, 6);

  return (
    <section className="civic-section bg-surface-muted text-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="civic-section-head">
          <div className="min-w-0">
            <div className="civic-kicker">
              <Camera size={13} aria-hidden="true" />
              <DataPoint name="home.gallery.eyebrow" initialData={dataPoints}>
                Photojournalism In Action
              </DataPoint>
            </div>
            <DataPoint
              name="home.gallery.headline"
              as="h2"
              initialData={dataPoints}
              className="mt-4 max-w-[18ch] font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-foreground sm:text-5xl"
            >
              Moments of Peaceful Resistance
            </DataPoint>
          </div>

          <Link
            href="/gallery"
            className="civic-link-arrow group justify-self-start md:justify-self-end"
          >
            <DataPoint name="home.gallery.btn_view_all" as="span" initialData={dataPoints}>
              Explore Full Gallery
            </DataPoint>
            <ArrowRight
              size={14}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
            />
          </Link>
        </div>

        {/* One horizontal, snap-scrolling strip on phones; a two-up grid from sm,
            with a featured lead frame from lg. */}
        {displayedPhotos.length === 0 ? (
          <div className="civic-panel flex min-h-60 flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="flex size-12 items-center justify-center border border-border bg-surface-muted text-muted-foreground">
              <Camera size={20} aria-hidden="true" />
            </span>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              The chapter photo archive is being prepared. Check back soon, or visit the gallery
              for the latest uploads.
            </p>
            <Link href="/gallery" className="civic-link-arrow group">
              Visit the gallery
              <ArrowRight
                size={14}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
              />
            </Link>
          </div>
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:auto-rows-[20rem] lg:grid-cols-3">
          {displayedPhotos.map((photo, index) => {
            // A full set of six makes a complete magazine grid: the lead frame
            // spans two rows while the other five fill the remaining cells.
            const isFeature = index === 0 && displayedPhotos.length === 6;
            return (
              <Link
                key={photo.id}
                href="/gallery"
                className={`group relative block h-80 w-[82vw] max-w-[340px] shrink-0 snap-start overflow-hidden rounded-sm border border-foreground/20 bg-surface-card text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-88 sm:w-auto sm:max-w-none lg:h-full ${
                  isFeature ? 'lg:col-span-2 lg:row-span-2' : ''
                }`}
              >
                <GalleryImage
                  src={photo.image}
                  alt={photo.alt}
                  sizes={
                    isFeature
                      ? '(min-width: 1024px) 66vw, (min-width: 640px) 50vw, 82vw'
                      : '(max-width: 768px) 82vw, (max-width: 1024px) 50vw, 33vw'
                  }
                  className="object-cover brightness-95 transition-[transform,filter] duration-500 group-hover:scale-[1.03] group-hover:brightness-100 motion-reduce:transform-none motion-reduce:transition-none"
                />

                {/* Gradient Scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/35 to-transparent opacity-90 transition-opacity group-hover:opacity-80" />

                {photo.category ? (
                  <span className="absolute left-4 top-4 z-10 block max-w-[calc(100%-2rem)] truncate border border-white/20 bg-secondary/85 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-accent-gold backdrop-blur-md">
                    {photo.category}
                  </span>
                ) : null}

                {/* Bottom Metadata */}
                <div className="absolute bottom-0 inset-x-0 p-5 z-10">
                  <h3
                    className={`font-display text-xl font-semibold leading-snug text-white transition-colors group-hover:text-accent-gold ${
                      isFeature ? 'lg:text-3xl' : ''
                    }`}
                  >
                    {photo.title}
                  </h3>
                  {photo.location ? (
                    <div className="mt-1.5 flex items-start gap-1 text-xs text-ink-muted-on-dark">
                      <MapPin
                        size={12}
                        className="mt-0.5 shrink-0 text-accent-gold"
                        aria-hidden="true"
                      />
                      <span className="line-clamp-2 min-w-0 break-words">{photo.location}</span>
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
          </div>
        )}
      </div>
    </section>
  );
}
