'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, Heart, Menu, Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AccountButton } from '@/components/layout/AccountButton';
import { EditorialButton, EditorialDrawerRow } from '@/components/layout/EditorialButton';
import { NavDropdown } from '@/components/layout/NavDropdown';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { CivicCommandPalette } from '@/components/ui/CivicCommandPalette';
import { isActiveRoute, ROUTES } from '@/config/routes';
import { SITE_CONTACT } from '@/config/site';

const DRAWER_ID = 'primary-navigation-drawer';

// Focus ring, used on every interactive control in the header. The header had no
// focus styling at all: keyboard focus on primary navigation was completely
// invisible, which fails WCAG 2.4.7.
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary';

export function Header() {
  return (
    <Suspense fallback={<HeaderFallback />}>
      <HeaderInner />
    </Suspense>
  );
}

/**
 * Rendered while the client component hydrates.
 *
 * A plain `<div>`, not a `<header>`: the real header owns the `banner` landmark,
 * and two of them in the tree means assistive tech announces the site header
 * twice. The nav items are inert spans for the same reason — a Suspense fallback
 * full of focusable links would add a second, non-functional set of tab stops
 * for the frame or two it is on screen.
 */
function HeaderFallback() {
  return (
    <div className="bg-secondary py-4 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 shrink-0">
            <Image
              src="/images/logo/indivisible-emblem.png"
              alt=""
              width={40}
              height={40}
              className="w-full h-full object-contain"
              priority
              unoptimized
            />
          </div>
          <div>
            <span className="text-white font-black text-lg tracking-tight uppercase block">
              Indivisible
            </span>
            <span className="text-ink-muted-on-dark text-xs font-semibold tracking-wider uppercase block">
              Fair Oaks &amp; Carmichael
            </span>
          </div>
        </div>
        <div className="hidden 2xl:flex items-center gap-5">
          {ROUTES.map((link) => (
            <span
              key={link.href}
              className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.2em] text-white/70"
            >
              {link.short ?? link.label}
            </span>
          ))}
        </div>
      </div>
    </div>
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
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // A route change must never leave the drawer open over the new page. The
  // per-link `onClick` handlers cover ordinary navigation; this covers browser
  // back/forward and programmatic redirects, which bypass them.
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current !== pathname) {
      lastPathname.current = pathname;
      setIsMenuOpen(false);
    }
  }, [pathname]);

  // The drawer must hand focus back to the control that opened it; see
  // `onCloseAutoFocus` on Dialog.Content for why Radix does not do it alone.
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      {/* NOTE: the drawer must stay a sibling of <header>, not a child — the
          header's backdrop-blur creates a containing block that would trap the
          drawer's `fixed inset-0` at header height. */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${
          isScrolled
            ? 'site-header-padding-compact bg-secondary/95 backdrop-blur-md shadow-header border-b border-white/10'
            : 'site-header-padding bg-secondary/90 backdrop-blur-sm border-b border-white/10'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <Link href="/" className={`flex items-center gap-3 group rounded-sm ${FOCUS_RING}`}>
              <div className="relative w-10 h-10 shrink-0 group-hover:scale-105 transition-transform duration-300 ease-out motion-reduce:group-hover:scale-100">
                <Image
                  src="/images/logo/indivisible-emblem.png"
                  alt="Indivisible Fair Oaks &amp; Carmichael"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain"
                  priority
                  unoptimized
                />
              </div>
              <div>
                <span className="text-white font-black text-base sm:text-lg tracking-tight uppercase group-hover:text-white transition-colors duration-300 ease-out block leading-tight">
                  Indivisible
                </span>
                <span className="text-ink-muted-on-dark text-[11px] sm:text-xs font-semibold tracking-wider uppercase block leading-tight">
                  Fair Oaks &amp; Carmichael
                </span>
              </div>
            </Link>

            {/*
              Desktop navigation.

              The full nine-link row only fits at 2xl. At 1280px the labels at
              `tracking-[0.2em]` (the AGENTS.md nav rule) need ~1365px once the
              logo and action cluster are laid out, so showing the row at xl pushed
              the account control off-screen. Between sm and 2xl the drawer serves
              the links and the account control stays inline from xl up.
            */}
            <nav aria-label="Primary" className="hidden 2xl:flex items-center gap-5">
              {ROUTES.map((link) => {
                const isActive = isActiveRoute(pathname, link);
                // Links with children render as a dropdown trigger; the row keeps
                // one item per route so the 2xl width budget is unchanged.
                if (link.children) {
                  return <NavDropdown key={link.href} link={link} isActive={isActive} />;
                }
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    // `aria-current` is what conveys the active page to assistive
                    // tech; the amber text and underline bar are decoration.
                    aria-current={isActive ? 'page' : undefined}
                    className={`whitespace-nowrap text-xs font-bold uppercase tracking-[0.2em] transition-colors duration-300 ease-out relative py-1 rounded-sm ${FOCUS_RING} ${
                      isActive
                        ? 'text-accent-gold font-extrabold'
                        : 'text-ink-on-dark hover:text-white'
                    }`}
                  >
                    {link.short ?? link.label}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-gold rounded-full"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <CivicCommandPalette isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} />

              <ThemeToggle />
              <EditorialButton />
              <Link
                href="/donate"
                className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent hover:bg-accent-gold text-secondary font-bold text-xs uppercase tracking-wider shadow-raised hover:shadow-float active:scale-95 transition-all duration-300 ease-out motion-reduce:hover:scale-100 ${FOCUS_RING}`}
              >
                <Heart size={14} className="fill-secondary" aria-hidden="true" />
                <span>Donate</span>
              </Link>

              <div className="hidden xl:block">
                <AccountButton />
              </div>

              <button
                type="button"
                ref={menuButtonRef}
                // 44px minimum target: p-2 + a 24px glyph is only 40px.
                className={`2xl:hidden inline-flex items-center justify-center size-11 rounded-lg text-ink-on-dark hover:text-white hover:bg-white/10 transition-colors duration-300 ease-out ${FOCUS_RING}`}
                onClick={() => setIsMenuOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={isMenuOpen}
                aria-controls={DRAWER_ID}
              >
                <Menu size={24} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/*
        The drawer was a bare <div> translated off-screen with
        `-translate-x-full`. Nothing removed it from the accessibility tree or the
        tab order, so on every mobile page load roughly thirteen off-screen links
        and buttons sat between the header and the page content in the tab
        sequence. It also had no Escape handling, no focus trap, and no scroll
        lock.

        Radix Dialog supplies all of that: `aria-modal`, focus containment, Escape
        to dismiss, scroll locking, and `inert` on everything behind it. It is
        already a dependency.

        Focus restoration is the one it does NOT supply here, despite appearing
        to: this list once claimed it did, and that claim was never tested. The
        drawer is portalled and the hamburger is not, so Radix restores onto a
        node the modal has only just un-hidden and focus falls through to
        `<body>`. See `onCloseAutoFocus` below, and
        `e2e/mobile-navigation.spec.ts`, which now fails if this regresses.
      */}
      <Dialog.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-secondary/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 2xl:hidden" />
          <Dialog.Content
            id={DRAWER_ID}
            // Radix restores focus to whatever was focused when the dialog opened,
            // but the drawer is portalled and the trigger is not, so on close the
            // restore lands on a node the modal has just un-hidden and focus falls
            // through to <body>. Verified, not assumed: a keyboard user who opened
            // the drawer and pressed Escape was returned to the top of the document
            // with their place lost. Restore explicitly instead.
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              menuButtonRef.current?.focus();
            }}
            className="fixed inset-0 z-[110] bg-secondary flex flex-col drawer-safe-padding 2xl:hidden focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=open]:duration-300 data-[state=closed]:duration-200"
          >
            <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>
            <Dialog.Description className="sr-only">
              Browse the chapter&apos;s pages, or sign in to your account.
            </Dialog.Description>

            <div className="flex items-center justify-between pb-6 border-b border-white/10">
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-3 rounded-sm ${FOCUS_RING}`}
              >
                <div className="relative w-10 h-10 shrink-0">
                  <Image
                    src="/images/logo/indivisible-emblem.png"
                    alt="Indivisible Fair Oaks &amp; Carmichael"
                    width={40}
                    height={40}
                    className="w-full h-full object-contain"
                    unoptimized
                  />
                </div>
                <div>
                  <span className="text-white font-black text-base uppercase block leading-tight">
                    Indivisible
                  </span>
                  <span className="text-ink-muted-on-dark text-xs font-semibold uppercase block leading-tight">
                    Fair Oaks &amp; Carmichael
                  </span>
                </div>
              </Link>
              <Dialog.Close
                className={`inline-flex items-center justify-center size-11 -mr-2 rounded-lg text-ink-muted-on-dark hover:text-white transition-colors duration-300 ease-out ${FOCUS_RING}`}
                aria-label="Close menu"
              >
                <X size={28} aria-hidden="true" />
              </Dialog.Close>
            </div>

            <nav aria-label="Mobile" className="flex flex-col gap-1 py-6 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsSearchOpen(true);
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-ink-on-dark hover:text-white transition-colors duration-300 ease-out text-sm font-medium ${FOCUS_RING}`}
              >
                <Search size={18} className="text-ink-on-dark" aria-hidden="true" />
                <span>Quick Search…</span>
                <kbd className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary border border-white/20 text-[10px] font-mono text-ink-muted-on-dark">
                  ⌘K
                </kbd>
              </button>

              <EditorialDrawerRow onNavigate={() => setIsMenuOpen(false)} />

              <ThemeToggle variant="block" />

              {ROUTES.map((link) => {
                const isActive = isActiveRoute(pathname, link);
                // Dropdown parents expand inline: drawer users must reach every
                // child, and an always-visible group needs no accordion state.
                if (link.children) {
                  return (
                    <div key={link.href} className="py-2">
                      <Link
                        href={link.href}
                        onClick={() => setIsMenuOpen(false)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`text-xl font-bold uppercase tracking-wide transition-colors duration-300 ease-out py-2 rounded-sm ${FOCUS_RING} ${
                          isActive ? 'text-accent-gold' : 'text-ink-on-dark hover:text-white'
                        }`}
                      >
                        {link.label}
                      </Link>
                      <ul className="mt-1 ml-1 border-l border-white/10 pl-4 flex flex-col gap-0.5">
                        {link.children.map((child) => (
                          <li key={child.href}>
                            {child.external ? (
                              <a
                                href={child.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setIsMenuOpen(false)}
                                className={`inline-flex items-center gap-1.5 text-base font-medium transition-colors duration-300 ease-out py-1.5 rounded-sm ${FOCUS_RING} text-ink-muted-on-dark hover:text-white`}
                              >
                                {child.label}
                                <ArrowUpRight size={14} aria-hidden="true" />
                              </a>
                            ) : (
                              <Link
                                href={child.href}
                                onClick={() => setIsMenuOpen(false)}
                                className={`block text-base font-medium transition-colors duration-300 ease-out py-1.5 rounded-sm ${FOCUS_RING} text-ink-muted-on-dark hover:text-white`}
                              >
                                {child.label}
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`text-xl font-bold uppercase tracking-wide transition-colors duration-300 ease-out py-2 rounded-sm ${FOCUS_RING} ${
                      isActive ? 'text-accent-gold' : 'text-ink-on-dark hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto pt-6 border-t border-white/10 flex flex-col gap-4">
              <AccountButton variant="block" onNavigate={() => setIsMenuOpen(false)} />
              <Link
                href="/donate"
                onClick={() => setIsMenuOpen(false)}
                className={`w-full py-3 rounded-xl bg-accent hover:bg-accent-gold text-secondary font-bold text-center text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-float transition-colors duration-300 ease-out ${FOCUS_RING}`}
              >
                <Heart size={16} className="fill-secondary" aria-hidden="true" />
                Support via ActBlue
              </Link>
              <div className="text-xs text-ink-muted-on-dark text-center space-y-1">
                <p>
                  Inquiries:{' '}
                  <a
                    href={`mailto:${SITE_CONTACT.email}`}
                    className={`text-ink-on-dark hover:text-white hover:underline rounded-sm ${FOCUS_RING}`}
                  >
                    {SITE_CONTACT.email}
                  </a>
                </p>
                <p className="text-[11px]">Grassroots community organizing for democracy.</p>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
