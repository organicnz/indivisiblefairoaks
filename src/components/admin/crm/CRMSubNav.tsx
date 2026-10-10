'use client';

import { CalendarCheck, Layers, Megaphone, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin/crm', label: 'Directory', icon: UsersRound },
  { href: '/admin/crm/segments', label: 'Segments', icon: Layers },
  { href: '/admin/crm/tasks', label: 'Follow-ups', icon: CalendarCheck },
  { href: '/admin/crm/broadcasts', label: 'Broadcasts', icon: Megaphone },
];

export function CRMSubNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin/crm') {
      // Directory owns the root and contact detail routes (uuid segments).
      return pathname === href || /^\/admin\/crm\/[0-9a-f-]{36}$/i.test(pathname);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    // `tabIndex={0}` on the scroll container, per the WAI-ARIA Scrollable Region
    // pattern. Chrome and Firefox stopped focusing an `overflow-x-auto` element by
    // default, so without it a keyboard user cannot reach Broadcasts on a narrow
    // viewport — the third tab is off-screen and there is no other way to it.
    // `role="navigation"` plus `aria-label` already gives the focus a purpose;
    // that pairing is the whole pattern. See `ContentList.tsx` for the same
    // shape, and AGENTS.md for why it exists.
    <nav
      className="flex items-center gap-2 -mt-4 mb-2 overflow-x-auto pb-1"
      aria-label="CRM sections"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA scrollable region, see AGENTS.md "Scrollable regions must be focusable"
      tabIndex={0}
    >
      {ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          // `aria-current="page"` rather than a colour alone. The active tab was
          // distinguished only by its background, so a screen-reader user
          // navigating the three sections got no indication of where they were.
          aria-current={isActive(href) ? 'page' : undefined}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-colors ${
            isActive(href)
              ? 'bg-secondary text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-secondary'
          }`}
        >
          <Icon size={13} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
