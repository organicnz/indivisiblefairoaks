'use client';

import { ChevronDown, ChevronUp, Database } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { IceHistoricalHeader } from './IceHistoricalHeader';
import type { IceMapUrlState } from './map-url-state';
import type { HeatmapMeta } from './types';
import { useHistoricalSnapshot } from './use-historical-snapshot';

const loadHeatMapModule = () => import('./IceArrestHeatMap');

const IceArrestHeatMap = dynamic(
  () => loadHeatMapModule().then((module) => module.IceArrestHeatMap),
  {
    ssr: false,
    loading: () => <HistoricalMapSkeleton />,
  }
);

type HistoricalFoiaModuleProps = {
  meta: HeatmapMeta;
  initialState: IceMapUrlState;
  initialOpen: boolean;
  dataPoints: Record<string, string>;
};

const MODULE_ID = 'historical-foia';
const PANEL_ID = 'historical-foia-panel';

function visibleModule() {
  return document.getElementById(MODULE_ID);
}

/**
 * The historical FOIA map lives on the rapid-response page rather than on a
 * separate route. It stays collapsed until a reader asks for it so the live
 * dashboard remains the primary experience and only one map initializes by
 * default. Legacy `?view=history` links still open it, and #historical-foia
 * links from the page navigation and map popups open and scroll to it.
 *
 * The 8,599-city snapshot and the map code are requested only after the module
 * opens. Passing the snapshot as an eager prop put the city rows into the
 * initial RSC payload twice, adding roughly 1.7 MB to the document for a panel
 * most visitors never expand.
 */
export function HistoricalFoiaModule({
  meta,
  initialState,
  initialOpen,
  dataPoints,
}: HistoricalFoiaModuleProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [hasOpened, setHasOpened] = useState(initialOpen);
  const { snapshot, status: loadStatus, load: loadSnapshot } = useHistoricalSnapshot();

  useEffect(() => {
    if (!isOpen) return;
    // Start the map chunk and the snapshot fetch together. Rendering the
    // dynamic map only after the snapshot resolves serialized two independent
    // requests; on a loaded runner the panel could miss its readiness window.
    // dynamic() reuses this module promise, so the chunk is not fetched twice.
    void loadHeatMapModule().catch(() => {
      // The dynamic boundary owns the load-failure UI.
    });
    void loadSnapshot();
  }, [isOpen, loadSnapshot]);

  const markOpenInUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'history');
    url.hash = MODULE_ID;
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, []);

  const openModule = useCallback(
    ({ scroll = false }: { scroll?: boolean } = {}) => {
      setHasOpened(true);
      setIsOpen(true);
      markOpenInUrl();

      if (scroll) {
        requestAnimationFrame(() => {
          visibleModule()?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    },
    [markOpenInUrl]
  );

  const closeModule = useCallback(() => {
    setIsOpen(false);

    const url = new URL(window.location.href);
    if (url.searchParams.get('view') === 'history') {
      url.searchParams.delete('view');
    }
    if (url.hash === `#${MODULE_ID}`) {
      url.hash = '';
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, []);

  useEffect(() => {
    if (!initialOpen) return;
    const frame = requestAnimationFrame(() => {
      visibleModule()?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialOpen]);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash !== `#${MODULE_ID}`) return;
      setHasOpened(true);
      setIsOpen(true);
      markOpenInUrl();
      requestAnimationFrame(() => {
        visibleModule()?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, [markOpenInUrl]);

  return (
    <section
      id={MODULE_ID}
      aria-labelledby="historical-foia-title"
      className="scroll-mt-28 border-y border-border bg-surface-muted/40"
    >
      <IceHistoricalHeader
        meta={meta}
        dataPoints={dataPoints}
        action={
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={PANEL_ID}
            onClick={() => (isOpen ? closeModule() : openModule())}
            className="inline-flex min-h-9 items-center gap-1.5 border border-border bg-background px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Database className="size-3" aria-hidden="true" />
            {isOpen ? 'Hide historical map' : 'Explore historical map'}
            {isOpen ? (
              <ChevronUp className="size-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3" aria-hidden="true" />
            )}
          </button>
        }
      />

      <div id={PANEL_ID} hidden={!isOpen} className="border-t border-border bg-background">
        {hasOpened ? (
          snapshot ? (
            <IceArrestHeatMap
              snapshot={snapshot}
              initialState={initialState}
              urlKeyPrefix="foia"
              isActive={isOpen}
            />
          ) : loadStatus === 'error' ? (
            <HistoricalMapError onRetry={() => void loadSnapshot()} />
          ) : (
            <HistoricalMapSkeleton />
          )
        ) : null}
      </div>
    </section>
  );
}

function HistoricalMapSkeleton() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-[clamp(19.5rem,43vh,31rem)] w-full animate-pulse border border-border bg-surface-muted" />
      <span className="sr-only">Loading historical ICE map…</span>
    </div>
  );
}

function HistoricalMapError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-3xl flex-col items-start gap-3 px-4 py-10 sm:px-6 lg:px-8"
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        The historical heat-map data is temporarily unavailable. The rapid-response map above is
        unaffected.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-9 items-center border border-border bg-background px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Try again
      </button>
    </div>
  );
}
