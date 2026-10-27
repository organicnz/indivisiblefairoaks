'use client';

import {
  BadgePercent,
  Calendar,
  FileText,
  LayoutDashboard,
  Link2,
  Newspaper,
  Package,
  ShoppingBag,
  Users,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ENABLE_LEGACY_ORDERS } from '@/config/commerce';
import { useDataPoints } from '@/hooks/useDataPoints';

interface AdminNavItem {
  href: string;
  labelKey?: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const BASE_ITEMS: AdminNavItem[] = [
  {
    href: '/admin',
    labelKey: 'admin.nav.dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  { href: '/admin/content', labelKey: 'admin.nav.content', label: 'Pages & Posts', icon: FileText },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/news', label: 'News', icon: Newspaper },
  { href: '/admin/links', label: 'Links', icon: Link2 },
  { href: '/admin/crm', labelKey: 'admin.nav.crm', label: 'Civic CRM', icon: UsersRound },
  { href: '/admin/products', labelKey: 'admin.nav.products', label: 'Products', icon: Package },
  { href: '/admin/customers', labelKey: 'admin.nav.customers', label: 'Customers', icon: Users },
  {
    href: '/admin/coupons',
    labelKey: 'admin.nav.coupons',
    label: 'Coupons',
    icon: BadgePercent,
  },
];

/** Legacy admin navigation items preserved for reference and data-points contract */
export const LEGACY_ADMIN_ITEMS: AdminNavItem[] = [
  { href: '/admin/orders', labelKey: 'admin.nav.orders', label: 'Orders', icon: ShoppingBag },
];

const ITEMS: AdminNavItem[] = ENABLE_LEGACY_ORDERS
  ? [...BASE_ITEMS.slice(0, 6), ...LEGACY_ADMIN_ITEMS, ...BASE_ITEMS.slice(6)]
  : BASE_ITEMS;

export function AdminNav() {
  const pathname = usePathname();
  const { dataPoints } = useDataPoints('admin');
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-12">
      <nav
        className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
        aria-label={dataPoints['admin.nav.aria'] || 'Admin sections'}
      >
        {ITEMS.map(({ href, labelKey, label, icon: Icon }) => {
          const active =
            href === '/admin'
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-colors shrink-0 ${
                active
                  ? 'bg-primary text-white'
                  : 'bg-surface-muted text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              <Icon size={13} />
              {(labelKey && dataPoints[labelKey]) || label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden lg:flex items-center shrink-0">
        <ThemeToggle variant="segmented" />
      </div>
    </div>
  );
}
