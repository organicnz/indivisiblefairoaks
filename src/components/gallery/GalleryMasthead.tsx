import { Camera } from 'lucide-react';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { GalleryImage } from '@/components/gallery/GalleryImage';
import { DataPoint } from '@/components/ui/DataPoint';
import { galleryAltText, galleryCaption } from '@/lib/gallery-alt';
import type { GalleryPhoto } from '@/lib/queries/content-client';

type GalleryMastheadProps = {
  dataPoints: Record<string, string>;
  photo: GalleryPhoto | undefined;
};

export function GalleryMasthead({ dataPoints, photo }: GalleryMastheadProps) {
  return (
    <PageMasthead
      icon={Camera}
      visual={
        photo ? (
          <figure className="relative w-52 xl:w-60">
            <div
              aria-hidden="true"
              className="absolute inset-0 translate-x-2.5 translate-y-2.5 border border-foreground/20 bg-surface-deep/60"
            />
            <div className="relative aspect-[4/5] overflow-hidden border border-foreground/25 bg-surface-muted">
              <GalleryImage
                src={photo.url}
                alt={galleryAltText(photo)}
                sizes="(min-width: 1280px) 240px, 208px"
                className="object-cover"
                priority
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-secondary/90 via-secondary/45 to-transparent p-3 pt-10">
                <figcaption className="text-white">
                  <span className="line-clamp-2 block font-display text-sm font-semibold leading-snug">
                    {galleryCaption(photo)}
                  </span>
                  <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/80">
                    {photo.category} / Archive
                  </span>
                </figcaption>
              </div>
            </div>
          </figure>
        ) : undefined
      }
      eyebrow={
        <DataPoint initialData={dataPoints} name="gallery.hero.eyebrow">
          Photojournalism In Action • Moments of Peaceful Resistance
        </DataPoint>
      }
      title={
        <DataPoint
          initialData={dataPoints}
          name="gallery.hero.headline"
          as="h1"
          className={MASTHEAD_TITLE}
        >
          Democracy In Full View
        </DataPoint>
      }
      intro={
        <DataPoint
          initialData={dataPoints}
          name="gallery.hero.intro"
          as="p"
          className={MASTHEAD_INTRO}
        >
          Snapshots of our neighbors gathering, singing, holding signs, and speaking truth to
          power across Sacramento County. Curated from our legacy site archives, Sacramento No
          Kings mobilizations, NorCal Resist community defense, Carmichael Resistance Choir, and
          witty grassroots cardboard art. Strictly 100% grassroots — zero politicians, zero
          corporate branding.
        </DataPoint>
      }
    />
  );
}
