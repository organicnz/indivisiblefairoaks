'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FALLBACK_GALLERY_PHOTOS } from '@/config/gallery-fallback';
import { type GalleryPhoto, getGalleryPhotos } from '@/lib/queries/content-client';

/**
 * Gallery data and selection state.
 *
 * The checked-in archive renders immediately; a real database response
 * replaces it, while an empty or unreachable response keeps the archive
 * visible instead of blanking the public page.
 */
export function useGallery() {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [photos, setPhotos] = useState<GalleryPhoto[]>(FALLBACK_GALLERY_PHOTOS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadGallery() {
      try {
        // One resolved request through the API mapper. The previous duplicate
        // raw fetch made an empty archive cost two failing round trips.
        const nextPhotos = await getGalleryPhotos();
        if (!cancelled && nextPhotos.length > 0) setPhotos(nextPhotos);
      } catch {
        // Keep the checked-in archive visible rather than turning a network
        // problem into a blank public page.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadGallery();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const values = new Set<string>(['All']);
    for (const photo of photos) values.add(photo.category);
    return Array.from(values);
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      const matchesCategory =
        selectedCategory === 'All' || photo.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      return (
        photo.caption.toLowerCase().includes(query) ||
        photo.location.toLowerCase().includes(query) ||
        Boolean(photo.signQuote?.toLowerCase().includes(query)) ||
        photo.category.toLowerCase().includes(query) ||
        photo.photographer.toLowerCase().includes(query)
      );
    });
  }, [photos, searchQuery, selectedCategory]);

  const selectedPhoto =
    photos.find((photo) => photo.id === selectedPhotoId) ?? null;
  const currentIndex = selectedPhoto
    ? filteredPhotos.findIndex((photo) => photo.id === selectedPhoto.id)
    : -1;

  const handleNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < filteredPhotos.length - 1) {
      setSelectedPhotoId(filteredPhotos[currentIndex + 1].id);
    } else if (filteredPhotos.length > 0) {
      setSelectedPhotoId(filteredPhotos[0].id);
    }
  }, [currentIndex, filteredPhotos]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedPhotoId(filteredPhotos[currentIndex - 1].id);
    } else if (filteredPhotos.length > 0) {
      setSelectedPhotoId(filteredPhotos[filteredPhotos.length - 1].id);
    }
  }, [currentIndex, filteredPhotos]);

  // Escape is Radix Dialog's job; adding a second listener here raced it.
  useEffect(() => {
    if (!selectedPhotoId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') handleNext();
      if (event.key === 'ArrowLeft') handlePrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoId, handleNext, handlePrev]);

  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const handleShare = useCallback(() => {
    if (typeof window === 'undefined') return;

    navigator.clipboard.writeText(window.location.href).catch(() => {
      // Clipboard access can be denied; silently claiming success would make
      // the button look broken.
      setCopiedLink(false);
    });
    setCopiedLink(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedLink(false), 3000);
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedCategory('All');
    setSearchQuery('');
  }, []);

  return {
    photos,
    categories,
    filteredPhotos,
    isLoading,
    selectedPhoto,
    selectedPhotoId,
    selectedCategory,
    searchQuery,
    copiedLink,
    mastheadPhoto: photos[0],
    setSelectedPhotoId,
    setSelectedCategory,
    setSearchQuery,
    handleNext,
    handlePrev,
    handleShare,
    resetFilters,
  };
}
