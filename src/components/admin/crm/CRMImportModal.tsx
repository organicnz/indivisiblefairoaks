'use client';

import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { importCRMContacts } from '@/lib/actions/crm';

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
      if (!res.success) {
        toast.error(res.error || 'Import failed');
        if (res.errors?.length) {
          toast.error(res.errors[0].message);
        }
      } else {
        toast.success(`Imported ${res.imported ?? 0}, skipped ${res.skipped ?? 0}`);
        if (res.errors?.length) {
          toast.warning(`${res.errors.length} row warning(s) — first: ${res.errors[0].message}`);
        }
        router.refresh();
        onClose();
      }
    } catch {
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
            Constituent Directory
          </span>
          <DialogTitle id="import-modal-title">Import CSV</DialogTitle>
          <DialogDescription>
            Upload or paste a CSV of constituents. Existing emails are skipped, never overwritten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Required column: <code className="text-primary font-bold">email</code>. Optional:{' '}
            first_name, last_name, phone, city, zip_code, district, status, tags (semicolon
            separated), notes. Existing emails are skipped, never overwritten.
          </p>

          <div>
            <label
              htmlFor="csv-file"
              className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
            >
              Upload file
            </label>
            <input
              id="csv-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="block w-full text-xs text-slate-500 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-slate-100 file:text-slate-700 file:text-xs file:font-bold hover:file:bg-slate-200"
            />
            {fileName && <p className="text-[11px] text-slate-400 mt-1 font-mono">{fileName}</p>}
          </div>

          <div>
            <label
              htmlFor="csv-paste"
              className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
            >
              Or paste CSV
            </label>
            <textarea
              id="csv-paste"
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={SAMPLE}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-xs font-mono leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !csvText.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-widest rounded-xl shadow-md transition-colors disabled:opacity-50"
            >
              <Upload size={14} />
              {importing ? 'Importing...' : 'Import Contacts'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
