'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, Heart, Menu, Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, Suspense, useEffect, useRef, useState } from 'react';
import { AccountButton } from '@/components/layout/AccountButton';
import { EditorialButton, EditorialDrawerRow } from '@/components/layout/EditorialButton';
import { NavDropdown } from '@/components/layout/NavDropdown';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { CivicCommandPalette } from '@/components/ui/CivicCommandPalette';
import { DataPoint } from '@/components/ui/DataPoint';
import { isActiveRoute, NAV_GROUPS, ROUTES } from '@/config/routes';
import { SITE_CONTACT } from '@/config/site';
import { useDataPoints } from '@/hooks/useDataPoints';

const DRAWER_ID = 'primary-navigation-drawer';

// Focus ring, used on every interactive control in the header. The header had no
// focus styling at all: keyboard focus on primary navigation was completely
// invisible, which fails WCAG 2.4.7.
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

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
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 border-b border-foreground/20 bg-background"
    >
      <div className="mx-auto flex h-16 max-w-[88rem] items-center justify-between px-4 sm:px-6 md:h-[4.25rem] lg:px-8">
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0">
            <Image
              src="/images/logo/indivisible-emblem.png"
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-contain"
              priority
              unoptimized
            />
          </div>
          <div>
            <span className="block font-display text-xl font-semibold leading-none tracking-[-0.03em] text-foreground">
              Indivisible
            </span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Fair Oaks &amp; Carmichael
            </span>
          </div>
        </div>
        <div className="hidden items-center gap-4 md:flex">
          {ROUTES.map((link) => (
            <span
              key={link.href}
              className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/45"
            >
              {link.short ?? link.label}
            </span>
          ))}
        </div>
      </div>
      <div className="hidden h-10 border-t border-border md:block" />
    </div>
  );
}

function HeaderInner() {
  const { dataPoints } = useDataPoints('header');
  const alertRoute = ROUTES.find((link) => link.href === '/ice-alerts');
  const primaryRoutes = ROUTES.filter((link) => link.href !== '/ice-alerts');
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
        className={`fixed inset-x-0 top-0 z-50 border-b border-foreground/20 bg-background/95 backdrop-blur-md transition-shadow duration-300 ease-out ${
          isScrolled ? 'shadow-header' : ''
        }`}
      >
        <div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
          {/* Tier one: identity and actions. */}
          <div className="flex h-16 items-center justify-between gap-4 md:h-[4.25rem]">
            <Link
              href="/"
              className={`group flex items-center gap-3 rounded-sm ${FOCUS_RING}`}
            >
              <div className="relative size-10 shrink-0 transition-transform duration-300 ease-out group-hover:-rotate-2 motion-reduce:group-hover:rotate-0">
                <Image
                  src="/images/logo/indivisible-emblem.png"
                  alt="Indivisible Fair Oaks &amp; Carmichael"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                  priority
                  unoptimized
                />
              </div>
              <div>
                <span className="block font-display text-[1.35rem] font-semibold leading-none tracking-[-0.035em] text-foreground sm:text-[1.55rem]">
                  <DataPoint name="header.logo.title" initialData={dataPoints}>
                    Indivisible
                  </DataPoint>
                </span>
                <span className="mt-1 block text-[8.5px] font-bold uppercase tracking-[0.17em] text-muted-foreground sm:text-[9px]">
                  <DataPoint name="header.logo.subtitle" initialData={dataPoints}>
                    Fair Oaks &amp; Carmichael
                  </DataPoint>
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="hidden sm:block">
                <CivicCommandPalette isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} />
              </div>

              <Link
                href="/donate"
                aria-label="Donate to Indivisible Fair Oaks-Carmichael"
                className={`inline-flex size-11 items-center justify-center rounded-sm bg-foreground text-background transition-colors duration-300 ease-out hover:bg-primary sm:hidden ${FOCUS_RING}`}
              >
                <Heart size={17} className="fill-accent-gold text-accent-gold" aria-hidden="true" />
              </Link>

              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              <EditorialButton />
              <Link
                href="/donate"
                className={`hidden h-9 items-center gap-1.5 rounded-sm border border-foreground bg-foreground px-3.5 text-[10px] font-bold uppercase tracking-[0.13em] text-background transition-colors duration-300 ease-out hover:border-primary hover:bg-primary sm:inline-flex ${FOCUS_RING}`}
              >
                <Heart size={13} className="fill-accent-gold text-accent-gold" aria-hidden="true" />
                <DataPoint as="span" name="header.donate_btn" initialData={dataPoints}>
                  Donate
                </DataPoint>
              </Link>

              <div className="hidden xl:block">
                <AccountButton />
              </div>

              <button
                type="button"
                ref={menuButtonRef}
                className={`inline-flex size-11 items-center justify-center rounded-sm text-foreground transition-colors duration-300 ease-out hover:bg-surface-muted md:hidden ${FOCUS_RING}`}
                onClick={() => setIsMenuOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={isMenuOpen}
                aria-controls={DRAWER_ID}
              >
                <Menu size={23} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Tier two: the whole chapter, on one line. The old single-row header
              could not fit nine links beside the action cluster without hiding
              navigation behind a menu at desktop sizes. */}
          <div className="hidden h-10 items-center justify-between border-t border-border md:flex">
            <nav aria-label="Primary" className="flex h-full min-w-0 items-center gap-0.5 xl:gap-1">
              {primaryRoutes.map((link) => {
                const isActive = isActiveRoute(pathname, link);
                if (link.children) {
                  return <NavDropdown key={link.href} link={link} isActive={isActive} />;
                }
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative inline-flex h-full items-center whitespace-nowrap rounded-sm px-2.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors duration-300 ease-out xl:px-3 xl:text-[11.5px] ${FOCUS_RING} ${
                      isActive
                        ? 'text-primary-ink'
                        : 'text-foreground/65 hover:text-foreground'
                    }`}
                  >
                    {link.short ?? link.label}
                    {isActive ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-2 bottom-0 h-0.5 bg-accent xl:inset-x-2.5"
                      />
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className="flex h-full shrink-0 items-center gap-3">
              <span className="hidden border-l border-border pl-4 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground xl:inline-block">
                Fair Oaks · Carmichael, CA
              </span>
              {alertRoute ? (
                <Link
                  href={alertRoute.href}
                  aria-current={isActiveRoute(pathname, alertRoute) ? 'page' : undefined}
                  className={`relative inline-flex h-full items-center whitespace-nowrap rounded-sm px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-accent transition-colors duration-300 ease-out hover:text-foreground ${FOCUS_RING}`}
                >
                  {alertRoute.short ?? alertRoute.label}
                  {isActiveRoute(pathname, alertRoute) ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-1 bottom-0 h-0.5 bg-accent"
                    />
                  ) : null}
                </Link>
              ) : null}
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
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-secondary/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 md:hidden" />
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
            className="fixed inset-0 z-[110] flex flex-col bg-secondary text-ink-on-dark drawer-safe-padding md:hidden focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=open]:duration-300 data-[state=closed]:duration-200"
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
                  <span className="block font-display text-xl font-semibold leading-none tracking-[-0.03em] text-white">
                    <DataPoint name="header.logo.title" initialData={dataPoints}>
                      Indivisible
                    </DataPoint>
                  </span>
                  <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.16em] text-ink-muted-on-dark">
                    <DataPoint name="header.logo.subtitle" initialData={dataPoints}>
                      Fair Oaks &amp; Carmichael
                    </DataPoint>
                  </span>
                </div>
              </Link>
              <Dialog.Close
                className={`inline-flex items-center justify-center size-11 -mr-2 rounded-sm text-ink-muted-on-dark hover:text-white transition-colors duration-300 ease-out ${FOCUS_RING}`}
                aria-label="Close menu"
              >
                <X size={28} aria-hidden="true" />
              </Dialog.Close>
            </div>

            <nav aria-label="Mobile" className="flex flex-col gap-1 py-6 overflow-y-auto">
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className={`rounded-sm py-2 font-display text-2xl font-semibold tracking-[-0.02em] transition-colors duration-300 ease-out ${FOCUS_RING} ${
                  pathname === '/' ? 'text-accent-gold' : 'text-ink-on-dark hover:text-white'
                }`}
              >
                Home
              </Link>
              {/* Primary Route Navigation Links First */}
              {ROUTES.map((link, index) => {
                const isActive = isActiveRoute(pathname, link);
                const groupLabel =
                  link.group !== 'more' &&
                  link.group &&
                  !ROUTES.slice(0, index).some((previous) => previous.group === link.group)
                    ? NAV_GROUPS.find((group) => group.id === link.group)?.label
                    : null;
                // Dropdown parents expand inline: drawer users must reach every
                // child, and an always-visible group needs no accordion state.
                if (link.children) {
                  return (
                    <Fragment key={link.href}>
                      {groupLabel ? (
                        <p className="pt-4 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted-on-dark">
                          {groupLabel}
                        </p>
                      ) : null}
                    <div className="py-2">
                      <Link
                        href={link.href}
                        onClick={() => setIsMenuOpen(false)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`rounded-sm py-2 font-display text-2xl font-semibold tracking-[-0.02em] transition-colors duration-300 ease-out ${FOCUS_RING} ${
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
                                aria-current={
                                  !child.href.includes('#') && child.href === pathname
                                    ? 'page'
                                    : undefined
                                }
                                className={`block text-base font-medium transition-colors duration-300 ease-out py-1.5 rounded-sm ${FOCUS_RING} ${
                                  !child.href.includes('#') && child.href === pathname
                                    ? 'text-accent-gold'
                                    : 'text-ink-muted-on-dark hover:text-white'
                                }`}
                              >
                                {child.label}
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    </Fragment>
                  );
                }
                return (
                  <Fragment key={link.href}>
                    {groupLabel ? (
                      <p className="pt-4 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted-on-dark">
                        {groupLabel}
                      </p>
                    ) : null}
                    <Link
                      href={link.href}
                      onClick={() => setIsMenuOpen(false)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`rounded-sm py-2 font-display text-2xl font-semibold tracking-[-0.02em] transition-colors duration-300 ease-out ${FOCUS_RING} ${
                        isActive ? 'text-accent-gold' : 'text-ink-on-dark hover:text-white'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </Fragment>
                );
              })}

              <div className="my-3 border-t border-white/10" />

              {/* Quick Search */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsSearchOpen(true);
                }}
                className={`flex items-center gap-3 rounded-sm border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-ink-on-dark transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white ${FOCUS_RING}`}
              >
                <Search size={18} className="text-ink-on-dark" aria-hidden="true" />
                <DataPoint as="span" name="header.drawer.search" initialData={dataPoints}>
                  Quick Search…
                </DataPoint>
                <kbd className="ml-auto inline-flex items-center gap-0.5 rounded-sm border border-white/20 bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-ink-muted-on-dark">
                  ⌘K
                </kbd>
              </button>

              <EditorialDrawerRow onNavigate={() => setIsMenuOpen(false)} />

              {/* Appearance Mode Settings */}
              <ThemeToggle variant="block" />
            </nav>

            <div className="mt-auto pt-6 border-t border-white/10 flex flex-col gap-4">
              <AccountButton variant="block" onNavigate={() => setIsMenuOpen(false)} />
              <Link
                href="/donate"
                onClick={() => setIsMenuOpen(false)}
                className={`flex w-full items-center justify-center gap-2 rounded-sm border border-accent bg-accent py-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors duration-300 ease-out hover:bg-accent-red ${FOCUS_RING}`}
              >
                <Heart size={16} className="fill-current" aria-hidden="true" />
                <DataPoint as="span" name="header.drawer.donate_cta" initialData={dataPoints}>
                  Support via ActBlue
                </DataPoint>
              </Link>
              <div className="text-xs text-ink-muted-on-dark text-center space-y-1">
                <p>
                  <DataPoint
                    name="header.drawer.inquiries_label"
                    as="span"
                    initialData={dataPoints}
                  >
                    Inquiries:
                  </DataPoint>{' '}
                  <a
                    href={`mailto:${SITE_CONTACT.email}`}
                    className={`text-ink-on-dark hover:text-white hover:underline rounded-sm ${FOCUS_RING}`}
                  >
                    {SITE_CONTACT.email}
                  </a>
                </p>
                <DataPoint
                  as="p"
                  name="header.drawer.tagline"
                  initialData={dataPoints}
                  className="text-[11px]"
                >
                  Grassroots community organizing for democracy.
                </DataPoint>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
