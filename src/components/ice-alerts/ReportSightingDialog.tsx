'use client';

import { AlertTriangle, ExternalLink, LockKeyhole, MessageSquareText, Radio } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog';

const TEXT_REPORT_HREF = 'sms:8773222299?body=REPORT';
const ONLINE_REPORT_HREF = 'https://stopice.net/';

export function ReportSightingButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-11">
          <Radio className="size-3.5" aria-hidden="true" />
          Report a sighting
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto p-6 sm:p-7">
        <DialogHeader>
          <span className="civic-section-index">Private report + national option</span>
          <DialogTitle className="mt-1">Report a sighting</DialogTitle>
          <DialogDescription>
            This chapter accepts private, text-only reports. Raw text stays private; a unique,
            low-risk report may publish only a generated city-level summary, and similar reports
            are combined. You can also send what you saw to the national Stop ICE Alerts Network.
          </DialogDescription>
        </DialogHeader>

        <div className="border-l-2 border-accent pl-4">
          <p className="flex items-start gap-2 text-sm font-semibold leading-relaxed">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            Stay back. Do not approach or obstruct enforcement.
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            If it is safe, note the time and city-level location. Never send names, faces, plates,
            street addresses, immigration status, or exact locations.
          </p>
        </div>

        <div className="grid gap-2">
          <a
            href="/ice-alerts/report"
            className="inline-flex min-h-11 items-center justify-between gap-3 border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="inline-flex items-center gap-2">
              <LockKeyhole className="size-4 text-primary" aria-hidden="true" />
              Start a private chapter report
            </span>
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              Private
            </span>
          </a>
          <p className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            National network
          </p>
          <a
            href={TEXT_REPORT_HREF}
            className="inline-flex min-h-11 items-center justify-between gap-3 border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="inline-flex items-center gap-2">
              <MessageSquareText className="size-4 text-accent" aria-hidden="true" />
              Text REPORT to 877-322-2299
            </span>
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              SMS
            </span>
          </a>
          <a
            href={ONLINE_REPORT_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-between gap-3 border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="inline-flex items-center gap-2">
              <ExternalLink className="size-4 text-accent" aria-hidden="true" />
              Open the online report form
            </span>
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              Web
            </span>
          </a>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Immediate danger? Call 911. This page cannot dispatch help, verify a report, or guarantee
          that a national channel is available. A chapter report is private; a generated city-level
          summary may be published automatically, and similar reports may be combined. The national
          network&apos;s privacy and security terms apply to anything you send there.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export { TEXT_REPORT_HREF, ONLINE_REPORT_HREF };
