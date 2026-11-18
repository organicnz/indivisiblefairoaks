'use client';

import {
  Code,
  Eye,
  Loader2,
  Mail,
  PenTool,
  SendHorizonal,
  Sparkles,
} from 'lucide-react';
import { parseBodyToBlocks } from '@/components/admin/crm/composer/parser';
import { DevicePreviewFrame } from '@/components/admin/crm/composer/DevicePreviewFrame';
import { VisualComposerCanvas } from '@/components/admin/crm/composer/VisualComposerCanvas';
import type { ComposerBlock } from '@/types/unified';

interface BroadcastMessageEditorProps {
  setIsTemplatesOpen: (open: boolean) => void;
  composerMode: 'visual' | 'text';
  handleSwitchComposerMode: (mode: 'visual' | 'text') => void;
  handleSelfTest: () => void;
  isSelfTesting: boolean;
  subject: string;
  setSubject: (value: string) => void;
  body: string;
  setBody: (value: string) => void;
  setBlocks: (blocks: ComposerBlock[]) => void;
  previewMode: boolean;
  setPreviewMode: (value: boolean) => void;
  blocks: ComposerBlock[];
  handleBlocksChange: (blocks: ComposerBlock[]) => void;
  previewHtml: string | null;
  previewLoading: boolean;
  previewFailed: boolean;
}

export function BroadcastMessageEditor({
  setIsTemplatesOpen,
  composerMode,
  handleSwitchComposerMode,
  handleSelfTest,
  isSelfTesting,
  subject,
  setSubject,
  body,
  setBody,
  setBlocks,
  previewMode,
  setPreviewMode,
  blocks,
  handleBlocksChange,
  previewHtml,
  previewLoading,
  previewFailed,
}: BroadcastMessageEditorProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-primary dark:text-primary-on-dark" />
          <h2 className="font-display text-xs font-semibold tracking-[-0.01em] text-foreground">
            2. Message content
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsTemplatesOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
          >
            <Sparkles size={13} />
            Templates
          </button>

          <div className="flex items-center p-0.5 rounded-lg bg-surface-muted border border-border">
            <button
              type="button"
              onClick={() => handleSwitchComposerMode('visual')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                composerMode === 'visual'
                  ? 'bg-surface-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PenTool size={12} />
              Visual Canvas
            </button>
            <button
              type="button"
              onClick={() => handleSwitchComposerMode('text')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                composerMode === 'text'
                  ? 'bg-surface-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code size={12} />
              Raw Text
            </button>
          </div>

          <button
            type="button"
            onClick={handleSelfTest}
            disabled={isSelfTesting || !subject.trim() || !body.trim()}
            title="Send this message to your own inbox. Nobody else receives it."
            aria-label="Send test to self"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground bg-surface-muted hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:hover:bg-surface-muted"
          >
            {isSelfTesting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <SendHorizonal size={14} />
            )}
            Send a test to me
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode(!previewMode)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground bg-surface-muted hover:bg-surface-muted transition-colors"
          >
            <Eye size={14} />
            {previewMode ? 'Edit Draft' : 'Sensory Preview'}
          </button>
        </div>
      </div>

      {!previewMode ? (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="broadcast-subject"
              className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1.5"
            >
              Subject Line
            </label>
            <input
              id="broadcast-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Urgent Action: Stop H.R. 1 Rally at Carmichael Park"
              className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm font-bold text-foreground placeholder:font-normal placeholder:text-muted-foreground"
            />
          </div>

          {composerMode === 'visual' ? (
            <div>
              <span className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
                Visual Block Canvas
              </span>
              <VisualComposerCanvas blocks={blocks} onChange={handleBlocksChange} />
            </div>
          ) : null}

          <div className={composerMode === 'text' ? 'block' : 'sr-only'}>
            <label
              htmlFor="broadcast-body"
              className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1.5"
            >
              Message Body
            </label>
            <textarea
              id="broadcast-body"
              rows={10}
              value={body}
              onChange={(e) => {
                const next = e.target.value;
                setBody(next);
                setBlocks(parseBodyToBlocks(next));
              }}
              placeholder="Dear Neighbor,&#10;&#10;Join us this Saturday at Carmichael Park as we rally for democracy...&#10;&#10;Here are the three ways to take immediate action..."
              aria-describedby="broadcast-body-hint"
              className="w-full px-4 py-3 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm text-foreground leading-relaxed font-sans placeholder:text-muted-foreground"
            />
            <p id="broadcast-body-hint" className="mt-1.5 text-[11px] text-muted-foreground">
              Plain text / Markdown. Blank lines become paragraph breaks; URLs become
              clickable in recipient email clients.
            </p>
          </div>
        </div>
      ) : null}

      {previewMode && (
        <DevicePreviewFrame
          previewHtml={previewHtml || ''}
          previewLoading={previewLoading}
          previewFailed={previewFailed}
          subject={subject}
        />
      )}
    </>
  );
}
