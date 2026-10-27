'use client';

import { useState } from 'react';
import type { Block } from '@/lib/blocks';
import type { VisualComposerCodeTab, VisualComposerStyles } from '@/types/unified';
import { CodeCustomStylesStudio, CodeHtmlStudio, CodeJsonExchangeStudio } from './code';

export { CodeCustomStylesStudio, CodeHtmlStudio, CodeJsonExchangeStudio };

export type CodeStudioTab = VisualComposerCodeTab;

export const CODE_STUDIO_TABS: readonly {
  id: VisualComposerCodeTab;
  label: string;
}[] = [
  { id: 'all', label: 'All Code Controls' },
  { id: 'html', label: 'HTML Markup' },
  { id: 'styles', label: 'Custom Styles & Inlines' },
  { id: 'json', label: 'JSON Config Exchange' },
] as const;

export interface CodeStudioProps {
  currentBlock: Block;
  setCurrentBlock: (block: Block) => void;
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  activeCodeTab?: VisualComposerCodeTab;
  onCodeTabChange?: (tab: VisualComposerCodeTab) => void;
  rawHtmlInputId?: string;
  blockAnchorIdInputId?: string;
  customClassesInputId?: string;
  customStyleInputId?: string;
  designJsonInputId?: string;
  jsonConfigDraft: string;
  setJsonConfigDraft: (draft: string) => void;
  onExportJson: () => void;
  onImportJson: () => void;
}

export function CodeStudio({
  currentBlock,
  setCurrentBlock,
  styles,
  setStyles,
  activeCodeTab,
  onCodeTabChange,
  rawHtmlInputId = 'raw-html-editor-input',
  blockAnchorIdInputId = 'block-anchor-id-input',
  customClassesInputId = 'block-custom-classes-input',
  customStyleInputId = 'code-custom-style-input',
  designJsonInputId = 'design-json-config-input',
  jsonConfigDraft,
  setJsonConfigDraft,
  onExportJson,
  onImportJson,
}: CodeStudioProps) {
  const [internalTab, setInternalTab] = useState<VisualComposerCodeTab>('all');
  const currentTab = activeCodeTab ?? internalTab;

  const handleTabClick = (tab: VisualComposerCodeTab) => {
    if (onCodeTabChange) {
      onCodeTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation Bar for Code Studio */}
      <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex border-b border-white/10 bg-slate-950/90 px-3 py-1.5 backdrop-blur-md overflow-x-auto gap-1 text-[11px] no-scrollbar">
        {CODE_STUDIO_TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={`shrink-0 px-2.5 py-1 rounded-lg font-medium transition-all ${
                isActive
                  ? 'bg-accent-gold text-ink-strong font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── 1. Raw Block HTML Markup ── */}
      {(currentTab === 'all' || currentTab === 'html') && (
        <CodeHtmlStudio
          currentBlock={currentBlock}
          setCurrentBlock={setCurrentBlock}
          rawHtmlInputId={rawHtmlInputId}
        />
      )}

      {/* ── 2. Custom CSS Utilities & Inline Styles ── */}
      {(currentTab === 'all' || currentTab === 'styles') && (
        <CodeCustomStylesStudio
          styles={styles}
          setStyles={setStyles}
          blockAnchorIdInputId={blockAnchorIdInputId}
          customClassesInputId={customClassesInputId}
          customStyleInputId={customStyleInputId}
        />
      )}

      {/* ── 3. 1-Click Design Config JSON Exchange Studio ── */}
      {(currentTab === 'all' || currentTab === 'json') && (
        <CodeJsonExchangeStudio
          designJsonInputId={designJsonInputId}
          jsonConfigDraft={jsonConfigDraft}
          setJsonConfigDraft={setJsonConfigDraft}
          onExportJson={onExportJson}
          onImportJson={onImportJson}
        />
      )}
    </div>
  );
}
