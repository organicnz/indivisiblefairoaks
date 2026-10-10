'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { ChevronDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { NavLink } from '@/config/routes';

// Mirrors the header's FOCUS_RING in Header.tsx: the header had no focus styling
// at all before that constant, and every interactive control in it shares it.
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary';

type NavDropdownProps = {
  link: NavLink;
  isActive: boolean;
};

/**
 * Desktop dropdown for a primary-nav link with children (Voter Info pilot).
 *
 * Radix supplies the keyboard contract (Enter/Space opens, arrows move, Escape
 * closes and restores focus) — the same primitive `AccountButton` already uses,
 * so no new dependency. Click-to-open (never hover-only) keeps touch devices
 * first-class, per the `hover-capable` rule in AGENTS.md.
 */
export function NavDropdown({ link, isActive }: NavDropdownProps) {
  const children = link.children ?? [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${link.label} menu`}
        // `aria-current` is what conveys the active page to assistive tech; the
        // amber text and underline bar are decoration — same contract as the
        // plain links in Header.tsx.
        aria-current={isActive ? 'page' : undefined}
        className={`whitespace-nowrap text-xs font-bold uppercase tracking-[0.2em] transition-colors duration-300 ease-out relative py-1 rounded-sm inline-flex items-center gap-1 cursor-pointer ${FOCUS_RING} ${
          isActive ? 'text-accent-gold font-extrabold' : 'text-ink-on-dark hover:text-white'
        }`}
      >
        {link.short ?? link.label}
        <ChevronDown size={14} aria-hidden="true" className="shrink-0" />
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-gold rounded-full"
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        // Same layer as the account menu (`AccountButton`): above page content
        // and the WALL-E surfaces, below the nav drawer and command palette.
        className="z-[110] min-w-60 rounded-xl bg-secondary p-1.5 shadow-float border border-white/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        {children.map((child) =>
          child.external ? (
            <DropdownMenuItem key={child.href} asChild>
              <a
                href={child.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm rounded-lg text-ink-on-dark transition-colors duration-150 ease-out cursor-pointer outline-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
              >
                <span className="flex-1">{child.label}</span>
                <ExternalLink size={12} aria-hidden="true" className="shrink-0 opacity-60" />
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={child.href} asChild>
              <Link
                href={child.href}
                className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm rounded-lg text-ink-on-dark transition-colors duration-150 ease-out cursor-pointer outline-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
              >
                <span className="flex-1">{child.label}</span>
              </Link>
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
