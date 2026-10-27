'use client';

import { Code, Layers, Move, Palette, Type, Wand2 } from 'lucide-react';
import type { VisualComposerTab } from '@/types/unified';

export interface InspectorTabBarProps {
  activeTab: VisualComposerTab;
  setActiveTab: (tab: VisualComposerTab) => void;
}

export const INSPECTOR_TABS = [
  { id: 'content', label: 'Content', icon: Type },
  { id: 'presets', label: 'Presets', icon: Wand2 },
  { id: 'design', label: 'Box Model', icon: Move },
  { id: 'typography', label: 'Type', icon: Palette },
  { id: 'code', label: 'Code', icon: Code },
  { id: 'advanced', label: 'Advanced', icon: Layers },
] as const;

export function InspectorTabBar({ activeTab, setActiveTab }: InspectorTabBarProps) {
  return (
    <div className="flex border-b border-white/10 bg-slate-900/60 px-2 py-1.5 gap-1 text-[11px]">
      {INSPECTOR_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as VisualComposerTab)}
            className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg font-bold transition-colors ${
              isActive
                ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={12} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
