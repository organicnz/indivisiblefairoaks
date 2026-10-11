import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  DollarSign,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect';
import { requireAdmin } from '@/lib/admin-auth';
import type { AdminOrder } from '@/types/orders';

// Dashboard projection of the canonical `AdminOrder` — only the columns this
// select reads, so the cast stays sound without a parallel `Order` shape.
type Order = Pick<
  AdminOrder,
  'id' | 'created_at' | 'status' | 'total' | 'currency' | 'order_items' | 'profiles'
> & {
  coupon_code?: string | null;
};

// Deliberate Cache Components opt-out (Block): admin dashboard with live order metrics behind requireAdmin().
export const instant = false;

export const metadata = {
  title: 'Dashboard — Admin · Indivisible Fair Oaks',
  robots: { index: false, follow: false },
};

type Product = {
  id: number;
  name: string;
  stock_status: string | null;
};

const STATUS_ORDER = {
  processing: 0,
  'on-hold': 1,
  completed: 2,
  refunded: 3,
  cancelled: 4,
};

export default async function AdminDashboardPage() {
  const { adminClient } = await requireAdmin();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: recentOrders },
    { data: previousOrders },
    { data: products },
    { data: couponUsage },
  ] = await Promise.all([
    adminClient
      .from('orders')
      .select(
        `id, created_at, status, total, currency, coupon_code,
         order_items ( product_name, quantity ),
         profiles ( first_name, last_name, email )`
      )
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(200),
    adminClient
      .from('orders')
      .select('created_at, status, total')
      .gte('created_at', sixtyDaysAgo)
      .lt('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(200),
    adminClient.from('products').select('id, name, stock_status').order('name'),
    adminClient
      .from('orders')
      .select('coupon_code, total')
      .not('coupon_code', 'is', null)
      .gte('created_at', thirtyDaysAgo)
      .limit(500),
  ]);

  const orders = (recentOrders || []) as unknown as Order[];
  const previousRows = (previousOrders || []) as Pick<Order, 'created_at' | 'status' | 'total'>[];
  const productRows = (products || []) as Product[];
  const couponRows = (couponUsage || []) as { coupon_code: string; total: number | null }[];

  // Previous-period baseline (days 30–60) for deltas
  const prevRevenue = previousRows.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const prevOrdersCount = previousRows.length;

  // KPI metrics (last 30 days)
  const revenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const paidOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded');
  const aov = paidOrders.length > 0 ? revenue / paidOrders.length : 0;
  const toShip = orders.filter((o) => o.status === 'processing' || o.status === 'on-hold');

  const pctChange = (current: number, previous: number): number | null => {
    if (previous === 0) return current > 0 ? null : 0;
    return ((current - previous) / previous) * 100;
  };
  const revenueDelta = pctChange(revenue, prevRevenue);
  const ordersDelta = pctChange(orders.length, prevOrdersCount);
  const outOfStock = productRows.filter((p) => p.stock_status === 'outofstock' || !p.stock_status);
  const backorder = productRows.filter((p) => p.stock_status === 'onbackorder');

  // Revenue per day for the bar chart (last 14 days)
  const dayBuckets = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dayBuckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const o of orders) {
    if (!o.created_at) continue;
    const day = o.created_at.slice(0, 10);
    if (dayBuckets.has(day)) {
      dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + (Number(o.total) || 0));
    }
  }
  const dayLabels = new Map(
    [...dayBuckets.keys()].map((k) => [
      k,
      new Date(`${k}T12:00:00`).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' }),
    ])
  );
  const dayValues = [...dayBuckets.values()];
  const maxDay = Math.max(...dayValues, 1);

  // Previous-period revenue per the same calendar day (30 days earlier),
  // aligned so each bar pair covers the same weekday — muted underlay.
  const prevDayBuckets = new Map<string, number>();
  for (const day of dayBuckets.keys()) {
    prevDayBuckets.set(day, 0);
  }
  for (const o of previousRows) {
    if (!o.created_at) continue;
    const shifted = new Date(new Date(o.created_at).getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    if (prevDayBuckets.has(shifted)) {
      prevDayBuckets.set(shifted, (prevDayBuckets.get(shifted) ?? 0) + (Number(o.total) || 0));
    }
  }
  const prevDayValues = [...prevDayBuckets.values()];
  const maxDayBoth = Math.max(maxDay, ...prevDayValues, 1);

  // Top products by units sold (last 30 days)
  const unitsByProduct = new Map<string, number>();
  for (const o of paidOrders) {
    for (const item of o.order_items) {
      const name = item.product_name || 'Unknown item';
      unitsByProduct.set(name, (unitsByProduct.get(name) || 0) + (item.quantity || 0));
    }
  }
  const topProducts = [...unitsByProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Coupon usage (last 30 days)
  const couponStats = new Map<string, { uses: number; revenue: number }>();
  for (const c of couponRows) {
    const stat = couponStats.get(c.coupon_code) || { uses: 0, revenue: 0 };
    stat.uses += 1;
    stat.revenue += Number(c.total) || 0;
    couponStats.set(c.coupon_code, stat);
  }

  const sortedOrders = [...orders].sort((a, b) => {
    return (
      (STATUS_ORDER[(b.status || '') as keyof typeof STATUS_ORDER] ?? 99) -
      (STATUS_ORDER[(a.status || '') as keyof typeof STATUS_ORDER] ?? 99)
    );
  });
  const topPending = sortedOrders
    .filter((o) => o.status === 'processing' || o.status === 'on-hold')
    .slice(0, 5);

  // Status distribution (last 30 days)
  const statusStats: { status: string; count: number; revenue: number; pct: number }[] = [];
  if (orders.length > 0) {
    const byStatus = new Map<string, { count: number; revenue: number }>();
    for (const o of orders) {
      const s = o.status || 'unknown';
      const stat = byStatus.get(s) || { count: 0, revenue: 0 };
      stat.count += 1;
      stat.revenue += Number(o.total) || 0;
      byStatus.set(s, stat);
    }
    for (const s of ['processing', 'on-hold', 'completed', 'refunded', 'cancelled']) {
      const stat = byStatus.get(s);
      if (stat) statusStats.push({ status: s, ...stat, pct: (stat.count / orders.length) * 100 });
    }
  }
  const statusColours: Record<string, string> = {
    processing: 'bg-amber-400',
    'on-hold': 'bg-blue-400',
    completed: 'bg-emerald-400',
    refunded: 'bg-border',
    cancelled: 'bg-rose-400',
  };

  const fmtMoney = (n: number) =>
    `$${n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <TrendingUp size={14} className="text-foreground" />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
            Admin Panel
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">Dashboard</h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Revenue (30d)',
            value: fmtMoney(revenue),
            icon: DollarSign,
            delta: revenueDelta,
          },
          {
            label: 'Orders (30d)',
            value: orders.length,
            icon: ShoppingBag,
            delta: ordersDelta,
          },
          { label: 'Avg. order value', value: fmtMoney(aov), icon: TrendingUp },
          { label: 'Awaiting shipment', value: toShip.length, icon: Package },
        ].map(({ label, value, icon: Icon, delta }) => (
          <div key={label} className="bg-secondary rounded-3xl p-6">
            <Icon size={16} className="text-primary-on-dark mb-3" />
            <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">
              {label}
            </p>
            <p className="text-2xl font-black text-white">{value}</p>
            {delta !== undefined && (
              <p
                className={`mt-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${
                  delta === null
                    ? 'text-white/40'
                    : delta > 0
                      ? 'text-emerald-400'
                      : delta < 0
                        ? 'text-rose-400'
                        : 'text-white/40'
                }`}
              >
                {delta === null ? (
                  'No prior data'
                ) : (
                  <>
                    <TrendingUp size={10} className={delta < 0 ? 'rotate-180' : undefined} />
                    {delta > 0 ? '+' : ''}
                    {delta.toFixed(1)}% vs prev 30d
                  </>
                )}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue chart */}
        <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em]">
              Revenue — last 14 days
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary" /> This period
              </span>
              <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-surface-muted" /> Prior period
              </span>
              <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                {fmtMoney(maxDay)}↑ best day
              </span>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-40">
            {dayValues.map((v, i) => {
              const day = [...dayBuckets.keys()][i];
              const prev = prevDayValues[i] || 0;
              const h = Math.max(4, Math.round((v / maxDayBoth) * 100));
              const ph = Math.max(2, Math.round((prev / maxDayBoth) * 100));
              return (
                <div key={day} className="flex-1 flex flex-col justify-end gap-0.5">
                  {prev > 0 && (
                    <div
                      title={`${dayLabels.get(day)} (prior period) — ${fmtMoney(prev)}`}
                      className="rounded-t-sm bg-surface-muted transition-all"
                      style={{ height: `${ph}%` }}
                    />
                  )}
                  <div
                    title={`${dayLabels.get(day)} — ${fmtMoney(v)}`}
                    className={`rounded-t-md transition-all ${v > 0 ? 'bg-primary' : 'bg-surface-muted'}`}
                    style={{ height: `${h}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            {[...dayBuckets.keys()].map((day) => (
              <span key={day} className="text-[9px] text-muted-foreground font-bold uppercase">
                {dayLabels.get(day)}
              </span>
            ))}
          </div>
        </section>

        {/* Top products */}
        <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm">
          <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em] mb-6">
            Top products (30d)
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-muted-foreground font-bold text-sm">No sales yet.</p>
          ) : (
            <ul className="space-y-4">
              {topProducts.map(([name, units], i) => (
                <li key={name} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-surface-muted flex items-center justify-center text-[10px] font-black text-foreground">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-foreground uppercase tracking-wider truncate">
                      {name}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                      {units} sold
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Status distribution */}
      {statusStats.length > 0 && (
        <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em]">
              Order status (30d)
            </h2>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors"
            >
              View orders <ArrowRight size={11} />
            </Link>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden mb-6 bg-surface-muted">
            {statusStats.map((s) => (
              <div
                key={s.status}
                title={`${s.status}: ${s.count}`}
                className={`${statusColours[s.status] || 'bg-border'} transition-all`}
                style={{ width: `${s.pct}%` }}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {statusStats.map((s) => (
              <div key={s.status} className="rounded-2xl bg-surface-muted p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`w-2 h-2 rounded-full ${statusColours[s.status] || 'bg-border'}`}
                  />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {s.status}
                  </p>
                </div>
                <p className="text-xl font-black text-foreground">
                  {s.count}
                  <span className="text-[10px] text-muted-foreground font-bold ml-1">
                    {s.pct.toFixed(0)}%
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight mt-0.5">
                  {fmtMoney(s.revenue)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending fulfilment */}
        <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em]">
              Pending fulfilment
            </h2>
            <Link
              href="/admin/orders?status=processing"
              className="inline-flex items-center gap-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors"
            >
              View all <ArrowRight size={11} />
            </Link>
          </div>
          {topPending.length === 0 ? (
            <p className="text-muted-foreground font-bold text-sm">All caught up.</p>
          ) : (
            <ul className="space-y-4">
              {topPending.map((o) => {
                const customer = o.profiles;
                const name = customer
                  ? [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
                    customer.email
                  : 'Guest';
                return (
                  <li key={o.id} className="flex items-center gap-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="flex-1 min-w-0 hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors"
                    >
                      <p className="text-sm font-black text-foreground uppercase tracking-wider truncate">
                        #{o.id} · {name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                        {o.created_at
                          ? new Date(o.created_at).toLocaleDateString('en-NZ', {
                              day: 'numeric',
                              month: 'short',
                            })
                          : 'N/A'}
                        {' · '}
                        {fmtMoney(Number(o.total) || 0)}
                      </p>
                    </Link>
                    <OrderStatusSelect orderId={o.id} currentStatus={o.status || 'processing'} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Stock alert */}
        <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm">
          <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em] mb-6">
            Stock alerts
          </h2>
          {outOfStock.length === 0 && backorder.length === 0 ? (
            <p className="text-muted-foreground font-bold text-sm">All products in stock.</p>
          ) : (
            <ul className="space-y-3">
              {outOfStock.slice(0, 5).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2.5 bg-rose-50 rounded-2xl px-4 py-3"
                >
                  <AlertTriangle size={13} className="text-rose-500 shrink-0" />
                  <p className="text-sm font-black text-rose-700 uppercase tracking-wider truncate">
                    {p.name}
                  </p>
                  <span className="ml-auto text-[10px] font-black text-rose-500 uppercase">
                    Out of stock
                  </span>
                </li>
              ))}
              {backorder.slice(0, 5).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2.5 bg-amber-50 rounded-2xl px-4 py-3"
                >
                  <Package size={13} className="text-amber-500 shrink-0" />
                  <p className="text-sm font-black text-amber-700 uppercase tracking-wider truncate">
                    {p.name}
                  </p>
                  <span className="ml-auto text-[10px] font-black text-amber-500 uppercase">
                    Backorder
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors mt-4"
          >
            Manage products <ArrowRight size={11} />
          </Link>
        </section>

        {/* Coupon usage */}
        <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em]">
              Coupon usage (30d)
            </h2>
            <Link
              href="/admin/coupons"
              className="inline-flex items-center gap-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors"
            >
              Manage <ArrowRight size={11} />
            </Link>
          </div>
          {couponStats.size === 0 ? (
            <p className="text-muted-foreground font-bold text-sm">No coupons used yet.</p>
          ) : (
            <ul className="space-y-4">
              {[...couponStats.entries()].map(([code, stat]) => (
                <li key={code} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center">
                    <BadgePercent size={13} className="text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-foreground uppercase tracking-wider">
                      {code}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                      {stat.uses}× · {fmtMoney(stat.revenue)} in orders
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors mt-4"
          >
            <Users size={11} /> View customers
          </Link>
        </section>
      </div>
    </div>
  );
}
