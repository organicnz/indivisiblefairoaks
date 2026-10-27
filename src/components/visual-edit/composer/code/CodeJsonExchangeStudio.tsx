'use client';

import { Copy, Download, SlidersHorizontal, Upload } from 'lucide-react';
import { toast } from 'sonner';

export interface CodeJsonExchangeStudioProps {
  designJsonInputId?: string;
  jsonConfigDraft: string;
  setJsonConfigDraft: (draft: string) => void;
  onExportJson: () => void;
  onImportJson: () => void;
}

export function CodeJsonExchangeStudio({
  designJsonInputId = 'design-json-config-input',
  jsonConfigDraft,
  setJsonConfigDraft,
  onExportJson,
  onImportJson,
}: CodeJsonExchangeStudioProps) {
  const handleCopyDraft = () => {
    if (!jsonConfigDraft) {
      toast.error('Draft is empty. Click Export JSON first.');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(jsonConfigDraft).then(() => {
        toast.success('JSON copied to clipboard');
      });
    }
  };

  const handleFormatDraft = () => {
    if (!jsonConfigDraft.trim()) return;
    try {
      const parsed = JSON.parse(jsonConfigDraft);
      setJsonConfigDraft(JSON.stringify(parsed, null, 2));
      toast.success('Formatted JSON');
    } catch {
      toast.error('Invalid JSON format cannot be formatted');
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <SlidersHorizontal size={13} className="text-accent-gold" />
          <span>Design Config JSON Studio</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onExportJson}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Download size={11} />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            onClick={onImportJson}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border border-accent-gold/40 bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30 transition-colors cursor-pointer"
          >
            <Upload size={11} />
            <span>Import JSON</span>
          </button>
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Export full design token styles as portable JSON to share across blocks or import external
        presets.
      </p>
      <label htmlFor={designJsonInputId} className="sr-only">
        Design Configuration JSON
      </label>
      <div className="relative">
        <textarea
          id={designJsonInputId}
          rows={6}
          value={jsonConfigDraft}
          onChange={(e) => setJsonConfigDraft(e.target.value)}
          placeholder='Click "Export JSON" to inspect token state, or paste JSON here and click "Import JSON"...'
          className="w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-white font-mono text-[10px] focus:border-accent-gold/50 focus:outline-none placeholder:text-white/40"
        />
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyDraft}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <Copy size={10} />
            <span>Copy Draft</span>
          </button>
          <button
            type="button"
            onClick={handleFormatDraft}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Format JSON
          </button>
        </div>
        <button
          type="button"
          onClick={() => setJsonConfigDraft('')}
          className="text-slate-400 hover:text-white transition-colors underline"
        >
          Clear Draft
        </button>
      </div>
    </div>
  );
}
