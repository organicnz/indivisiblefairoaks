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
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

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
        className={`relative inline-flex h-full cursor-pointer items-center gap-1 whitespace-nowrap rounded-sm px-2.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors duration-300 ease-out xl:px-3 xl:text-[11.5px] ${FOCUS_RING} ${
          isActive ? 'text-primary-ink' : 'text-foreground/65 hover:text-foreground'
        }`}
      >
        {link.short ?? link.label}
        <ChevronDown size={12} aria-hidden="true" className="shrink-0" />
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute inset-x-2 bottom-0 h-0.5 bg-accent xl:inset-x-2.5"
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        // Same layer as the account menu (`AccountButton`): above page content
        // and the WALL-E surfaces, below the nav drawer and command palette.
        className="z-[110] min-w-60 rounded-sm border border-foreground/20 bg-background p-1.5 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        {children.map((child) =>
          child.external ? (
            <DropdownMenuItem key={child.href} asChild>
              <a
                href={child.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-2 rounded-sm px-3 py-2 text-sm text-foreground/80 transition-colors duration-150 ease-out cursor-pointer outline-none data-[highlighted]:bg-surface-muted data-[highlighted]:text-foreground"
              >
                <span className="flex-1">{child.label}</span>
                <ExternalLink size={12} aria-hidden="true" className="shrink-0 opacity-60" />
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={child.href} asChild>
              <Link
                href={child.href}
                className="flex min-h-11 items-center gap-2 rounded-sm px-3 py-2 text-sm text-foreground/80 transition-colors duration-150 ease-out cursor-pointer outline-none data-[highlighted]:bg-surface-muted data-[highlighted]:text-foreground"
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
