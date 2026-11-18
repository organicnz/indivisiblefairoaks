import { DataPoint } from '@/components/ui/DataPoint';

type ContentPageHeaderProps = {
  title: string;
  type: string | null;
  createdAt: string | null;
  dataPoints: Record<string, string>;
};

export function ContentPageHeader({
  title,
  type,
  createdAt,
  dataPoints,
}: ContentPageHeaderProps) {
  return (
    <div className="flex flex-col mb-12">
      <h1 className="mb-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-foreground md:text-5xl">
        {title}
      </h1>
      <div className="h-2 w-24 bg-primary dark:bg-primary-bright" />
      {type === 'post' && createdAt && (
        <time dateTime={createdAt} className="civic-meta mt-6">
          <DataPoint as="span" name="content.published_prefix" initialData={dataPoints}>
            Published
          </DataPoint>{' '}
          {new Date(createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
      )}
    </div>
  );
}
