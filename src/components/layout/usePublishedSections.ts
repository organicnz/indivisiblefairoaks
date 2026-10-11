'use client';

import { useCallback, useEffect, useState } from 'react';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';
import type { PublishedSection } from '@/lib/visual-sections';
import { discoverPageSections, isPublishedSectionListCurrent } from '@/lib/visual-sections';
import type { VisualSectionsPublishedDetail } from '@/types/unified';

/**
 * The published section list for one pathname and one region.
 *
 * A hook rather than state in each component because two components read it —
 * the header's menu and the navigation drawer's row — and each previously ran
 * its own copy of the same subscription. The copy was the bug: the two could
 * disagree about which document they were on, so the drawer offered controls
 * addressing blocks in a region the header had already left. One subscription
 * cannot disagree with itself.
 *
 * The publication is the overlay's, not this hook's. Deriving a list here was
 * how the header once offered to edit an element that was a different section,
 * and the write went to the wrong block. A missing publication falls back to
 * DOM discovery only so an empty menu never looks like a broken one.
 */
export function usePublishedSections({
  enabled,
  pathname,
  activeRegionId,
}: {
  enabled: boolean;
  pathname: string;
  activeRegionId: string | null;
}): { sections: PublishedSection[] } {
  const [sections, setSections] = useState<PublishedSection[]>([]);

  const adopt = useCallback(
    (detail: VisualSectionsPublishedDetail | null) => {
      if (!detail || !Array.isArray(detail.sections)) {
        setSections(discoverPageSections(document.querySelector('main')));
        return;
      }
      // One place decides whether a publication is still about the document
      // this control is on — page *and* region. `isPublishedSectionListCurrent`
      // is that comparison, shared rather than re-implemented per component.
      if (!isPublishedSectionListCurrent(detail, pathname, activeRegionId)) return;
      setSections(detail.sections);
    },
    [pathname, activeRegionId]
  );

  useEffect(() => {
    if (!enabled) {
      setSections([]);
      return;
    }

    const handleUpdate = (event: Event) => {
      adopt((event as CustomEvent<VisualSectionsPublishedDetail>).detail ?? null);
    };

    window.addEventListener(VISUAL_EDIT_EVENTS.sectionsPublished, handleUpdate);
    // Ask for a publication now: an overlay that mounted before this control
    // has no reason to know someone new is listening.
    handleUpdate(new CustomEvent(VISUAL_EDIT_EVENTS.sectionsPublished));

    return () => {
      window.removeEventListener(VISUAL_EDIT_EVENTS.sectionsPublished, handleUpdate);
    };
  }, [adopt, enabled]);

  return { sections };
}

/**
 * Which copy region the visual editor is bound to.
 *
 * State, not a read of the DOM: the overlay owns the document, and a region
 * selected here and not there is a switch that moves and changes nothing. The
 * `selectCopyRegion` emitter in `lib/visual-edit-events.ts` is what tells the
 * overlay about a change.
 */
export function useActiveRegion(enabled: boolean): {
  activeRegionId: string | null;
  setActiveRegionId: (id: string | null) => void;
} {
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) setActiveRegionId(null);
  }, [enabled]);

  return { activeRegionId, setActiveRegionId };
}
