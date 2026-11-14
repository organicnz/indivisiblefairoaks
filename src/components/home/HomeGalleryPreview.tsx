'use client';

import { ArrowRight, Camera, Filter, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { FALLBACK_GALLERY_PHOTOS } from '@/config/gallery-fallback';
import { GalleryImage } from '@/components/gallery/GalleryImage';
import { DataPoint } from '@/components/ui/DataPoint';
import { getGalleryPhotos, type GalleryPhoto } from '@/lib/queries/content-client';
import type { GalleryPhotoView } from '@/types/gallery';

interface PreviewPhoto {
  id: string;
  title: string;
  location: string;
  category:
    | 'No Kings Sacramento'
    | 'NorCal Resist'
    | 'Sacramento Unity'
    | 'Witty Signs'
    | 'Resistance Choir'
    | 'Legacy Archives';
  image: string;
  signQuote?: string;
  date: string;
}

const toPreviewPhoto = (photo: GalleryPhotoView | GalleryPhoto): PreviewPhoto => ({
  id: photo.id,
  title: photo.caption || photo.alt || '',
  location: photo.location || '',
  category: (photo.category as PreviewPhoto['category']) || 'No Kings Sacramento',
  image: photo.url || '',
  signQuote: photo.signQuote ?? undefined,
  date: photo.date || '',
});

const FALLBACK_PREVIEW_PHOTOS = FALLBACK_GALLERY_PHOTOS.map(toPreviewPhoto);

export function HomeGalleryPreview({
  photos: initialPhotos,
  dataPoints,
}: {
  photos?: GalleryPhotoView[];
  dataPoints?: Record<string, string>;
} = {}) {
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
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

  const filterOptions = [
    { id: 'All', key: 'home.gallery.filter.all', defaultLabel: 'All' },
    {
      id: 'No Kings Sacramento',
      key: 'home.gallery.filter.no_kings',
      defaultLabel: 'No Kings Sacramento',
    },
    {
      id: 'NorCal Resist',
      key: 'home.gallery.filter.norcal_resist',
      defaultLabel: 'NorCal Resist',
    },
    { id: 'Sacramento Unity', key: 'home.gallery.filter.unity', defaultLabel: 'Sacramento Unity' },
    { id: 'Witty Signs', key: 'home.gallery.filter.witty', defaultLabel: 'Witty Signs' },
    { id: 'Resistance Choir', key: 'home.gallery.filter.choir', defaultLabel: 'Resistance Choir' },
    { id: 'Legacy Archives', key: 'home.gallery.filter.legacy', defaultLabel: 'Legacy Archives' },
  ];

  const availableFilterOptions = filterOptions.filter(
    (option) => option.id === 'All' || previewPhotos.some((photo) => photo.category === option.id)
  );

  // A filter that disappears when the archive changes must not leave the
  // reader on an empty grid with no way back. This is a state correction, not
  // a render-time guess.
  useEffect(() => {
    if (
      selectedFilter !== 'All' &&
      !previewPhotos.some((photo) => photo.category === selectedFilter)
    ) {
      setSelectedFilter('All');
    }
  }, [previewPhotos, selectedFilter]);

  const displayedPhotos =
    selectedFilter === 'All'
      ? previewPhotos.slice(0, 6)
      : previewPhotos.filter((p) => p.category === selectedFilter);

  return (
    <section className="border-t border-border bg-surface-muted py-16 text-foreground md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-9 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
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
              className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-foreground sm:text-5xl"
            >
              Moments of Peaceful Resistance
            </DataPoint>
            <DataPoint
              name="home.gallery.intro"
              as="p"
              initialData={dataPoints}
              className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base"
            >
              Snapshots of our neighbors gathering, singing, holding signs, and speaking truth to
              power across Sacramento County. Strictly 100% grassroots — zero politicians, zero
              corporate branding.
            </DataPoint>
          </div>

          <Link
            href="/gallery"
            className="group inline-flex shrink-0 items-center gap-2 border-b border-foreground/30 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <DataPoint name="home.gallery.btn_view_all" as="span" initialData={dataPoints}>
              Explore Full Gallery
            </DataPoint>
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Filters stay compact so they read as a toolbar, not another card row. */}
        <div
          role="group"
          aria-label="Filter photographs by collection"
          className="mb-8 flex items-center gap-2 overflow-x-auto border-t border-foreground/15 pb-2 pt-4 sm:flex-wrap sm:overflow-visible sm:pb-0"
        >
          <Filter size={14} className="mr-1 hidden text-muted-foreground sm:inline-block" />
          {availableFilterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={selectedFilter === option.id}
              onClick={() => setSelectedFilter(option.id)}
              className={`shrink-0 cursor-pointer border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
                selectedFilter === option.id
                  ? 'border-secondary bg-secondary text-white'
                  : 'border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground'
              }`}
            >
              <DataPoint as="span" name={option.key} initialData={dataPoints}>
                {option.defaultLabel}
              </DataPoint>
            </button>
          ))}
        </div>

        {/* One horizontal, snap-scrolling strip on phones; a 3-up grid from sm. */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
          {displayedPhotos.map((photo) => (
            <Link
              key={photo.id}
              href="/gallery"
              className="group relative block h-80 w-[82vw] max-w-[340px] shrink-0 snap-start overflow-hidden rounded-sm border border-foreground/20 bg-surface-card text-left transition-colors hover:border-primary/40 sm:h-88 sm:w-auto sm:max-w-none"
            >
              <GalleryImage
                src={photo.image}
                alt={photo.title}
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300 brightness-95 group-hover:brightness-100"
              />

              {/* Gradient Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/35 to-transparent opacity-90 transition-opacity group-hover:opacity-80" />

              {/* Top Badges */}
              <div className="absolute left-4 top-4 z-10 flex max-w-[85%] flex-col items-start gap-1.5">
                <span className="border border-white/20 bg-secondary/85 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-accent-gold backdrop-blur-md">
                  {photo.category}
                </span>
                {photo.signQuote && (
                  <span className="max-w-full truncate bg-accent-gold px-2 py-0.5 text-[10px] font-bold text-ink-strong">
                    “{photo.signQuote}”
                  </span>
                )}
              </div>

              {/* Bottom Metadata */}
              <div className="absolute bottom-0 inset-x-0 p-5 z-10 space-y-1.5">
                <h3 className="font-display text-xl font-semibold leading-snug text-white transition-colors group-hover:text-accent-gold">
                  {photo.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-ink-muted-on-dark">
                  <span className="flex items-center gap-1 truncate max-w-[70%]">
                    <MapPin size={12} className="text-accent-gold shrink-0" />
                    <span className="truncate">{photo.location}</span>
                  </span>
                  <span className="font-mono text-[10px] text-ink-muted-on-dark shrink-0">
                    {photo.date}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
