'use client';

import { CalendarCheck, Megaphone, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin/crm', label: 'Directory', icon: UsersRound },
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
    <nav
      className="flex items-center gap-2 -mt-4 mb-2 overflow-x-auto pb-1"
      aria-label="CRM sections"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-colors ${
            isActive(href)
              ? 'bg-secondary text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-secondary'
          }`}
        >
          <Icon size={13} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
