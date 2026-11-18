'use client';

import { FolderOpen, Image as ImageIcon, UploadCloud } from 'lucide-react';

interface CRMContactMediaTabProps {
  setIsMediaModalOpen: (open: boolean) => void;
}

export function CRMContactMediaTab({
  setIsMediaModalOpen,
}: CRMContactMediaTabProps) {
  return (
      <div className="bg-surface-card rounded-2xl border border-border shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-on-dark">
              Supabase S3 Assets
            </span>
            <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
              Constituent media &amp; documents
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Browse and attach assets hosted in your Supabase S3 bucket for this profile.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsMediaModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-widest rounded-xl transition-colors shadow-xs"
          >
            <FolderOpen size={14} /> Open Storage Library
          </button>
        </div>

        <div className="p-8 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 rounded-full bg-blue-50 text-primary dark:text-primary-on-dark">
            <ImageIcon className="h-8 w-8" />
          </div>
          <div className="max-w-md">
            <h3 className="text-sm font-bold text-foreground">Manage Supabase media assets</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Upload photos from rallies, volunteer sign-up sheets, or documents directly to your
              Supabase S3 storage bucket.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsMediaModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary text-white hover:bg-secondary/90 text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            <UploadCloud size={14} /> Browse & Upload Files
          </button>
        </div>
      </div>
  );
}
