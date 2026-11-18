'use client';

import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard size={18} className="text-accent-gold" />
            <span>Visual Editor Shortcuts</span>
          </DialogTitle>
          <DialogDescription>
            Power-user shortcuts to navigate, format, and manage page content rapidly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-3 text-xs">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Navigation & Global
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Command Palette & Spotlight Search</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ K
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Save Changes to Supabase</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ S
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Toggle Shortcuts Cheat Sheet</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ /
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Toggle Composer Inspector</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ E
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Next / Previous Section</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                    J
                  </kbd>
                  <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                    K
                  </kbd>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Add Section to Batch Selection</span>
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⇧ J / K
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Select Blocks for Batch Styling</span>
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ Click
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Edit Selected Section</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  Enter
                </kbd>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Composer Inspector
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Next / Previous Composer Tab</span>
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌥ ← / →
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">
                  Next / Previous Block (panel stays open)
                </span>
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌥ ↑ / ↓
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Apply Styles to the Page</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ ↵
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Undo / Redo a Style Change</span>
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ Z / ⌘ ⇧ Z
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Close Composer (asks before discarding)</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  Esc
                </kbd>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Section & History Actions
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Duplicate Active Section</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ D
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Delete Active Section</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ ⌫
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Move Active Section Up / Down</span>
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ ⇧ ↑ / ↓
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Reorder a Block by Dragging</span>
                <span className="text-[11px] font-mono text-muted-foreground">⠿ handle</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Add a Block After the Active One</span>
                <span className="text-[11px] font-mono text-muted-foreground">＋ on frame</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Undo / Redo Edit</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                    ⌘ Z
                  </kbd>
                  <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                    ⌘ ⇧ Z
                  </kbd>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Copy / Paste Block JSON</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Section Modal
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Import / Export Page JSON</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Settings Modal
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Pro Editing & Audit Tools
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Page DataPoints Matrix Drawer</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ ⇧ D
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Visual Change Review & Diff</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ ⇧ V
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Civic A11y & SEO Health Auditor</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ ⇧ A
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Toggle Live Inspector HUD</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ I
                </kbd>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              In-Editor Formatting
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Bold Selection</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ B
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Italic Selection</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ I
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Underline Selection</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ U
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Insert Link</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ K
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Save In-Place Edit</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ⌘ ↵
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                <span className="text-foreground">Cancel In-Place Edit</span>
                <kbd className="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-mono font-bold text-foreground shadow-xs">
                  Esc
                </kbd>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border"
          >
            Got It
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
