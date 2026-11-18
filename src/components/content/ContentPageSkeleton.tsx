export function ContentPageSkeleton() {
  return (
    <div className="bg-background min-h-screen pt-(--header-clearance) pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="flex flex-col mb-12">
          <div className="h-12 w-3/4 bg-surface-muted rounded" />
          <div className="h-2 w-24 bg-surface-muted mt-4" />
        </div>
        <div className="space-y-4">
          {['95%', '88%', '81%', '74%', '67%', '60%', '53%', '40%'].map((width) => (
            <div key={width} className="h-4 bg-surface-muted rounded" style={{ width }} />
          ))}
        </div>
      </div>
    </div>
  );
}
