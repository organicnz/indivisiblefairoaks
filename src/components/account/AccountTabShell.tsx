'use client';

import { Package, Settings, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useTransition } from 'react';

interface Tab {
  id: string;
  label: string;
  badge?: number;
}

const ICONS: Record<string, React.ElementType> = {
  admin: Package,
  orders: ShoppingBag,
  settings: Settings,
};

interface Props {
  tabs: Tab[];
  activeTab: string;
  children: ReactNode;
}

export function AccountTabShell({ tabs, activeTab, children }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setTab = (id: string) => {
    startTransition(() => {
      router.push(`?tab=${id}`, { scroll: true });
    });
  };

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
          const Icon = ICONS[tab.id] ?? Package;
          const isActive = activeTab === tab.id;
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
                <span className="ml-1 bg-primary text-white text-[9px] font-black rounded-full min-w-[1rem] h-4 px-1 flex items-center justify-center leading-none">
                  {tab.badge}
                  <span className="sr-only">pending</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active panel — rendered server-side, passed as children */}
      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="outline-none"
      >
        {children}
      </div>
    </div>
  );
}
