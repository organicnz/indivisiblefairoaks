import { Globe, Radio } from 'lucide-react';
import type { FormEvent } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';

type ChoirCustomStreamFormProps = {
  dataPoints: Record<string, string>;
  title: string;
  url: string;
  onTitleChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ChoirCustomStreamForm({
  dataPoints,
  title,
  url,
  onTitleChange,
  onUrlChange,
  onSubmit,
}: ChoirCustomStreamFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 p-4 rounded-2xl bg-surface-card border border-primary/30 dark:bg-secondary/80 dark:border-primary-bright/30 space-y-3 animate-in fade-in-0 duration-200"
    >
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-ink dark:text-primary-on-dark">
        <Globe size={14} className="text-accent-gold" />
        <DataPoint as="span" name="choir.player.custom_stream_label" initialData={dataPoints}>
          Custom Audio Stream / Song URL from Anywhere
        </DataPoint>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <input
          type="text"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={
            dataPoints['choir.player.custom_title_placeholder'] || 'Stream Title (optional)'
          }
          className="px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground placeholder:text-muted-foreground dark:bg-black/40 dark:border-white/15 dark:text-white dark:placeholder-white/40 text-xs focus:outline-none focus:border-primary dark:focus:border-primary-bright"
        />
        <input
          type="text"
          required
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder={
            dataPoints['choir.player.custom_stream_placeholder'] ||
            'Stream URL (https://...), Supabase S3 path (audio/song.mp3), or s3://...'
          }
          className="sm:col-span-2 px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground placeholder:text-muted-foreground dark:bg-black/40 dark:border-white/15 dark:text-white dark:placeholder-white/40 text-xs focus:outline-none focus:border-primary dark:focus:border-primary-bright"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark dark:bg-primary-bright dark:hover:bg-primary-bright text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-colors flex items-center gap-1.5"
        >
          <Radio size={13} />
          <DataPoint as="span" name="choir.player.custom_stream_btn" initialData={dataPoints}>
            Tune In
          </DataPoint>
        </button>
      </div>
    </form>
  );
}
