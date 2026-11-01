'use client';

import { Code, Layers, Move, Palette, Type, Wand2 } from 'lucide-react';
import { type KeyboardEvent, useRef } from 'react';
import type { VisualComposerTab } from '@/types/unified';

/**
 * The DOM id of one tab.
 *
 * Exported because the panel and the button that opens it have to agree on it,
 * and they are rendered in different components. Deriving both from one
 * function is what stops `aria-controls` from pointing at an id that changed.
 */
export const inspectorTabId = (idBase: string, tab: VisualComposerTab) => `${idBase}-tab-${tab}`;

/** The DOM id of the panel one tab controls. */
export const inspectorTabPanelId = (idBase: string, tab: VisualComposerTab) =>
  `${idBase}-panel-${tab}`;

export interface InspectorTabBarProps {
  activeTab: VisualComposerTab;
  setActiveTab: (tab: VisualComposerTab) => void;
  /**
   * Tabs that do not apply in the current mode. Batch styling hides `content`
   * and `code`: applying one block's body copy to N blocks would overwrite N
   * documents, and silently dropping those edits is worse than not offering
   * them.
   */
  excludedTabs?: readonly VisualComposerTab[];
  /**
   * The id prefix shared with the panels. Passed rather than generated here so
   * the strip and the panel it selects cannot drift apart.
   */
  idBase: string;
}

export const INSPECTOR_TABS = [
  { id: 'content', label: 'Content', icon: Type },
  { id: 'presets', label: 'Presets', icon: Wand2 },
  { id: 'design', label: 'Box Model', icon: Move },
  { id: 'typography', label: 'Type', icon: Palette },
  { id: 'code', label: 'Code', icon: Code },
  { id: 'advanced', label: 'Advanced', icon: Layers },
] as const;

export function InspectorTabBar({
  activeTab,
  setActiveTab,
  excludedTabs = [],
  idBase,
}: InspectorTabBarProps) {
  const tabs = INSPECTOR_TABS.filter((tab) => !excludedTabs.includes(tab.id as VisualComposerTab));
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Arrow keys walk the strip, Home and End jump to its ends.
   *
   * Selection follows focus: the panels are local and cheap to render, so the
   * second click a manual-activation strip would require buys nothing. Only the
   * active tab is in the Tab order — six tabs between the mode switch and the
   * first control is a tax on every visit — which is what makes these keys the
   * only way through the strip once focus is on it.
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((tab) => tab.id === activeTab);
    const last = tabs.length - 1;
    let next = -1;

    if (e.key === 'ArrowRight') next = current < 0 ? 0 : (current + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = current <= 0 ? last : current - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;

    if (next < 0) return;
    e.preventDefault();
    setActiveTab(tabs[next].id as VisualComposerTab);
    // Same render, so the roving tabindex has not settled yet; focusing by
    // position rather than by id keeps this independent of that timing.
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Inspector sections"
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      className="flex border-b border-white/10 bg-slate-900/60 px-2 py-1.5 gap-1 text-[11px]"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={inspectorTabId(idBase, tab.id as VisualComposerTab)}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={inspectorTabPanelId(idBase, tab.id as VisualComposerTab)}
            aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
            // Roving tabindex: the strip is one stop, not six.
            tabIndex={isActive ? 0 : -1}
            onClick={() => setActiveTab(tab.id as VisualComposerTab)}
            className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-gold ${
              isActive
                ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={12} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
