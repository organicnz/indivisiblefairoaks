import { Search, Users } from 'lucide-react';
import Link from 'next/link';
import { CustomerAdminToggle } from '@/components/admin/CustomerAdminToggle';
import { DataPoint } from '@/components/ui/DataPoint';
import { formatPrice } from '@/config/commerce';
import { requireAdmin } from '@/lib/admin-auth';
import { getDataPoints } from '@/lib/queries/civic';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export const metadata = {
  title: 'Community Members — Admin · Indivisible Fair Oaks',
  robots: { index: false, follow: false },
};

type Customer = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean | null;
  created_at: string | null;
  orders: {
    id: number;
    total: number | null;
    created_at: string | null;
    status: string | null;
  }[];
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { adminClient } = await requireAdmin();
  const { q } = await searchParams;
  const query = (q || '').trim().toLowerCase();

  const [{ data: customers }, dataPoints] = await Promise.all([
    adminClient
      .from('profiles')
      .select(`id, email, first_name, last_name, is_admin, created_at,
      orders ( id, total, created_at, status )`)
      .order('created_at', { ascending: false })
      .limit(500),
    getDataPoints('admin'),
  ]);

  const rows = ((customers || []) as unknown as Customer[]).filter((c) => {
    if (!query) return true;
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ').toLowerCase();
    return name.includes(query) || c.email.toLowerCase().includes(query) || String(c.id) === query;
  });
  const neverOrderedLabel = dataPoints['admin.customers.never_ordered'] || 'Never ordered';

  return (
    <div>
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Users size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
            <DataPoint as="span" name="admin.panel.eyebrow" initialData={dataPoints}>
              Admin Panel
            </DataPoint>
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">
          <DataPoint as="span" name="admin.customers.title" initialData={dataPoints}>
            Customers
          </DataPoint>
        </h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
        <p className="mt-4 text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
          {rows.length} profiles
        </p>
      </div>

      <form
        method="get"
        aria-label="Search customers"
        className="flex items-center gap-2 bg-surface-muted border border-border dark:border-white/10 focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-primary-bright rounded-full px-4 py-2 mb-8 max-w-md transition-shadow"
      >
        <Search size={13} className="text-muted-foreground shrink-0" aria-hidden="true" />
        <input
          name="q"
          defaultValue={q}
          aria-label="Search customers by name, email, or profile ID"
          placeholder="Search customers…"
          className="bg-transparent text-sm font-bold text-foreground outline-none rounded-md placeholder:text-muted-foreground w-full"
        />
      </form>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="bg-surface-muted p-16 rounded-3xl border border-dashed border-border text-center">
            <Users size={32} className="mx-auto mb-3 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-muted-foreground font-black uppercase tracking-widest text-sm">
              <DataPoint as="span" name="admin.customers.empty" initialData={dataPoints}>
                No customers yet.
              </DataPoint>
            </p>
          </div>
        ) : (
          rows.map((c) => {
            const spent = c.orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
            const lastOrder = [...c.orders].sort((a, b) =>
              String(b.created_at || '').localeCompare(String(a.created_at || ''))
            )[0];
            return (
              <div
                key={c.id}
                className="bg-surface-card border border-border rounded-3xl overflow-hidden shadow-sm"
              >
                <div className="px-8 py-5 grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                  <div className="col-span-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="text-sm font-black text-foreground uppercase tracking-wider hover:text-primary dark:hover:text-primary-on-dark transition-colors"
                      >
                        {[c.first_name, c.last_name].filter(Boolean).join(' ') ||
                          dataPoints['admin.customers.guest'] ||
                          'Guest'}
                      </Link>
                      {c.is_admin && (
                        <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 bg-primary dark:bg-primary-bright text-white">
                          <DataPoint
                            as="span"
                            name="admin.customers.admin_badge"
                            initialData={dataPoints}
                          >
                            Admin
                          </DataPoint>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-bold mt-0.5">{c.email}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      <DataPoint
                        as="span"
                        name="admin.customers.joined_label"
                        initialData={dataPoints}
                      >
                        Joined
                      </DataPoint>{' '}
                      {c.created_at
                        ? new Date(c.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                      <DataPoint
                        as="span"
                        name="admin.customers.orders_label"
                        initialData={dataPoints}
                      >
                        Orders
                      </DataPoint>
                    </p>
                    <p className="text-sm text-foreground font-black">{c.orders.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                      <DataPoint
                        as="span"
                        name="admin.customers.spend_label"
                        initialData={dataPoints}
                      >
                        Lifetime Spend
                      </DataPoint>
                    </p>
                    <p className="text-lg text-primary dark:text-primary-on-dark font-black">
                      {formatPrice(spent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                      <DataPoint
                        as="span"
                        name="admin.customers.last_order_label"
                        initialData={dataPoints}
                      >
                        Last Order
                      </DataPoint>
                    </p>
                    <p className="text-sm text-foreground font-black">
                      {lastOrder
                        ? new Date(lastOrder.created_at || '').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {lastOrder ? lastOrder.status : neverOrderedLabel}
                    </p>
                  </div>
                </div>
                <div className="px-8 py-3 bg-surface-muted border-t border-border">
                  <CustomerAdminToggle profileId={c.id} isAdmin={c.is_admin} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
