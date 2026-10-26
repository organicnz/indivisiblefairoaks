'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  Check,
  Copy,
  Crosshair,
  Database,
  Filter,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { saveDataPoint } from '@/lib/queries/civic-client';

export interface ScannedDataPoint {
  key: string;
  group: string;
  initialValue: string;
  currentValue: string;
  isDirty: boolean;
  element: HTMLElement | null;
}

interface DataPointDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onHighlightElement?: (key: string) => void;
}

export const DataPointDrawer: React.FC<DataPointDrawerProps> = ({
  isOpen,
  onClose,
  onHighlightElement,
}) => {
  const [dataPoints, setDataPoints] = useState<ScannedDataPoint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Scan live DOM for all [data-data-point] elements
  const scanDataPoints = useCallback(() => {
    if (typeof document === 'undefined') return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-data-point]'));
    const scanned: ScannedDataPoint[] = [];
    const seen = new Set<string>();

    for (const el of elements) {
      const key = el.getAttribute('data-data-point')?.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const parts = key.split('.');
      const group = parts.length > 1 ? parts.slice(0, 2).join('.') : parts[0] || 'general';
      const text = el.textContent?.trim() || '';

      scanned.push({
        key,
        group,
        initialValue: text,
        currentValue: text,
        isDirty: false,
        element: el,
      });
    }

    setDataPoints(scanned);
  }, []);

  useEffect(() => {
    if (isOpen) {
      scanDataPoints();
    }
  }, [isOpen, scanDataPoints]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const dp of dataPoints) {
      set.add(dp.group);
    }
    return ['all', ...Array.from(set).sort()];
  }, [dataPoints]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return dataPoints.filter((dp) => {
      const matchesGroup = selectedGroup === 'all' || dp.group === selectedGroup;
      if (!matchesGroup) return false;
      if (!q) return true;
      return dp.key.toLowerCase().includes(q) || dp.currentValue.toLowerCase().includes(q);
    });
  }, [dataPoints, searchQuery, selectedGroup]);

  const dirtyCount = useMemo(() => dataPoints.filter((dp) => dp.isDirty).length, [dataPoints]);

  const handleValueChange = (key: string, newValue: string) => {
    setDataPoints((prev) =>
      prev.map((dp) => {
        if (dp.key !== key) return dp;
        const isDirty = newValue !== dp.initialValue;

        // Two-way DOM sync so the user sees live edits immediately on the page
        if (dp.element) {
          dp.element.textContent = newValue;
        }

        return {
          ...dp,
          currentValue: newValue,
          isDirty,
        };
      })
    );
  };

  const handleSpotlight = (dp: ScannedDataPoint) => {
    if (!dp.element) {
      const liveEl = document.querySelector<HTMLElement>(`[data-data-point="${dp.key}"]`);
      if (liveEl) {
        dp.element = liveEl;
      }
    }

    if (dp.element) {
      dp.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      dp.element.classList.add(
        'ring-4',
        'ring-accent-gold',
        'ring-offset-2',
        'ring-offset-black',
        'transition-all',
        'duration-300'
      );
      setTimeout(() => {
        dp.element?.classList.remove(
          'ring-4',
          'ring-accent-gold',
          'ring-offset-2',
          'ring-offset-black'
        );
      }, 2500);
      onHighlightElement?.(dp.key);
      toast.success(`Spotlight focused on "${dp.key}"`);
    } else {
      toast.error(`Element for "${dp.key}" not found in current DOM view`);
    }
  };

  const handleSaveOne = async (dp: ScannedDataPoint) => {
    setSavingKeys((prev) => new Set(prev).add(dp.key));
    try {
      const groupName = dp.key.split('.')[0] || 'general';
      const res = await saveDataPoint({
        key: dp.key,
        value: dp.currentValue,
        group_name: groupName,
        label: dp.key,
      });

      if (res.success) {
        toast.success(`Saved "${dp.key}"`);
        setDataPoints((prev) =>
          prev.map((item) =>
            item.key === dp.key ? { ...item, initialValue: dp.currentValue, isDirty: false } : item
          )
        );
        window.dispatchEvent(
          new CustomEvent('data-point-saved', {
            detail: { key: dp.key, value: dp.currentValue },
          })
        );
      } else {
        toast.error(res.error || `Failed to save "${dp.key}"`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to save "${dp.key}"`);
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(dp.key);
        return next;
      });
    }
  };

  const handleSaveAllModified = async () => {
    const dirtyItems = dataPoints.filter((dp) => dp.isDirty);
    if (dirtyItems.length === 0) return;

    setIsSavingAll(true);
    let successCount = 0;

    for (const dp of dirtyItems) {
      try {
        const groupName = dp.key.split('.')[0] || 'general';
        const res = await saveDataPoint({
          key: dp.key,
          value: dp.currentValue,
          group_name: groupName,
          label: dp.key,
        });
        if (res.success) {
          successCount++;
          window.dispatchEvent(
            new CustomEvent('data-point-saved', {
              detail: { key: dp.key, value: dp.currentValue },
            })
          );
        }
      } catch {
        // Continue saving remaining
      }
    }

    setDataPoints((prev) =>
      prev.map((item) =>
        item.isDirty ? { ...item, initialValue: item.currentValue, isDirty: false } : item
      )
    );
    setIsSavingAll(false);
    toast.success(`Saved ${successCount} data point${successCount === 1 ? '' : 's'} to database`);
  };

  const handleResetOne = (dp: ScannedDataPoint) => {
    handleValueChange(dp.key, dp.initialValue);
    toast.info(`Reset "${dp.key}" to initial value`);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in-0" />
        <Dialog.Content
          aria-label="Page DataPoints Manager"
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-white/15 bg-secondary text-white shadow-2xl animate-in slide-in-from-right duration-200 focus:outline-none"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-accent-gold/20 text-accent-gold border border-accent-gold/40">
                <Database size={18} />
              </div>
              <div>
                <Dialog.Title className="text-base font-black uppercase tracking-wider text-white">
                  Page DataPoints Matrix
                </Dialog.Title>
                <Dialog.Description className="text-xs text-ink-muted-on-dark">
                  {dataPoints.length} live database fields detected on this page
                </Dialog.Description>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={scanDataPoints}
                title="Rescan page for DataPoints"
                aria-label="Rescan page"
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <RefreshCw size={14} />
              </button>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close DataPoints drawer"
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Search & Group Filter Bar */}
          <div className="shrink-0 space-y-3 border-b border-white/10 bg-surface-card/40 p-4">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search keys or copy (e.g. 'gallery.hero', 'No Kings')..."
                className="w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-4 py-2 text-xs text-white placeholder:text-white/40 focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
              <Filter size={13} className="text-slate-400 shrink-0 mr-1" />
              {groups.map((grp) => {
                const count =
                  grp === 'all'
                    ? dataPoints.length
                    : dataPoints.filter((d) => d.group === grp).length;
                const isSelected = selectedGroup === grp;
                return (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setSelectedGroup(grp)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-accent-gold text-ink-strong shadow-xs'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{grp}</span>
                    <span className="ml-1 opacity-70 font-mono text-[10px]">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {filtered.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <Database size={28} className="mx-auto text-slate-400 opacity-60" />
                <p className="text-sm font-semibold text-slate-300">No matching DataPoints found</p>
                <p className="text-xs text-ink-muted-on-dark">
                  Try clearing your search query or group filter
                </p>
              </div>
            ) : (
              filtered.map((dp) => {
                const isSaving = savingKeys.has(dp.key);
                return (
                  <div
                    key={dp.key}
                    data-datapoint-card={dp.key}
                    className={`rounded-xl border p-3.5 transition-all ${
                      dp.isDirty
                        ? 'border-accent-gold/60 bg-accent-gold/5 shadow-md shadow-accent-gold/5'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    {/* Card Top */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="font-mono text-xs font-bold text-sky-400 truncate"
                          title={dp.key}
                        >
                          {dp.key}
                        </span>
                        {dp.isDirty && (
                          <span className="shrink-0 rounded bg-accent-gold/20 border border-accent-gold/40 px-1.5 py-0.2 text-[9px] font-bold text-accent-gold uppercase">
                            Modified
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(dp.key);
                            toast.success(`Copied "${dp.key}"`);
                          }}
                          title="Copy DataPoint key"
                          aria-label={`Copy key ${dp.key}`}
                          className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <Copy size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSpotlight(dp)}
                          title="Scroll & Spotlight this field on the live page"
                          aria-label={`Spotlight ${dp.key}`}
                          className="inline-flex items-center gap-1 rounded bg-sky-500/15 border border-sky-400/30 px-2 py-0.5 text-[10px] font-bold text-sky-300 hover:bg-sky-500/25 transition-colors cursor-pointer"
                        >
                          <Crosshair size={11} />
                          <span>Spotlight</span>
                        </button>
                      </div>
                    </div>

                    {/* Value Input */}
                    <div className="space-y-2">
                      <textarea
                        rows={dp.currentValue.length > 80 ? 3 : 2}
                        value={dp.currentValue}
                        onChange={(e) => handleValueChange(dp.key, e.target.value)}
                        placeholder="Empty string..."
                        className="w-full rounded-lg border border-white/15 bg-black/50 p-2.5 text-xs text-white leading-relaxed placeholder:text-white/40 focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
                      />

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center gap-2">
                          {dp.isDirty && (
                            <button
                              type="button"
                              onClick={() => handleResetOne(dp)}
                              title="Revert changes to initial value"
                              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                            >
                              <RotateCcw size={11} />
                              <span>Revert</span>
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={!dp.isDirty || isSaving}
                          onClick={() => handleSaveOne(dp)}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40 ${
                            dp.isDirty
                              ? 'bg-accent-gold text-ink-strong hover:bg-amber-400 cursor-pointer'
                              : 'bg-white/10 text-slate-400'
                          }`}
                        >
                          {isSaving ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} className="stroke-[3]" />
                          )}
                          <span>{isSaving ? 'Saving' : 'Save Field'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer with Batch Save */}
          <div className="shrink-0 flex items-center justify-between border-t border-white/10 bg-secondary px-6 py-3.5">
            <span className="text-xs text-ink-muted-on-dark font-mono">
              {dirtyCount > 0 ? (
                <span className="text-accent-gold font-bold">
                  {dirtyCount} modified unsaved field(s)
                </span>
              ) : (
                'All fields synced with live DOM'
              )}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                Close
              </button>

              <button
                type="button"
                disabled={dirtyCount === 0 || isSavingAll}
                onClick={handleSaveAllModified}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-ink-strong px-4 py-1.5 text-xs font-black uppercase tracking-wider hover:bg-accent-gold transition-colors disabled:opacity-40 cursor-pointer shadow-raised"
              >
                {isSavingAll ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                <span>Save All ({dirtyCount})</span>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
