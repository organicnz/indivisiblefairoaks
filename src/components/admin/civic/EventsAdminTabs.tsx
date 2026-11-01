'use client';

import { Calendar, Radio } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { CivicEventManager } from './CivicEventManager';
import { MobilizeSyncPanel } from './MobilizeSyncPanel';

type TabKey = 'events' | 'mobilize';

/**
 * `/admin/events` — two views of the same table.
 *
 * A tab inside the events page, not a new top-level admin section: the
 * Mobilize sync is how these rows get created, not a separate product area, and
 * a whole nav slot for a background job would be a permanent cost for a
 * once-a-season visit.
 *
 * ARIA tabs with a roving tabindex and arrow-key movement, matching the
 * pattern used elsewhere in this admin.
 */
export function EventsAdminTabs() {
  const [active, setActive] = useState<TabKey>('events');
  const baseId = useId();
  const tabRefs = {
    events: useRef<HTMLButtonElement>(null),
    mobilize: useRef<HTMLButtonElement>(null),
  };

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Calendar }> = [
    { key: 'events', label: 'Events', icon: Calendar },
    { key: 'mobilize', label: 'Mobilize', icon: Radio },
  ];

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next: TabKey = active === 'events' ? 'mobilize' : 'events';
    setActive(next);
    tabRefs[next].current?.focus();
  };

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Event sources"
        onKeyDown={onKeyDown}
        className="inline-flex rounded-xl border border-border bg-surface-muted/60 p-1"
      >
        {tabs.map(({ key, label, icon: Icon }) => {
          const selected = active === key;
          return (
            <button
              key={key}
              ref={tabRefs[key]}
              type="button"
              role="tab"
              id={`${baseId}-${key}-tab`}
              aria-selected={selected}
              aria-controls={`${baseId}-${key}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider transition-colors ${
                selected
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={13} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-${active}-panel`}
        aria-labelledby={`${baseId}-${active}-tab`}
      >
        {active === 'events' ? <CivicEventManager /> : <MobilizeSyncPanel />}
      </div>
    </div>
  );
}
