import { Copy, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { formatRecoveryCode } from '@/lib/mfa-recovery';

export function MfaRecoveryCodesDialog({
  codes,
  copyState,
  downloadState,
  saveError,
  onCopy,
  onDownload,
  onPrint,
  onFinish,
}: {
  codes: string[];
  copyState: 'idle' | 'copied' | 'failed';
  downloadState: 'idle' | 'downloaded' | 'failed';
  saveError: string;
  onCopy: () => void;
  onDownload: () => void;
  onPrint: () => void;
  onFinish: () => void;
}) {
  /*
   * This dialog is deliberately not dismissible except through the button.
   * The codes are returned once and cannot be shown again; an accidental
   * Escape or outside click would otherwise throw them away and, during
   * admin enrollment, send the operator onward without a recovery path.
   */
  return (
    <Dialog open={codes.length > 0} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your recovery codes</DialogTitle>
            <DialogDescription>
              These codes are shown once. Store them somewhere separate from your authenticator.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              Each code can be used once to reset your authenticator setup. You will then enroll a
              new authenticator before continuing.
            </p>
            <ol className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-surface-muted p-4 font-mono text-sm text-foreground sm:grid-cols-2">
              {codes.map((code) => (
                <li key={code} className="tracking-wider">
                  {formatRecoveryCode(code)}
                </li>
              ))}
            </ol>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Button onClick={() => void onCopy()} variant="secondary">
                <Copy size={14} className="mr-2" aria-hidden="true" />
                {copyState === 'copied'
                  ? 'Copied'
                  : copyState === 'failed'
                    ? 'Copy blocked'
                    : 'Copy'}
              </Button>
              <Button onClick={onDownload} variant="secondary">
                <Download size={14} className="mr-2" aria-hidden="true" />
                {downloadState === 'downloaded' ? 'Downloaded' : 'Download'}
              </Button>
              <Button onClick={onPrint} variant="secondary">
                <Printer size={14} className="mr-2" aria-hidden="true" />
                Print
              </Button>
              <Button onClick={onFinish} className="sm:col-span-3">
                I have saved these codes
              </Button>
            </div>
            {saveError && (
              <p role="alert" className="text-xs font-medium text-accent-red">
                {saveError}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
  );
}
