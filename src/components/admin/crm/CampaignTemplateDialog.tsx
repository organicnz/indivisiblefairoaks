'use client';

import { Sparkles, Trash2 } from 'lucide-react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CAMPAIGN_TEMPLATES } from '@/components/admin/crm/composer/templates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import type { CRMBroadcast } from '@/types/crm';
import type { ComposerTemplate } from '@/types/unified';

export function CampaignTemplateDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
  drafts,
  onApplyTemplate,
  onLoadDraft,
  onDiscardDraft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: 'presets' | 'drafts';
  onTabChange: (tab: 'presets' | 'drafts') => void;
  drafts: CRMBroadcast[];
  onApplyTemplate: (template: ComposerTemplate) => void;
  onLoadDraft: (draft: CRMBroadcast) => void;
  onDiscardDraft: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-surface-card p-6 border border-border">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="text-amber-500" size={18} />
              Campaign Templates &amp; Backend Drafts
            </DialogTitle>
            <div className="inline-flex rounded-lg bg-surface-muted p-0.5 border border-border self-start sm:self-auto">
              <button
                type="button"
                onClick={() => onTabChange('presets')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  tab === 'presets'
                    ? 'bg-surface-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Activist Presets
              </button>
              <button
                type="button"
                onClick={() => onTabChange('drafts')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  tab === 'drafts'
                    ? 'bg-surface-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Saved Drafts ({drafts.length})
              </button>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            {tab === 'presets'
              ? 'Pick a ready-to-use activist template with pre-formatted blocks, action items, and CTA links.'
              : 'Browse and load campaigns saved directly to your Supabase backend.'}
          </DialogDescription>
        </DialogHeader>

        {tab === 'presets' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 max-h-[70vh] overflow-y-auto">
            {CAMPAIGN_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="flex flex-col justify-between p-4 rounded-xl border border-border bg-surface-card hover:border-primary/50 hover:bg-surface-muted/50 transition-all text-left shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary dark:text-primary-on-dark">
                      {template.badge}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-bold">
                      {template.blocks.length} sections
                    </span>
                  </div>
                  <h4 className="mb-1 font-display text-sm font-semibold tracking-[-0.01em] text-foreground">
                    {template.name}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {template.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyTemplate(template)}
                  className="w-full py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-dark transition-colors shadow-2xs"
                >
                  Use This Template
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-3 max-h-[70vh] overflow-y-auto space-y-2.5">
            {drafts.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-border rounded-xl space-y-2">
                <p className="text-xs font-bold text-muted-foreground">
                  No saved drafts in Supabase yet.
                </p>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  Click &quot;Save Draft&quot; in the composer toolbar at any time to save your
                  visual design directly to the database.
                </p>
              </div>
            ) : (
              drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-surface-card hover:border-primary/40 transition-colors shadow-2xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-muted text-foreground">
                        Draft
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Updated {new Date(draft.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground truncate">
                      {draft.subject || 'Untitled Draft'}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {draft.body ? `${draft.body.slice(0, 100)}...` : 'Empty body'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onLoadDraft(draft)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-dark transition-colors"
                    >
                      Load Draft
                    </button>
                    <ConfirmAction
                      label="Delete Draft"
                      message={`Permanently discard draft "${draft.subject || 'Untitled'}"?`}
                      confirmLabel="Delete"
                      danger
                      idleClassName="p-1.5 rounded-lg border border-rose-100 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                      onConfirm={() => onDiscardDraft(draft.id)}
                    >
                      <Trash2 size={13} />
                    </ConfirmAction>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
