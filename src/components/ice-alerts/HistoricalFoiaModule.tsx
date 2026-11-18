'use client';

import { ChevronDown, ChevronUp, Database } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { IceArrestHeatMap } from './IceArrestHeatMap';
import { IceHistoricalHeader } from './IceHistoricalHeader';
import type { IceMapUrlState } from './map-url-state';
import type { HeatmapSnapshot } from './types';

type HistoricalFoiaModuleProps = {
  snapshot: HeatmapSnapshot;
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
 */
export function HistoricalFoiaModule({
  snapshot,
  initialState,
  initialOpen,
  dataPoints,
}: HistoricalFoiaModuleProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [hasOpened, setHasOpened] = useState(initialOpen);

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
        snapshot={snapshot}
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

      <div
        id={PANEL_ID}
        hidden={!isOpen}
        className="border-t border-border bg-background"
      >
        {hasOpened ? (
          <IceArrestHeatMap
            snapshot={snapshot}
            initialState={initialState}
            urlKeyPrefix="foia"
            isActive={isOpen}
          />
        ) : null}
      </div>
    </section>
  );
}
