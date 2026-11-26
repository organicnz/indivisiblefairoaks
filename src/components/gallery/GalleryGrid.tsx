import { MapPin } from 'lucide-react';
import { GalleryImage } from '@/components/gallery/GalleryImage';
import { galleryAltText, galleryCaption } from '@/lib/gallery-alt';
import type { GalleryPhoto } from '@/lib/queries/content-client';

type GalleryGridProps = {
  photos: GalleryPhoto[];
  totalPhotoCount: number;
  onSelectPhoto: (id: string) => void;
  onResetFilters: () => void;
};

export function GalleryGrid({
  photos,
  totalPhotoCount,
  onSelectPhoto,
  onResetFilters,
}: GalleryGridProps) {
  if (photos.length === 0) {
    return (
      <div className="space-y-4 py-20 text-center">
        <p className="text-base text-muted-foreground">
          {totalPhotoCount === 0
            ? 'The photo archive is being prepared. Check back soon.'
            : 'No photos match your current search or category filter.'}
        </p>
        {totalPhotoCount > 0 ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="min-h-11 rounded-sm bg-primary px-5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-dark"
          >
            Reset Filters
          </button>
        ) : (
          <a
            href="mailto:contact@indivisiblefairoaks.org?subject=Community%20Photo%20Submission"
            className="inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-dark"
          >
            Submit a Photo
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {photos.map((photo) => (
        <button
          key={photo.id}
          type="button"
          data-gallery-photo={photo.id}
          onClick={() => onSelectPhoto(photo.id)}
          className="group relative h-88 cursor-pointer overflow-hidden border border-border bg-secondary text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <GalleryImage
            src={photo.url}
            alt={galleryAltText(photo)}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 brightness-95 group-hover:scale-105 group-hover:brightness-100"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-secondary via-secondary/45 to-transparent opacity-90 transition-opacity group-hover:opacity-80" />

          <div className="absolute left-4 top-4 z-10 flex max-w-[85%] flex-col items-start gap-1.5">
            <span className="border border-white/20 bg-secondary px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent-gold">
              {photo.category}
            </span>
            {photo.signQuote && (
              <span className="max-w-full line-clamp-2 bg-accent-gold px-2.5 py-0.5 text-[11px] font-bold text-ink-strong">
                “{photo.signQuote}”
              </span>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 space-y-1.5 p-5">
            <span className="line-clamp-2 block font-display text-xl font-semibold leading-snug text-white transition-colors group-hover:text-accent-gold">
              {galleryCaption(photo)}
            </span>
            <div className="flex items-start justify-between gap-2 text-xs text-ink-muted-on-dark">
              <span className="flex min-w-0 max-w-[70%] items-start gap-1">
                <MapPin size={12} className="mt-0.5 shrink-0 text-accent-gold" aria-hidden="true" />
                <span className="line-clamp-2">{photo.location}</span>
              </span>
              <span className="shrink-0 font-mono text-[10px]">{photo.date}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
