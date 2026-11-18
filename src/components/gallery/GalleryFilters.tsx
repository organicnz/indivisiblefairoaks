import { Filter, Search, X } from 'lucide-react';
import type { GalleryPhoto } from '@/lib/queries/content-client';

type GalleryFiltersProps = {
  photos: GalleryPhoto[];
  categories: string[];
  selectedCategory: string;
  searchQuery: string;
  filteredCount: number;
  isLoading: boolean;
  onCategoryChange: (category: string) => void;
  onSearchChange: (query: string) => void;
};

export function GalleryFilters({
  photos,
  categories,
  selectedCategory,
  searchQuery,
  filteredCount,
  isLoading,
  onCategoryChange,
  onSearchChange,
}: GalleryFiltersProps) {
  return (
    <>
      <section className="border-b border-border bg-surface-muted/60">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-y border-foreground/15 py-4">
            <p className="font-display text-2xl font-semibold text-foreground">
              {photos.length} photograph{photos.length === 1 ? '' : 's'}{' '}
              <span className="font-sans text-xs font-medium tracking-normal text-muted-foreground">
                across {categories.length - 1} collection{categories.length - 1 === 1 ? '' : 's'}
              </span>
            </p>
            <p className="civic-meta text-muted-foreground">
              <span className="text-accent">100% grassroots</span>
              <span aria-hidden="true" className="px-1.5">
                /
              </span>{' '}
              0 politicians
            </p>
          </div>

          <div className="mt-6 w-full max-w-2xl space-y-4">
            <div className="relative">
              <Search
                size={18}
                aria-hidden="true"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                aria-label="Search gallery"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search by quote, slogan, location (e.g. 'IKEA', 'Tower Bridge', 'Brake Light')..."
                className="w-full rounded-sm border border-border bg-surface-card py-3 pl-12 pr-10 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div
              role="group"
              aria-label="Filter photographs by collection"
              className="flex flex-wrap items-center justify-start gap-2"
            >
              <Filter
                size={15}
                className="mr-1 hidden text-muted-foreground sm:inline-block"
              />
              {categories.map((category) => {
                const count =
                  category === 'All'
                    ? photos.length
                    : photos.filter((photo) => photo.category === category).length;
                const isSelected = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onCategoryChange(category)}
                    className={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm px-3.5 text-xs font-semibold transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-sm ${
                      isSelected
                        ? 'bg-primary text-white'
                        : 'border border-border bg-surface-card/90 text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                    }`}
                  >
                    <span>{category}</span>
                    <span
                      className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${
                        isSelected
                          ? 'bg-primary-dark text-white'
                          : 'bg-surface-muted text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <p role="status" aria-live="polite" className="sr-only">
        {isLoading
          ? 'Loading gallery'
          : `${filteredCount} photo${filteredCount === 1 ? '' : 's'} shown`}
      </p>
    </>
  );
}
