'use client';

import { Download, Loader2, Plus, X } from 'lucide-react';

type CRMPanelTab = 'constituents' | 'events' | 'news' | 'links';

interface CRMPanelHeaderProps {
  activeTab: CRMPanelTab;
  onTabChange: (tab: CRMPanelTab) => void;
  showSegments: boolean;
  onToggleSegments: () => void;
  onExportCsv: () => void;
  isExporting: boolean;
  totalCount: number;
  onAddContact: () => void;
  onClose: () => void;
}

export function CRMPanelHeader({
  activeTab,
  onTabChange,
  showSegments,
  onToggleSegments,
  onExportCsv,
  isExporting,
  totalCount,
  onAddContact,
  onClose,
}: CRMPanelHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-surface-muted rounded-xl border border-border">
          <button
            type="button"
            onClick={() => onTabChange('constituents')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === 'constituents'
                ? 'bg-primary text-white shadow-xs font-black'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Constituents
          </button>
          <button
            type="button"
            onClick={() => onTabChange('events')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === 'events'
                ? 'bg-primary text-white shadow-xs font-black'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Events
          </button>
          <button
            type="button"
            onClick={() => onTabChange('news')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === 'news'
                ? 'bg-primary text-white shadow-xs font-black'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Newsletters
          </button>
          <button
            type="button"
            onClick={() => onTabChange('links')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === 'links'
                ? 'bg-primary text-white shadow-xs font-black'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Links
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {activeTab === 'constituents' && (
          <>
            <button
              type="button"
              onClick={onToggleSegments}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                showSegments
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/50'
              }`}
            >
              Segments
            </button>
            <button
              type="button"
              onClick={onExportCsv}
              disabled={isExporting || totalCount === 0}
              title="Export filtered constituents to CSV"
              aria-label="Export CSV"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-bold text-foreground hover:bg-muted transition-colors disabled:opacity-50 shadow-2xs"
            >
              {isExporting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={onAddContact}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-light transition-colors shadow-xs"
            >
              <Plus size={12} className="mr-1" /> Add
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Close CRM panel"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
