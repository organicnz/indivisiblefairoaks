'use client';

import { Code, Layers, Move, Palette, RotateCcw, Type, Wand2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { type Block, serializeBlocks } from '@/lib/blocks';
import type { ThemeMode } from '@/lib/theme';

import type {
  VisualComposerDevice,
  VisualComposerMode,
  VisualComposerStyles,
  VisualComposerTab,
  VisualComposerThemeMode,
} from '@/types/unified';

import {
  AdvancedMotionStudio,
  BlockContentStudio,
  BoxModelStudio,
  CIVIC_CLASS_PRESETS,
  CodeStudio,
  compileBadgeHtml,
  compileClassNames,
  DEFAULT_VC_STYLES,
  DevicePreviewFrame,
  getStylesClipboard,
  InspectorHeader,
  PresetStudio,
  SECTION_PRESETS,
  SectionStudio,
  type StylePreset,
  setStylesClipboard,
  TypographyStudio,
  VC_COLUMN_PRESETS,
  VC_STYLE_PRESETS,
} from './composer';

export type {
  VisualComposerBackground,
  VisualComposerBorder,
  VisualComposerBoxModel,
  VisualComposerCivicPreset,
  VisualComposerColumnPreset,
  VisualComposerColumnSlot,
  VisualComposerDevice,
  VisualComposerEffects,
  VisualComposerLayout,
  VisualComposerMode,
  VisualComposerMotion,
  VisualComposerPreset,
  VisualComposerPresetCategory,
  VisualComposerResponsive,
  VisualComposerSection,
  VisualComposerSectionPreset,
  VisualComposerSectionTab,
  VisualComposerStyles,
  VisualComposerTab,
  VisualComposerThemeMode,
  VisualComposerTransform,
  VisualComposerTypography,
} from '@/types/unified';
export type { StylePreset };
export {
  CIVIC_CLASS_PRESETS,
  compileClassNames,
  DEFAULT_VC_STYLES,
  getStylesClipboard,
  SECTION_PRESETS,
  setStylesClipboard,
  VC_COLUMN_PRESETS,
  VC_STYLE_PRESETS,
};

export interface VisualComposerInspectorProps {
  open: boolean;
  onClose: () => void;
  block: Block | null;
  blockIndex: number | null;
  onSaveBlock: (
    updatedBlock: Block,
    customClasses?: string,
    anchorId?: string,
    customStyle?: string
  ) => void;
  initialMode?: VisualComposerMode;
}

export function VisualComposerInspector({
  open,
  onClose,
  block,
  blockIndex,
  onSaveBlock,
  initialMode = 'block',
}: VisualComposerInspectorProps) {
  const [inspectorMode, setInspectorMode] = useState<VisualComposerMode>(initialMode);
  const [activeTab, setActiveTab] = useState<VisualComposerTab>('content');
  const [styles, setStyles] = useState<VisualComposerStyles>(DEFAULT_VC_STYLES);
  const [currentBlock, setCurrentBlock] = useState<Block | null>(block);
  const [hasCopiedStyles, setHasCopiedStyles] = useState<boolean>(Boolean(getStylesClipboard()));
  const [isSidesLinked, setIsSidesLinked] = useState<boolean>(true);
  const [previewDevice, setPreviewDevice] = useState<VisualComposerDevice>('desktop');
  const [previewTheme, setPreviewTheme] = useState<ThemeMode>('system');
  const [jsonConfigDraft, setJsonConfigDraft] = useState<string>('');

  const titleId = useId();
  const descId = useId();

  // Sync block state when props change
  useEffect(() => {
    setCurrentBlock(block);
    if (block && 'html' in block && typeof block.html === 'string') {
      const trimmed = block.html.trim();
      const divMatch = trimmed.match(/^<div\s+([^>]*?)>/i);
      if (divMatch) {
        const attrs = divMatch[1] || '';
        const idMatch = attrs.match(/id=["']([^"']+)["']/i);
        const classMatch = attrs.match(/class=["']([^"']+)["']/i);
        const styleMatch = attrs.match(/style=["']([^"']+)["']/i);
        const themeMatch = attrs.match(/data-theme(?:-mode)?=["']([^"']+)["']/i);
        if (idMatch?.[1]) {
          setStyles((prev) => ({ ...prev, anchorId: idMatch[1] }));
        }
        if (classMatch?.[1]) {
          setStyles((prev) => ({
            ...prev,
            customClasses: prev.customClasses || classMatch[1],
          }));
        }
        if (styleMatch?.[1]) {
          setStyles((prev) => ({
            ...prev,
            customStyle: prev.customStyle || styleMatch[1],
          }));
        }
        if (themeMatch?.[1]) {
          const mode = themeMatch[1] as VisualComposerThemeMode;
          if (['dark', 'light', 'system'].includes(mode)) {
            setStyles((prev) => ({ ...prev, themeMode: mode }));
          }
        } else if (classMatch?.[1]) {
          if (classMatch[1].includes('[data-theme=dark]')) {
            setStyles((prev) => ({ ...prev, themeMode: 'dark' }));
          } else if (classMatch[1].includes('[data-theme=light]')) {
            setStyles((prev) => ({ ...prev, themeMode: 'light' }));
          } else if (classMatch[1].includes('[data-theme-mode=system]')) {
            setStyles((prev) => ({ ...prev, themeMode: 'system' }));
          }
        }
      }

      // Restore decorative badge ribbon if present in the block HTML
      const badgeMatch = trimmed.match(/<span\s+data-vc-badge(?:[^>]*)>(.*?)<\/span>/i);
      if (badgeMatch) {
        const text = badgeMatch[1].trim();
        const toneMatch = badgeMatch[0].match(/data-tone=["']([^"']+)["']/);
        const posMatch = badgeMatch[0].match(/data-pos=["']([^"']+)["']/);
        setStyles((prev) => ({
          ...prev,
          badgeText: text,
          badgeTone:
            (toneMatch?.[1] as VisualComposerStyles['badgeTone']) || prev.badgeTone || 'gold',
          badgePosition:
            (posMatch?.[1] as VisualComposerStyles['badgePosition']) ||
            prev.badgePosition ||
            'top-right',
        }));
      }
    }
  }, [block]);

  // Sync mode if initialMode prop updates
  useEffect(() => {
    setInspectorMode(initialMode);
  }, [initialMode]);

  if (!open || !currentBlock || blockIndex === null) return null;

  // Build Tailwind classes string based on mode
  const compiledClassNames = compileClassNames(inspectorMode, styles);

  const handleApply = () => {
    if (!currentBlock) return;
    let finalBlock: Block = { ...currentBlock };
    const badgeHtml = compileBadgeHtml(styles);
    if ('html' in finalBlock && typeof finalBlock.html === 'string') {
      let content = finalBlock.html.replace(/<span\s+data-vc-badge[^>]*>.*?<\/span>/gi, '');
      if (badgeHtml) {
        content = `${badgeHtml}${content}`;
      }
      finalBlock = {
        ...finalBlock,
        html: content,
      };
    } else if (badgeHtml) {
      const serialized = serializeBlocks([finalBlock]);
      finalBlock = {
        id: finalBlock.id,
        type: 'unsupported',
        html: `${badgeHtml}${serialized}`,
      };
    }

    onSaveBlock(
      finalBlock,
      compiledClassNames,
      styles.anchorId.trim() || undefined,
      styles.customStyle?.trim() || undefined
    );
    onClose();
  };

  const handleApplyPreset = (preset: StylePreset) => {
    const applied = preset.apply();
    setStyles((prev) => ({
      ...prev,
      ...applied,
    }));
    toast.success(`Applied ${preset.name} preset`);
  };

  const handleCopyStyles = () => {
    setStylesClipboard({ ...styles });
    setHasCopiedStyles(true);
    toast.success('Block styles copied to clipboard');
  };

  const handlePasteStyles = () => {
    const cb = getStylesClipboard();
    if (!cb) {
      toast.error('Clipboard is empty. Copy styles from a block first.');
      return;
    }
    setStyles({ ...cb });
    toast.success('Styles pasted to active block');
  };

  const handleResetStyles = () => {
    setStyles(DEFAULT_VC_STYLES);
    toast.success('Styles reset to defaults');
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(styles, null, 2);
    setJsonConfigDraft(jsonStr);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(jsonStr)
        .then(() => {
          toast.success('Design configuration copied to clipboard as JSON');
        })
        .catch(() => {
          toast.success('Design configuration generated in Code tab');
        });
    } else {
      toast.success('Design configuration generated in Code tab');
    }
  };

  const handleImportJson = (rawJson?: unknown) => {
    const toParse = typeof rawJson === 'string' ? rawJson : jsonConfigDraft;
    if (!toParse || typeof toParse !== 'string' || !toParse.trim()) {
      toast.error('Please paste valid JSON configuration first');
      return;
    }
    try {
      const parsed = JSON.parse(toParse);
      if (typeof parsed === 'object' && parsed !== null) {
        setStyles((prev) => ({
          ...prev,
          ...parsed,
          section: { ...prev.section, ...parsed.section },
          typography: { ...prev.typography, ...parsed.typography },
          border: { ...prev.border, ...parsed.border },
          background: { ...prev.background, ...parsed.background },
          layout: { ...prev.layout, ...parsed.layout },
          effects: { ...prev.effects, ...parsed.effects },
          motion: { ...prev.motion, ...parsed.motion },
          transform: { ...prev.transform, ...parsed.transform },
          responsive: { ...prev.responsive, ...parsed.responsive },
        }));
        toast.success('Design configuration imported successfully');
      }
    } catch {
      toast.error('Invalid JSON design format');
    }
  };

  // Helper to cycle margin values
  const cycleMarginValue = (
    current: string,
    axis: 'vertical' | 'horizontal' = 'vertical'
  ): string => {
    const sequence =
      axis === 'horizontal'
        ? ['', 'mx-2', 'mx-4', 'mx-6', 'mx-auto']
        : ['', 'my-2', 'my-4', 'my-6', 'my-8', 'my-12'];
    const idx = sequence.indexOf(current);
    return sequence[(idx + 1) % sequence.length] || '';
  };

  // Helper to cycle padding values
  const cyclePaddingValue = (
    current: string,
    axis: 'vertical' | 'horizontal' = 'vertical'
  ): string => {
    const sequence =
      axis === 'horizontal'
        ? ['', 'px-2', 'px-4', 'px-6', 'px-8', 'px-12']
        : ['', 'p-2', 'p-4', 'p-6', 'p-8', 'p-12'];
    const idx = sequence.indexOf(current);
    return sequence[(idx + 1) % sequence.length] || '';
  };

  return (
    <aside
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-y-0 right-0 z-[10010] flex w-full max-w-md flex-col border-l border-white/20 bg-slate-950/95 text-white shadow-2xl backdrop-blur-2xl animate-in slide-in-from-right duration-200 pointer-events-auto"
    >
      {/* Drawer Header & Mode Switcher */}
      <InspectorHeader
        titleId={titleId}
        descId={descId}
        blockIndex={blockIndex}
        blockType={currentBlock.type}
        inspectorMode={inspectorMode}
        setInspectorMode={setInspectorMode}
        hasCopiedStyles={hasCopiedStyles}
        onCopyStyles={handleCopyStyles}
        onPasteStyles={handlePasteStyles}
        onResetStyles={handleResetStyles}
        onClose={onClose}
      />

      {/* Tabs Navigation (Block Mode) */}
      {inspectorMode === 'block' && (
        <div className="flex border-b border-white/10 bg-slate-900/60 px-2 py-1.5 gap-1 text-[11px]">
          {[
            { id: 'content', label: 'Content', icon: Type },
            { id: 'presets', label: 'Presets', icon: Wand2 },
            { id: 'design', label: 'Box Model', icon: Move },
            { id: 'typography', label: 'Type', icon: Palette },
            { id: 'code', label: 'Code', icon: Code },
            { id: 'advanced', label: 'Advanced', icon: Layers },
          ].map((tab) => {
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
      )}

      {/* Live Mini Preview Box with Responsive Viewport Device Switcher */}
      <DevicePreviewFrame
        inspectorMode={inspectorMode}
        previewDevice={previewDevice}
        setPreviewDevice={setPreviewDevice}
        previewTheme={previewTheme}
        setPreviewTheme={setPreviewTheme}
        compiledClassNames={compiledClassNames}
        currentBlock={currentBlock}
        styles={styles}
      />

      {/* Tab Content Panels */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
        {/* ── Section / Row Mode Settings ───────────────────────────────── */}
        {inspectorMode === 'section' && (
          <SectionStudio
            styles={styles}
            setStyles={setStyles}
            compiledClassNames={compiledClassNames}
          />
        )}

        {/* ── Block Mode Tabs ─────────────────────────────────────────── */}
        {inspectorMode === 'block' && activeTab === 'content' && (
          <BlockContentStudio currentBlock={currentBlock} setCurrentBlock={setCurrentBlock} />
        )}

        {inspectorMode === 'block' && activeTab === 'presets' && (
          <PresetStudio onApplyPreset={handleApplyPreset} />
        )}

        {inspectorMode === 'block' && activeTab === 'design' && (
          <BoxModelStudio
            styles={styles}
            setStyles={setStyles}
            currentBlock={currentBlock}
            isSidesLinked={isSidesLinked}
            setIsSidesLinked={setIsSidesLinked}
            cycleMarginValue={cycleMarginValue}
            cyclePaddingValue={cyclePaddingValue}
          />
        )}

        {inspectorMode === 'block' && activeTab === 'typography' && (
          <TypographyStudio styles={styles} setStyles={setStyles} />
        )}

        {inspectorMode === 'block' && activeTab === 'code' && (
          <CodeStudio
            currentBlock={currentBlock}
            setCurrentBlock={setCurrentBlock}
            styles={styles}
            setStyles={setStyles}
            customStyleInputId="block-custom-style-input"
            jsonConfigDraft={jsonConfigDraft}
            setJsonConfigDraft={setJsonConfigDraft}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
          />
        )}

        {inspectorMode === 'block' && activeTab === 'advanced' && (
          <AdvancedMotionStudio
            styles={styles}
            setStyles={setStyles}
            compiledClassNames={compiledClassNames}
          />
        )}
      </div>

      {/* Drawer Footer Actions */}
      <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/80 px-5 py-3">
        <button
          type="button"
          onClick={handleResetStyles}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <RotateCcw size={13} />
          <span>Reset Styles</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-xl bg-accent-gold px-4 py-1.5 text-xs font-bold text-ink-strong hover:bg-accent-gold/90 transition-colors shadow-lg font-black"
          >
            {inspectorMode === 'section' ? 'Save Section' : 'Save Block'}
          </button>
        </div>
      </div>
    </aside>
  );
}
