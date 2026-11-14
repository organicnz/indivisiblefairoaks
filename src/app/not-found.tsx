'use client';

import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { NOT_FOUND_ROUTES } from '@/config/routes';
import { useDataPoints } from '@/hooks/useDataPoints';

export default function NotFound() {
  const { dataPoints } = useDataPoints('notfound');

  return (
    <div className="civic-page relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden bg-background px-4 pb-24 pt-(--header-h) text-center text-foreground">
      <div className="relative z-10 max-w-xl">
        <DataPoint
          as="p"
          name="notfound.badge"
          initialData={dataPoints}
          className="civic-kicker mb-4"
        >
          Error 404
        </DataPoint>
        {/* h1, not h2: this is the page's top-level heading. */}
        <DataPoint
          as="h1"
          name="notfound.title"
          initialData={dataPoints}
          className="mb-6 font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-6xl"
        >
          This page isn&apos;t here
        </DataPoint>
        <DataPoint
          as="p"
          name="notfound.description"
          initialData={dataPoints}
          className="text-base font-medium text-muted-foreground leading-relaxed mb-10"
        >
          The address may be mistyped, or the page may have moved when the site moved off our old
          platform. The links below cover most of what people are looking for.
        </DataPoint>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center border border-primary bg-primary px-6 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <DataPoint as="span" name="notfound.btn.home" initialData={dataPoints}>
              Go to homepage
            </DataPoint>
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center border border-foreground/30 bg-surface-card px-6 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <DataPoint as="span" name="notfound.btn.contact" initialData={dataPoints}>
              Contact us
            </DataPoint>
          </Link>
        </div>

        <nav aria-label="Popular pages" className="border-t border-border pt-8">
          <DataPoint
            as="h2"
            name="notfound.popular.title"
            initialData={dataPoints}
            className="civic-kicker mb-4"
          >
            Popular pages
          </DataPoint>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
            {NOT_FOUND_ROUTES.map((route) => (
              <li key={route.href}>
                <Link
                  href={route.href}
                  className="text-sm font-medium text-primary-ink dark:text-primary-on-dark underline underline-offset-4 decoration-border hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm transition-colors duration-300 ease-out"
                >
                  {route.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
