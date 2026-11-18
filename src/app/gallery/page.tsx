'use client';

import { GalleryFilters } from '@/components/gallery/GalleryFilters';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import { GalleryLightbox } from '@/components/gallery/GalleryLightbox';
import { GalleryMasthead } from '@/components/gallery/GalleryMasthead';
import { GallerySubmitCta } from '@/components/gallery/GallerySubmitCta';
import { GalleryVideoSpotlight } from '@/components/gallery/GalleryVideoSpotlight';
import { useGallery } from '@/components/gallery/use-gallery';
import { useDataPoints } from '@/hooks/useDataPoints';

export default function GalleryPage() {
  const { dataPoints } = useDataPoints('gallery');
  const gallery = useGallery();

  return (
    <div className="civic-page min-h-screen bg-background pb-20 pt-(--header-clearance) text-foreground">
      <GalleryMasthead dataPoints={dataPoints} photo={gallery.mastheadPhoto} />

      <GalleryFilters
        photos={gallery.photos}
        categories={gallery.categories}
        selectedCategory={gallery.selectedCategory}
        searchQuery={gallery.searchQuery}
        filteredCount={gallery.filteredPhotos.length}
        isLoading={gallery.isLoading}
        onCategoryChange={gallery.setSelectedCategory}
        onSearchChange={gallery.setSearchQuery}
      />

      <div
        className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8"
        aria-busy={gallery.isLoading}
      >
        <GalleryGrid
          photos={gallery.filteredPhotos}
          totalPhotoCount={gallery.photos.length}
          onSelectPhoto={gallery.setSelectedPhotoId}
          onResetFilters={gallery.resetFilters}
        />

        <GalleryVideoSpotlight dataPoints={dataPoints} />
        <GallerySubmitCta dataPoints={dataPoints} />
      </div>

      <GalleryLightbox
        photo={gallery.selectedPhoto}
        copiedLink={gallery.copiedLink}
        onClose={() => gallery.setSelectedPhotoId(null)}
        onNext={gallery.handleNext}
        onPrevious={gallery.handlePrev}
        onShare={gallery.handleShare}
      />
    </div>
  );
}
