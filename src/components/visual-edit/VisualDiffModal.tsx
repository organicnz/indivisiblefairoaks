'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  Activity,
  ArrowRight,
  Check,
  Database,
  Layers,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type React from 'react';
import { useId, useState } from 'react';

export interface ModifiedDataPointItem {
  key: string;
  initialValue: string;
  currentValue: string;
}

export interface ModifiedBlockItem {
  blockId: string;
  type: string;
  label: string;
}

export interface VisualDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modifiedDataPoints: ModifiedDataPointItem[];
  modifiedBlocks?: ModifiedBlockItem[];
  onRevertDataPoint?: (key: string) => void;
  onSaveAll?: () => void;
  isSaving?: boolean;
}

export const VisualDiffModal: React.FC<VisualDiffModalProps> = ({
  open,
  onOpenChange,
  modifiedDataPoints,
  modifiedBlocks = [],
  onRevertDataPoint,
  onSaveAll,
  isSaving = false,
}) => {
  const titleId = useId();
  const descId = useId();
  const [filterType, setFilterType] = useState<'all' | 'datapoints' | 'blocks'>('all');

  const totalCount = modifiedDataPoints.length + modifiedBlocks.length;

  const showDataPoints = filterType === 'all' || filterType === 'datapoints';
  const showBlocks = filterType === 'all' || filterType === 'blocks';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-md animate-in fade-in-0 duration-200" />
        <Dialog.Content
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="fixed left-1/2 top-1/2 z-[160] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/20 bg-slate-950/95 p-0 text-white shadow-2xl backdrop-blur-2xl duration-200 animate-in fade-in-0 zoom-in-95 flex flex-col max-h-[85vh] overflow-hidden"
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between border-b border-white/10 px-6 py-4 bg-secondary">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-accent-gold/20 text-accent-gold border border-accent-gold/30">
                <Activity size={18} />
              </div>
              <div>
                <Dialog.Title
                  id={titleId}
                  className="text-base font-black tracking-tight text-white flex items-center gap-2"
                >
                  <span>Visual Change Review & Diff</span>
                  <span className="rounded-full bg-accent-gold/20 border border-accent-gold/40 px-2 py-0.5 text-[10px] font-mono font-bold text-accent-gold">
                    {totalCount} {totalCount === 1 ? 'change' : 'changes'}
                  </span>
                </Dialog.Title>
                <Dialog.Description id={descId} className="text-xs text-ink-muted-on-dark">
                  Inspect exact draft diffs against the published baseline before committing.
                </Dialog.Description>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Close diff modal"
            >
              <X size={16} />
            </button>
          </div>

          {/* Filter Bar */}
          <div className="shrink-0 flex items-center justify-between border-b border-white/10 px-6 py-2.5 bg-black/40 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  filterType === 'all'
                    ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Changes ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('datapoints')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  filterType === 'datapoints'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                DataPoints ({modifiedDataPoints.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('blocks')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  filterType === 'blocks'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Page Blocks ({modifiedBlocks.length})
              </button>
            </div>

            <span className="text-[11px] font-mono text-ink-muted-on-dark hidden sm:inline">
              Comparing Local Draft ↔ Published DB
            </span>
          </div>

          {/* Diff Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {totalCount === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Check size={24} />
                </div>
                <p className="text-sm font-bold text-white">No Unsaved Changes</p>
                <p className="text-xs text-ink-muted-on-dark max-w-sm mx-auto">
                  Your current page draft matches the published state exactly. Make in-page edits to
                  see live diffs here.
                </p>
              </div>
            ) : (
              <>
                {/* DataPoints Section */}
                {showDataPoints && modifiedDataPoints.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 uppercase tracking-wider">
                      <Database size={13} />
                      <span>Modified DataPoints ({modifiedDataPoints.length})</span>
                    </div>

                    <div className="space-y-3">
                      {modifiedDataPoints.map((item) => (
                        <div
                          key={item.key}
                          data-testid={`diff-datapoint-${item.key}`}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-sky-400 truncate">
                              {item.key}
                            </span>
                            {onRevertDataPoint && (
                              <button
                                type="button"
                                onClick={() => onRevertDataPoint(item.key)}
                                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                                title="Revert to published baseline"
                              >
                                <RotateCcw size={11} />
                                <span>Revert</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                            {/* Baseline */}
                            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 space-y-1">
                              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider block">
                                Original (Published)
                              </span>
                              <p className="text-rose-100 whitespace-pre-wrap leading-relaxed break-words font-sans text-xs">
                                {item.initialValue || (
                                  <em className="text-rose-300/60 font-mono">(empty)</em>
                                )}
                              </p>
                            </div>

                            {/* Current Draft */}
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
                              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                                <span>Draft (Modified)</span>
                                <ArrowRight size={10} />
                              </span>
                              <p className="text-emerald-100 whitespace-pre-wrap leading-relaxed break-words font-sans text-xs font-medium">
                                {item.currentValue || (
                                  <em className="text-emerald-300/60 font-mono">(empty)</em>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Blocks Section */}
                {showBlocks && modifiedBlocks.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400 uppercase tracking-wider">
                      <Layers size={13} />
                      <span>Modified Content Sections ({modifiedBlocks.length})</span>
                    </div>

                    <div className="space-y-2">
                      {modifiedBlocks.map((block) => (
                        <div
                          key={block.blockId}
                          data-testid={`diff-block-${block.blockId}`}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-purple-400 animate-pulse" />
                            <span className="text-xs font-bold text-white uppercase">
                              {block.type}
                            </span>
                            <span className="text-xs text-ink-muted-on-dark truncate max-w-xs">
                              {block.label}
                            </span>
                          </div>
                          <span className="rounded bg-accent-gold/20 border border-accent-gold/40 px-2 py-0.5 text-[9px] font-bold text-accent-gold uppercase tracking-wider">
                            Modified In Draft
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between border-t border-white/10 bg-secondary px-6 py-3.5">
            <span className="text-xs font-mono text-ink-muted-on-dark">
              {totalCount > 0 ? (
                <span className="text-accent-gold font-bold">
                  {totalCount} uncommitted change(s) ready to publish
                </span>
              ) : (
                'All content synced with live database'
              )}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                Close
              </button>

              {onSaveAll && totalCount > 0 && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={onSaveAll}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-ink-strong px-4 py-1.5 text-xs font-black uppercase tracking-wider hover:bg-accent-gold transition-colors disabled:opacity-40 cursor-pointer shadow-raised"
                >
                  <Sparkles size={13} />
                  <span>{isSaving ? 'Saving…' : 'Save & Publish All'}</span>
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
