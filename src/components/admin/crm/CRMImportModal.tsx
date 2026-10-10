'use client';

import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { importCRMContacts } from '@/lib/actions/crm';
import { parseCsv } from '@/lib/crm-import';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE = `email,first_name,last_name,phone,city,zip_code,district,status,tags,notes
jane.doe@example.com,Jane,Doe,(916) 555-0100,Fair Oaks,95628,CA-06,supporter,postcards;choir,Met at farmers market
john.roe@example.com,John,Roe,,Carmichael,95608,CA-06,active_volunteer,canvassing,Knock-door lead`;

export function CRMImportModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  // The last attempt's outcome, rendered in place. Success used to close the
  // modal on the spot, which discarded the file and the one thing the author
  // actually needed from a partial import: *which* rows were skipped.
  const [lastResult, setLastResult] = useState<Awaited<
    ReturnType<typeof importCRMContacts>
  > | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 500_000) {
      toast.error('File too large (max 500KB)');
      return;
    }
    const text = await file.text();
    setCsvText(text);
    setFileName(file.name);
  };

  const handleImport = async () => {
    if (!csvText.trim()) {
      toast.error('Paste CSV or choose a file first');
      return;
    }
    setImporting(true);
    try {
      const res = await importCRMContacts({ csv: csvText });
      setLastResult(res);
      if (!res.success) {
        toast.error(res.error || 'Import failed');
      } else {
        const invalid = res.invalidRows ?? 0;
        toast.success(
          invalid > 0
            ? `Imported ${res.imported ?? 0}, skipped ${res.skipped ?? 0} existing, ${invalid} row(s) had problems`
            : `Imported ${res.imported ?? 0}, skipped ${res.skipped ?? 0} existing`
        );
        router.refresh();
      }
    } catch {
      toast.error('Import failed — nothing was written');
    } finally {
      setImporting(false);
    }
  };

  const outcomeRows = () => {
    const rows: { tone: 'bad' | 'warn' | 'ok'; text: string }[] = [];
    if (!lastResult) return rows;
    if (lastResult.imported) rows.push({ tone: 'ok', text: `${lastResult.imported} imported` });
    if (lastResult.skipped)
      rows.push({ tone: 'warn', text: `${lastResult.skipped} already in the directory, skipped` });
    if (lastResult.invalidRows)
      rows.push({
        tone: 'bad',
        text: `${lastResult.invalidRows} row(s) could not be imported — see the reasons below`,
      });
    if (lastResult.errors) {
      for (const e of lastResult.errors.slice(0, 10)) {
        rows.push({ tone: 'bad', text: e.line > 0 ? `Line ${e.line}: ${e.message}` : e.message });
      }
      if (lastResult.errors.length > 10) {
        rows.push({
          tone: 'warn',
          text: `…and ${lastResult.errors.length - 10} more. The action reports at most 50; fix the file and re-import to resolve them.`,
        });
      }
    }
    if (lastResult.error) rows.push({ tone: 'bad', text: lastResult.error });
    return rows;
  };

  // Data rows in the current input, header excluded, counted by the CSV parser
  // rather than by splitting on '\n' — a quoted field may contain a newline,
  // and the naive split then over-counts the >100 confirm gate. A bulk import
  // is the one directory mutation with no undo — every other destructive
  // action in the CRM confirms first — so pasting more than a hundred rows
  // gets a confirm step that names the number about to be written.
  const pendingRowCount = useMemo(() => {
    if (!csvText.trim()) return 0;
    return Math.max(0, parseCsv(csvText).length - 1);
  }, [csvText]);

  const importButton = (
    <button
      type="button"
      onClick={handleImport}
      disabled={importing || !csvText.trim()}
      className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-widest rounded-xl shadow-md transition-colors disabled:opacity-50"
    >
      <Upload size={14} />
      {importing ? 'Importing...' : 'Import Contacts'}
    </button>
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary dark:text-primary-on-dark">
            Constituent Directory
          </span>
          <DialogTitle id="import-modal-title">Import CSV</DialogTitle>
          <DialogDescription>
            Upload or paste a CSV of constituents. Existing emails are skipped, never overwritten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Required column:{' '}
            <code className="text-primary dark:text-primary-on-dark font-bold">email</code>.
            Optional: first_name, last_name, phone, address, city, zip_code, district, status, tags
            (semicolon separated), notes, do_not_email (yes/no). Existing emails are skipped, never
            overwritten. Restore imports preserve each contact&apos;s opted-out flag. Limits: 500
            KB, 2000 rows.
          </p>

          <div>
            <label
              htmlFor="csv-file"
              className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
            >
              Upload file
            </label>
            <input
              id="csv-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-surface-muted file:text-slate-700 file:text-xs file:font-bold hover:file:bg-surface-muted"
            />
            {fileName && (
              <p className="text-[11px] text-muted-foreground mt-1 font-mono">{fileName}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="csv-paste"
              className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
            >
              Or paste CSV
            </label>
            <textarea
              id="csv-paste"
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={SAMPLE}
              className="w-full px-4 py-3 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-xs font-mono leading-relaxed"
            />
          </div>

          {lastResult && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border border-border bg-surface-muted p-4 space-y-1"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Result
              </p>
              <ul className="text-xs leading-relaxed">
                {outcomeRows().map((row) => (
                  <li
                    key={`${row.tone}:${row.text}`}
                    className={
                      row.tone === 'bad'
                        ? 'text-red-700'
                        : row.tone === 'warn'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                    }
                  >
                    {row.text}
                  </li>
                ))}
              </ul>
              {lastResult.success && (
                <p className="text-[11px] text-muted-foreground">
                  The CSV is still in the box above — fix any bad rows in it and import again to
                  pick up the remainder.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-slate-800 transition-colors"
            >
              {lastResult ? 'Done' : 'Cancel'}
            </button>
            {pendingRowCount > 100 ? (
              <ConfirmAction
                label="Import contacts"
                message={`This will add up to ${pendingRowCount} contacts to the directory in one batch. Existing emails are skipped, but there is no undo for the rest.`}
                confirmLabel="Import"
                busy={importing}
                idleClassName="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-widest rounded-xl shadow-md transition-colors disabled:opacity-50"
                onConfirm={handleImport}
              >
                <Upload size={14} />
                {importing ? 'Importing...' : 'Import Contacts'}
              </ConfirmAction>
            ) : (
              importButton
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
