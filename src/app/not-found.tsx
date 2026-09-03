import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <h2 className="text-4xl font-extrabold text-slate-900 mb-4">404 - Page Not Found</h2>
      <p className="text-lg text-slate-600 mb-8 max-w-md">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or
        deleted during our site migration.
      </p>
      <Link
        href="/"
        className="inline-block py-3 px-6 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
      >
        Go Back Home
      </Link>
    </div>
  );
}
