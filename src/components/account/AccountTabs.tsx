'use client';

import type { LucideIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useTransition } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TabDef {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

// Panel map: tab id → zero-arg render function
export type PanelMap = Record<string, () => React.ReactNode>;

interface TabsProps {
  tabs: TabDef[];
  panels: PanelMap;
  defaultTab?: string;
}

// ---------------------------------------------------------------------------
// Inner component (uses useSearchParams — must be wrapped in Suspense)
// ---------------------------------------------------------------------------
function TabsInner({ tabs, panels, defaultTab }: TabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeId = searchParams.get('tab') ?? defaultTab ?? tabs[0]?.id ?? '';
  const renderPanel = panels[activeId] ?? panels[tabs[0]?.id ?? ''];

  const setTab = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', id);
      startTransition(() => {
        router.push(`?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  return (
    <div className={isPending ? 'opacity-60 transition-opacity duration-150' : ''}>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Account navigation"
        className="flex border-b border-border mb-10 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeId === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') setTab(tabs[(idx + 1) % tabs.length].id);
                if (e.key === 'ArrowLeft') setTab(tabs[(idx - 1 + tabs.length) % tabs.length].id);
              }}
              className={[
                'relative flex items-center gap-2 px-5 py-4',
                'text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap',
                'transition-colors duration-150 outline-none',
                'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
                isActive
                  ? 'text-foreground after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-0.5 after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              <Icon size={13} aria-hidden="true" />
              {tab.label}
              {(tab.badge ?? 0) > 0 && (
                <span className="ml-1 bg-primary text-secondary text-[9px] font-black rounded-full min-w-[1rem] h-4 px-1 flex items-center justify-center leading-none">
                  {tab.badge}
                  <span className="sr-only">pending</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active panel only — nothing else mounts */}
      <div
        role="tabpanel"
        id={`panel-${activeId}`}
        aria-labelledby={`tab-${activeId}`}
        className="outline-none"
      >
        {renderPanel?.()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export — Suspense required for useSearchParams in App Router
// ---------------------------------------------------------------------------
export function AccountTabs(props: TabsProps) {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse">
          <div className="flex border-b border-border mb-10 gap-2">
            {props.tabs.map((t) => (
              <div key={t.id} className="h-12 w-28 rounded-t-lg bg-surface-muted" />
            ))}
          </div>
          <div className="h-64 rounded-3xl bg-surface-muted" />
        </div>
      }
    >
      <TabsInner {...props} />
    </Suspense>
  );
}
