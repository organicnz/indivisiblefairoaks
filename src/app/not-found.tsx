import Link from 'next/link';
import { NOT_FOUND_ROUTES } from '@/config/routes';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 pt-(--header-h) pb-24 text-center bg-white">
      <div className="max-w-xl">
        <p className="text-xs font-black text-primary-ink uppercase tracking-[0.2em] mb-4">
          Error 404
        </p>
        {/* h1, not h2: this is the page's top-level heading. */}
        <h1 className="text-4xl md:text-5xl font-black text-secondary uppercase tracking-tighter leading-tight mb-6">
          This page isn&apos;t here
        </h1>
        <p className="text-base font-medium text-slate-600 leading-relaxed mb-10">
          The address may be mistyped, or the page may have moved when the site moved off our old
          platform. The links below cover most of what people are looking for.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-primary text-white font-black uppercase tracking-[0.2em] text-xs hover:bg-primary-light active:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-300 ease-out"
          >
            Go to homepage
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white border border-slate-200 text-secondary font-black uppercase tracking-[0.2em] text-xs hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-300 ease-out"
          >
            Contact us
          </Link>
        </div>

        <nav aria-label="Popular pages" className="border-t border-slate-100 pt-8">
          <h2 className="text-xs font-black text-secondary uppercase tracking-[0.2em] mb-4">
            Popular pages
          </h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
            {NOT_FOUND_ROUTES.map((route) => (
              <li key={route.href}>
                <Link
                  href={route.href}
                  className="text-sm font-medium text-primary-ink underline underline-offset-4 decoration-slate-300 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm transition-colors duration-300 ease-out"
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
