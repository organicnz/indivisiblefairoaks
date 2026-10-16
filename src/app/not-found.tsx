'use client';

import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { NOT_FOUND_ROUTES } from '@/config/routes';
import { useDataPoints } from '@/hooks/useDataPoints';

export default function NotFound() {
  const { dataPoints } = useDataPoints('notfound');

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 pt-(--header-h) pb-24 text-center bg-background text-foreground">
      <div className="max-w-xl">
        <DataPoint
          as="p"
          name="notfound.badge"
          initialData={dataPoints}
          className="text-xs font-black text-primary-ink uppercase tracking-[0.2em] mb-4"
        >
          Error 404
        </DataPoint>
        {/* h1, not h2: this is the page's top-level heading. */}
        <DataPoint
          as="h1"
          name="notfound.title"
          initialData={dataPoints}
          className="text-4xl md:text-5xl font-black text-secondary uppercase tracking-tighter leading-tight mb-6"
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
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-primary text-white font-black uppercase tracking-[0.2em] text-xs hover:bg-primary-light active:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-300 ease-out"
          >
            <DataPoint as="span" name="notfound.btn.home" initialData={dataPoints}>
              Go to homepage
            </DataPoint>
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-surface-card border border-border text-foreground font-black uppercase tracking-[0.2em] text-xs hover:border-primary hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-300 ease-out"
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
            className="text-xs font-black text-secondary uppercase tracking-[0.2em] mb-4"
          >
            Popular pages
          </DataPoint>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
            {NOT_FOUND_ROUTES.map((route) => (
              <li key={route.href}>
                <Link
                  href={route.href}
                  className="text-sm font-medium text-primary-ink underline underline-offset-4 decoration-border hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm transition-colors duration-300 ease-out"
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
