export default function Loading() {
  return (
    <div className="bg-white dark:bg-background min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-(--header-h) pb-16">
        <div className="flex flex-col md:flex-row gap-12">
          {/* Sidebar Skeleton */}
          <div className="w-full md:w-64 flex-shrink-0 animate-pulse">
            <div className="h-8 w-32 bg-slate-100 rounded-lg mb-6" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-50 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Grid Skeleton */}
          <div className="flex-1 animate-pulse">
            <div className="h-10 w-64 bg-slate-100 rounded-lg mb-10" />
            <div className="grid grid-cols-1 gap-y-10 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex flex-col gap-4">
                  <div className="aspect-square bg-slate-50 rounded-2xl" />
                  <div className="h-4 w-3/4 bg-slate-50 rounded" />
                  <div className="h-4 w-1/4 bg-slate-50 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
