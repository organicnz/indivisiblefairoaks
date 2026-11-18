import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { POPULAR_LINKS } from './search-data';

export function PopularLinks({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      {POPULAR_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="civic-link-arrow">
          {link.label}
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
