'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  CheckCircle2,
  Crosshair,
  FileSearch,
  Heading,
  Image as ImageIcon,
  MousePointerClick,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export interface AuditIssue {
  id: string;
  type: 'image' | 'heading' | 'interactive' | 'datapoint';
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  element: HTMLElement | null;
}

interface PageA11yAuditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PageA11yAuditor: React.FC<PageA11yAuditorProps> = ({ isOpen, onClose }) => {
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [score, setScore] = useState<number>(100);
  const [isScanning, setIsScanning] = useState(false);

  const runAudit = useCallback(() => {
    if (typeof document === 'undefined') return;
    setIsScanning(true);
    const foundIssues: AuditIssue[] = [];

    // 1. Audit Images for alt text
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('main img, header img'));
    images.forEach((img, idx) => {
      const alt = img.getAttribute('alt');
      if (alt === null) {
        foundIssues.push({
          id: `img-missing-${idx}`,
          type: 'image',
          severity: 'error',
          title: 'Image missing alt attribute',
          description: `Source: ${img.src ? img.src.split('/').pop() : 'inline image'}`,
          element: img,
        });
      } else if (alt.trim() === '' && !img.getAttribute('aria-hidden')) {
        foundIssues.push({
          id: `img-empty-${idx}`,
          type: 'image',
          severity: 'warning',
          title: 'Image has empty alt text',
          description: 'If decorative, consider adding aria-hidden="true".',
          element: img,
        });
      }
    });

    // 2. Audit Heading Structure
    const h1s = Array.from(document.querySelectorAll<HTMLHeadingElement>('h1'));
    if (h1s.length === 0) {
      foundIssues.push({
        id: 'heading-no-h1',
        type: 'heading',
        severity: 'error',
        title: 'Missing H1 heading',
        description: 'Page has no primary H1 tag for screen readers & SEO.',
        element: null,
      });
    } else if (h1s.length > 1) {
      foundIssues.push({
        id: 'heading-multiple-h1',
        type: 'heading',
        severity: 'warning',
        title: 'Multiple H1 headings detected',
        description: `Found ${h1s.length} H1 tags. A single H1 per page is recommended.`,
        element: h1s[1],
      });
    }

    // 3. Audit Interactive Elements (Buttons & Links)
    const interactives = Array.from(document.querySelectorAll<HTMLElement>('main button, main a'));
    interactives.forEach((el, idx) => {
      const text = el.textContent?.trim() || '';
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledBy = el.getAttribute('aria-labelledby');
      const title = el.getAttribute('title');

      if (!text && !ariaLabel && !ariaLabelledBy && !title) {
        foundIssues.push({
          id: `interactive-${idx}`,
          type: 'interactive',
          severity: 'error',
          title: 'Unlabeled interactive element',
          description: `<${el.tagName.toLowerCase()}> has no visible text or aria-label.`,
          element: el,
        });
      }
    });

    // 4. Audit DataPoints for empty content
    const dataPoints = Array.from(document.querySelectorAll<HTMLElement>('[data-data-point]'));
    dataPoints.forEach((dp, idx) => {
      const text = dp.textContent?.trim() || '';
      const key = dp.getAttribute('data-data-point') || '';
      if (!text) {
        foundIssues.push({
          id: `dp-empty-${idx}`,
          type: 'datapoint',
          severity: 'warning',
          title: `Empty DataPoint: "${key}"`,
          description: 'Field rendered with empty content on the live page.',
          element: dp,
        });
      }
    });

    // Calculate score
    const penalties = foundIssues.reduce((acc, issue) => {
      if (issue.severity === 'error') return acc + 12;
      if (issue.severity === 'warning') return acc + 5;
      return acc + 2;
    }, 0);

    const calculatedScore = Math.max(20, Math.min(100, 100 - penalties));
    setScore(calculatedScore);
    setIssues(foundIssues);
    setIsScanning(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      runAudit();
    }
  }, [isOpen, runAudit]);

  const handleSpotlight = (issue: AuditIssue) => {
    if (issue.element) {
      issue.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      issue.element.classList.add(
        'ring-4',
        'ring-rose-500',
        'ring-offset-2',
        'ring-offset-black',
        'transition-all',
        'duration-300'
      );
      setTimeout(() => {
        issue.element?.classList.remove(
          'ring-4',
          'ring-rose-500',
          'ring-offset-2',
          'ring-offset-black'
        );
      }, 2500);
      toast.success(`Spotlight focused on issue`);
    } else {
      toast.info('No DOM element associated with this global rule');
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in-0" />
        <Dialog.Content
          aria-label="Civic Accessibility & Page Health Auditor"
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-white/15 bg-secondary text-white shadow-2xl animate-in slide-in-from-right duration-200 focus:outline-none"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex size-9 items-center justify-center rounded-xl border ${
                  score >= 90
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : score >= 75
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                }`}
              >
                <ShieldCheck size={18} />
              </div>
              <div>
                <Dialog.Title className="text-base font-black uppercase tracking-wider text-white">
                  Civic A11y & Health Audit
                </Dialog.Title>
                <Dialog.Description className="text-xs text-ink-muted-on-dark">
                  Live DOM scan for WCAG accessibility, SEO, & DataPoint health
                </Dialog.Description>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runAudit}
                disabled={isScanning}
                title="Rescan page"
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
              </button>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close A11y audit drawer"
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X size={15} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Score Hero Banner */}
          <div className="shrink-0 p-5 border-b border-white/10 bg-surface-card/40 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted-on-dark">
                Accessibility & SEO Score
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-4xl font-black font-mono ${
                    score >= 90
                      ? 'text-emerald-400'
                      : score >= 75
                        ? 'text-amber-400'
                        : 'text-rose-400'
                  }`}
                >
                  {score}%
                </span>
                <span className="text-xs text-slate-300 font-semibold">
                  {score >= 90
                    ? 'Excellent • High Civic Standards'
                    : score >= 75
                      ? 'Good • Minor optimizations recommended'
                      : 'Needs Attention • Fix errors for screen readers'}
                </span>
              </div>
            </div>
          </div>

          {/* Issue Cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {issues.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <CheckCircle2 size={36} className="mx-auto text-emerald-400" />
                <p className="text-sm font-bold text-white">0 Issues Detected!</p>
                <p className="text-xs text-ink-muted-on-dark max-w-xs mx-auto">
                  Every image has alt text, headings are properly structured, interactive controls
                  have labels, and all DataPoints are populated.
                </p>
              </div>
            ) : (
              issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`rounded-xl border p-3.5 space-y-1.5 transition-all ${
                    issue.severity === 'error'
                      ? 'border-rose-500/40 bg-rose-500/10'
                      : issue.severity === 'warning'
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {issue.type === 'image' && (
                        <ImageIcon size={14} className="text-sky-400 shrink-0" />
                      )}
                      {issue.type === 'heading' && (
                        <Heading size={14} className="text-purple-400 shrink-0" />
                      )}
                      {issue.type === 'interactive' && (
                        <MousePointerClick size={14} className="text-amber-400 shrink-0" />
                      )}
                      {issue.type === 'datapoint' && (
                        <FileSearch size={14} className="text-emerald-400 shrink-0" />
                      )}

                      <span className="font-bold text-xs text-white truncate">{issue.title}</span>
                    </div>

                    {issue.element && (
                      <button
                        type="button"
                        onClick={() => handleSpotlight(issue)}
                        className="inline-flex items-center gap-1 rounded bg-white/10 hover:bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white transition-colors cursor-pointer shrink-0"
                      >
                        <Crosshair size={11} />
                        <span>Spotlight</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-ink-muted-on-dark leading-relaxed">
                    {issue.description}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between border-t border-white/10 bg-secondary px-6 py-3.5">
            <span className="text-xs text-ink-muted-on-dark">
              {issues.length} item{issues.length === 1 ? '' : 's'} inspected
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 px-4 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
