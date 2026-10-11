'use client';

import {
  Check,
  Copy,
  Folder,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  deleteCRMMedia,
  getCRMMediaFiles,
  type MediaItem,
  uploadCRMMedia,
} from '@/lib/actions/crm';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (media: {
    url: string;
    alt?: string;
    name: string;
    width?: number | null;
    height?: number | null;
  }) => void;
  initialFolder?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export function CRMMediaLibraryModal({
  isOpen,
  onClose,
  onSelectMedia,
  initialFolder = 'crm',
}: Props) {
  const [folder, setFolder] = useState<string>(initialFolder);
  const [search, setSearch] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadMedia = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getCRMMediaFiles({ folder, search });
      setMediaItems(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load media files');
    } finally {
      setIsLoading(false);
    }
  }, [folder, search]);

  useEffect(() => {
    if (isOpen) {
      loadMedia();
    }
  }, [isOpen, loadMedia]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or smaller');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const res = await uploadCRMMedia(formData);
      if (res.success && res.data) {
        toast.success(`Uploaded ${res.data.name} to Supabase S3 storage`);
        await loadMedia();
        // Automatically select the freshly uploaded asset
        onSelectMedia({
          url: res.data.url,
          name: res.data.name,
          alt: res.data.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
          width: res.data.width,
          height: res.data.height,
        });
        onClose();
      } else {
        toast.error(res.error || 'Failed to upload media');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      // reset file input
      e.target.value = '';
    }
  };

  const handleDelete = async (path: string) => {
    startTransition(async () => {
      try {
        const res = await deleteCRMMedia(path);
        if (res.success) {
          toast.success('Media removed from storage');
          setMediaItems((prev) => prev.filter((m) => m.path !== path));
        } else {
          toast.error(res.error || 'Failed to delete');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Deletion failed');
      }
    });
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success('Public URL copied to clipboard');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 sm:p-8 overflow-hidden rounded-[2rem]">
        <DialogHeader className="pb-3 border-b border-border flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-primary dark:text-primary-on-dark">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-foreground">
                Supabase S3 Media Library
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-medium">
                Browse, upload, and select assets stored in your Supabase S3 bucket.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Action Bar */}
        <div className="py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border">
          {/* Folder tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-muted overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => setFolder('crm')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                folder === 'crm'
                  ? 'bg-surface-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Folder size={14} className="text-primary dark:text-primary-on-dark" />
              <span>CRM & Broadcasts</span>
            </button>
            <button
              type="button"
              onClick={() => setFolder('content')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                folder === 'content'
                  ? 'bg-surface-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Folder size={14} className="text-amber-500" />
              <span>Site & Content</span>
            </button>
            <button
              type="button"
              onClick={() => setFolder('products')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                folder === 'products'
                  ? 'bg-surface-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Folder size={14} className="text-emerald-500" />
              <span>Storefront</span>
            </button>
            <button
              type="button"
              onClick={() => setFolder('all')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                folder === 'all'
                  ? 'bg-surface-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>All Assets</span>
            </button>
          </div>

          {/* Search + Upload */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Filter files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border text-xs text-slate-800 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <button
              type="button"
              onClick={() => loadMedia()}
              title="Refresh Media"
              className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>

            <label className="cursor-pointer px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs shrink-0">
              {isUploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={14} />
                  <span>Upload</span>
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Media Grid View */}
        <div className="flex-1 overflow-y-auto py-4 min-h-[320px] max-h-[500px]">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary dark:text-primary-on-dark" />
              <p className="text-xs font-bold uppercase tracking-wider">
                Loading assets from Supabase S3...
              </p>
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="h-64 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="p-3 rounded-full bg-surface-muted text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">No media assets found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search
                    ? `No matches for "${search}" in folder "${folder}".`
                    : `Folder "${folder}" is currently empty. Upload your first campaign image above!`}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {mediaItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-2xl border border-border bg-surface-card overflow-hidden hover:shadow-md hover:border-primary/50 transition-all flex flex-col"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-surface-muted overflow-hidden flex items-center justify-center">
                    {/* biome-ignore lint/performance/noImgElement: user-supplied media preview in admin storage picker */}
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-secondary/80 text-[9px] font-mono font-bold text-white uppercase tracking-wider backdrop-blur-xs">
                      {item.folder}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800 truncate" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatBytes(item.size)} ·{' '}
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-border flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMedia({
                            url: item.url,
                            name: item.name,
                            alt: item.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
                          });
                          onClose();
                        }}
                        className="flex-1 py-1 px-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-[11px] font-black uppercase tracking-wider transition-colors text-center"
                      >
                        Select
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item.url)}
                        title="Copy Public URL"
                        className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-slate-800 hover:bg-surface-muted transition-colors"
                      >
                        {copiedUrl === item.url ? (
                          <Check size={13} className="text-emerald-600" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>

                      {item.folder === 'crm' && (
                        <ConfirmAction
                          label="Delete Asset"
                          message={`Permanently remove "${item.name}" from Supabase S3 storage?`}
                          confirmLabel="Delete Asset"
                          onConfirm={() => handleDelete(item.path)}
                          disabled={isPending}
                          busy={isPending}
                          danger
                          idleClassName="p-1.5 rounded-lg border border-rose-100 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                        >
                          <Trash2 size={13} />
                        </ConfirmAction>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
