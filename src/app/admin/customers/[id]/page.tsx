import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Mail,
  Package,
  ShoppingBag,
  Ticket,
  TrendingUp,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CustomerAdminToggle } from '@/components/admin/CustomerAdminToggle';
import { requireAdmin } from '@/lib/admin-auth';
import type { AdminOrder, OrderItem } from '@/types/orders';
import { statusStyle } from '@/types/orders';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Member #${id} — Admin · Indivisible Fair Oaks`,
    robots: { index: false, follow: false },
  };
}

// Customer order projection of the canonical `AdminOrder` / `OrderItem`.
type OrderRow = Pick<AdminOrder, 'id' | 'created_at' | 'status' | 'total'> & {
  order_items: OrderItem[];
};

type Customer = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean | null;
  created_at: string | null;
  orders: OrderRow[];
};

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { adminClient } = await requireAdmin();
  const { id } = await params;
  const customerId = id;

  if (!customerId) notFound();

  const { data } = await adminClient
    .from('profiles')
    .select(
      `id, email, first_name, last_name, is_admin, created_at,
       orders ( id, created_at, status, total,
                order_items ( product_name, quantity, unit_price ) )`
    )
    .eq('id', customerId)
    .single();

  if (!data) notFound();
  const customer = data as unknown as Customer;

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Guest';
  const orders = customer.orders || [];
  const spend = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const fiatSpend = orders
    .filter((o) => o.status !== 'refunded' && o.status !== 'cancelled')
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const aov = orders.length > 0 ? fiatSpend / orders.length : 0;
  const lastOrder = [...orders].sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  )[0];

  const productCounts = new Map<string, number>();
  for (const o of orders) {
    for (const item of o.order_items || []) {
      const key = item.product_name || 'Unknown item';
      productCounts.set(key, (productCounts.get(key) || 0) + (Number(item.quantity) || 1));
    }
  }
  const topProducts = [...productCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div>
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-secondary transition-colors mb-6"
      >
        <ArrowLeft size={12} /> Back to Customers
      </Link>

      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <User size={14} className="text-secondary" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Admin Panel
          </span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-secondary uppercase">{name}</h1>
            <p className="text-sm text-slate-500 font-bold mt-1 flex items-center gap-2">
              <Mail size={12} className="text-slate-300" /> {customer.email}
            </p>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1.5">
              <Calendar size={11} />
              Customer since{' '}
              {customer.created_at
                ? new Date(customer.created_at).toLocaleDateString('en-NZ', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'N/A'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 bg-slate-100 text-slate-600">
              #{customer.id}
            </span>
            <CustomerAdminToggle profileId={customer.id} isAdmin={customer.is_admin} />
          </div>
        </div>
        <div className="h-1.5 w-24 bg-primary mt-3" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Orders', value: String(orders.length), icon: ShoppingBag },
          { label: 'Lifetime Spend', value: `$${spend.toFixed(2)}`, icon: CreditCard },
          { label: 'Avg Order Value', value: `$${aov.toFixed(2)}`, icon: TrendingUp },
          {
            label: 'Last Order',
            value: lastOrder?.created_at
              ? new Date(lastOrder.created_at).toLocaleDateString('en-NZ', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '—',
            icon: Calendar,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-secondary rounded-3xl p-6">
            <Icon size={16} className="text-primary mb-3" />
            <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">
              {label}
            </p>
            <p className="text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order history */}
        <section className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm lg:col-span-2">
          <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex items-center gap-2">
            <Package size={12} className="text-primary" />
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
              Order history ({orders.length})
            </h2>
          </div>
          {orders.length === 0 ? (
            <div className="px-8 py-12 text-center">
              <p className="text-slate-400 font-black uppercase tracking-widest text-sm">
                No orders yet.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {orders
                .slice()
                .sort((a, b) =>
                  String(b.created_at || '').localeCompare(String(a.created_at || ''))
                )
                .map((o) => (
                  <li key={o.id} className="px-8 py-4 flex flex-wrap items-center gap-4">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="text-sm font-black text-secondary uppercase tracking-wider hover:text-primary transition-colors"
                    >
                      #{o.id}
                    </Link>
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 ${statusStyle(o.status)}`}
                    >
                      {o.status || 'unknown'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-bold">
                      {o.created_at
                        ? new Date(o.created_at).toLocaleDateString('en-NZ', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </span>
                    <span className="ml-auto text-sm font-black text-primary">
                      ${Number(o.total).toFixed(2)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* Top products */}
        <section className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex items-center gap-2">
            <Ticket size={12} className="text-primary" />
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
              Most purchased
            </h2>
          </div>
          {topProducts.length === 0 ? (
            <div className="px-8 py-12 text-center">
              <p className="text-slate-400 font-black uppercase tracking-widest text-sm">
                Nothing yet.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50 px-8 py-2">
              {topProducts.map(([product, qty]) => (
                <li key={product} className="py-3 flex items-center gap-3">
                  <span className="w-7 h-7 bg-secondary rounded-lg flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                    {qty}
                  </span>
                  <span className="text-xs font-black text-secondary uppercase tracking-wide truncate">
                    {product}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
