'use client';

import { Heart, Menu, Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CivicCommandPalette } from '@/components/ui/CivicCommandPalette';

const NAV_LINKS = [
  { name: 'Home', href: '/' },
  { name: 'About', href: '/about' },
  { name: 'Events & Actions', href: '/events' },
  { name: 'Resistance Choir', href: '/choir' },
  { name: 'Voter Info', href: '/voter-info' },
  { name: 'Gallery', href: '/gallery' },
  { name: 'News', href: '/news' },
  { name: 'Coalition', href: '/links' },
  { name: 'Contact', href: '/contact' },
];

export function Header() {
  return (
    <Suspense fallback={<HeaderFallback />}>
      <HeaderInner />
    </Suspense>
  );
}

function HeaderFallback() {
  return (
    <header className="bg-slate-900 py-4 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 shrink-0">
            <Image
              src="/images/logo/indivisible-emblem.png"
              alt="Indivisible Fair Oaks & Carmichael"
              width={40}
              height={40}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div>
            <span className="text-white font-black text-lg tracking-tight uppercase block">
              Indivisible
            </span>
            <span className="text-blue-300 text-xs font-semibold tracking-wider uppercase block">
              Fair Oaks & Carmichael
            </span>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <span
              key={link.name}
              className="text-xs font-bold uppercase tracking-wider text-white/70"
            >
              {link.name}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

function HeaderInner() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-slate-950/95 backdrop-blur-md py-3 shadow-xl border-b border-white/10'
          : 'bg-slate-900/90 backdrop-blur-sm py-4 border-b border-white/10'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo / Chapter Identity */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 shrink-0 group-hover:scale-105 transition-transform">
              <Image
                src="/images/logo/indivisible-emblem.png"
                alt="Indivisible Fair Oaks & Carmichael"
                width={40}
                height={40}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div>
              <span className="text-white font-black text-base sm:text-lg tracking-tight uppercase group-hover:text-blue-400 transition-colors block leading-tight">
                Indivisible
              </span>
              <span className="text-blue-300 text-[11px] sm:text-xs font-semibold tracking-wider uppercase block leading-tight">
                Fair Oaks & Carmichael
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`text-xs font-bold uppercase tracking-wider transition-all relative py-1 ${
                    isActive ? 'text-amber-400 font-extrabold' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  {link.name}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <CivicCommandPalette isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} />

            <Link
              href="/donate"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg hover:scale-105 transition-all"
            >
              <Heart size={14} className="fill-slate-950" />
              <span>Donate</span>
            </Link>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isMenuOpen}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-0 z-[100] bg-slate-950/98 flex flex-col p-6 sm:p-8 lg:hidden transition-transform duration-300 ease-in-out ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3">
            <div className="relative w-10 h-10 shrink-0">
              <Image
                src="/images/logo/indivisible-emblem.png"
                alt="Indivisible Fair Oaks & Carmichael"
                width={40}
                height={40}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-white font-black text-base uppercase block leading-tight">
                Indivisible
              </span>
              <span className="text-blue-300 text-xs font-semibold uppercase block leading-tight">
                Fair Oaks & Carmichael
              </span>
            </div>
          </Link>
          <button
            type="button"
            className="p-2 text-slate-300 hover:text-white transition-colors"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={28} />
          </button>
        </div>

        <nav className="flex flex-col gap-4 py-8 overflow-y-auto">
          {/* Search shortcut in mobile drawer */}
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              setIsSearchOpen(true);
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-slate-300 hover:text-white transition-colors text-sm font-medium"
          >
            <Search size={18} className="text-blue-400" />
            <span>Quick Search…</span>
            <kbd className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-400">
              ⌘K
            </kbd>
          </button>

          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={`text-xl font-bold uppercase tracking-wide transition-colors py-1 ${
                  isActive ? 'text-amber-400' : 'text-slate-200 hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10 flex flex-col gap-4">
          <Link
            href="/donate"
            onClick={() => setIsMenuOpen(false)}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-center text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
          >
            <Heart size={16} className="fill-slate-950" />
            Support via ActBlue
          </Link>
          <div className="text-xs text-slate-400 text-center space-y-1">
            <p>
              Inquiries:{' '}
              <a
                href="mailto:contact@indivisiblefairoaks.org"
                className="text-blue-400 hover:underline"
              >
                contact@indivisiblefairoaks.org
              </a>
            </p>
            <p className="text-[11px] text-slate-400">
              Grassroots community organizing for democracy.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
