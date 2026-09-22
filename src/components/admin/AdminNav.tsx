'use client';

import {
  BadgePercent,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/crm', label: 'Civic CRM', icon: UsersRound },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/coupons', label: 'Coupons', icon: BadgePercent },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      className="flex items-center gap-2 mb-12 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
      aria-label="Admin sections"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === '/admin'
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-colors ${
              active
                ? 'bg-primary text-secondary'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-secondary'
            }`}
          >
            <Icon size={13} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
