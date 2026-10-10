'use client';

import { AlertCircle, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { removeProductImage, uploadProductImage } from '@/app/admin/actions';

export function ProductImageUpload({
  productId,
  currentImageUrl,
}: {
  productId: number;
  currentImageUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();
  const [isRemoving, startRemove] = useTransition();

  const onFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('File must be an image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5MB or smaller');
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.append('productId', String(productId));
    formData.append('file', file);
    startUpload(async () => {
      try {
        await uploadProductImage(formData);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      }
    });
  };

  const remove = () => {
    setError(null);
    startRemove(async () => {
      try {
        await removeProductImage(productId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Remove failed');
      }
    });
  };

  return (
    <div className="space-y-3">
      {currentImageUrl && (
        <div className="relative">
          <Image
            src={currentImageUrl}
            alt="Current product image"
            width={200}
            height={200}
            className="w-full aspect-square object-cover rounded-2xl bg-surface-muted"
          />
          <button
            type="button"
            onClick={remove}
            disabled={isRemoving || isUploading}
            className="absolute top-2 right-2 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-rose-600 text-white rounded-full px-2.5 py-1.5 hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {isRemoving ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
            Remove
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading || isRemoving}
        className="w-full inline-flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-border text-muted-foreground rounded-2xl px-4 py-4 hover:border-primary hover:text-foreground transition-colors disabled:opacity-50"
      >
        {isUploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
        {isUploading ? 'Uploading…' : currentImageUrl ? 'Replace image' : 'Upload image'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      {error && (
        <div role="alert" className="flex items-start gap-2 text-xs font-bold text-rose-600">
          <AlertCircle size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
        <Upload size={9} /> JPEG, PNG or WebP up to 5MB
      </p>
    </div>
  );
}
