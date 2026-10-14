import {
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  TrendingUp,
  User,
} from 'lucide-react';
import Link from 'next/link';
import {
  BulkOrderBar,
  BulkOrderProvider,
  OrderCheckbox,
} from '@/components/admin/BulkOrderActions';
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect';
import { OrdersExport } from '@/components/admin/OrdersExport';
import { CURRENCY_CODE, formatPrice } from '@/config/commerce';
import { requireAdmin } from '@/lib/admin-auth';
import type { createAdminClient } from '@/lib/supabase-server';
import { formatAddress, formatDate, type AdminOrder as Order } from '@/types/orders';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export const metadata = {
  title: 'Orders — Admin · Indivisible Fair Oaks',
  robots: { index: false, follow: false },
};

// `Order` is the canonical `AdminOrder` (`src/types/orders.ts`). The
// directory select omits billing/coupon columns the type allows as optional,
// so the cast below stays sound without re-declaring the shape here.

const STATUS_FILTERS = ['all', 'processing', 'completed', 'cancelled', 'refunded', 'on-hold'];
const RANGE_FILTERS = ['30d', '90d', '180d', 'all'] as const;
type RangeKey = (typeof RANGE_FILTERS)[number];
const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = {
  '30d': 30,
  '90d': 90,
  '180d': 180,
};
const PAGE_SIZE = 50;
const EXPORT_LIMIT = 2000;

const ORDER_SELECT = `id, created_at, status, total, currency,
  stripe_session_id, coupon_code,
  shipping_address,
  order_items ( id, product_name, quantity, unit_price ),
  profiles ( first_name, last_name, email )`;

const LIGHT_SELECT = 'id, created_at, status, total';

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

type OrderFilters = {
  status: string;
  range: RangeKey;
  search: string;
};

function buildFilters(searchParams: { status?: string; q?: string; range?: string }): OrderFilters {
  const status = STATUS_FILTERS.includes(searchParams.status || 'all')
    ? searchParams.status || 'all'
    : 'all';
  const range: RangeKey = RANGE_FILTERS.includes(searchParams.range as RangeKey)
    ? (searchParams.range as RangeKey)
    : 'all';
  // Strip PostgREST metacharacters so user input can never break the query
  const search = (searchParams.q || '')
    .trim()
    .replace(/[*,"()\\]/g, '')
    .slice(0, 100);
  return { status, range, search };
}

/** Base orders query carrying only the status + date-range filters. */
function buildBase(client: AdminClient, filters: OrderFilters) {
  let q = client.from('orders').select('id');
  if (filters.range !== 'all') {
    const cutoff = new Date(
      Date.now() - RANGE_DAYS[filters.range] * 24 * 60 * 60 * 1000
    ).toISOString();
    q = q.gte('created_at', cutoff);
  }
  if (filters.status !== 'all') {
    q = q.eq('status', filters.status);
  }
  return q;
}

/**
 * PostgREST cannot express OR across embedded resources, so search runs as
 * several targeted exists-queries (item name, customer email/name, coupon,
 * order id) whose matching ids are unioned. Sorted by created_at desc.
 */
async function searchOrderIds(
  base: ReturnType<typeof buildBase>,
  search: string
): Promise<number[]> {
  type IdQuery = PromiseLike<{ data: { id: number; created_at: string | null }[] | null }>;
  const jobs: IdQuery[] = [];
  if (/^\d+$/.test(search)) {
    jobs.push(base.eq('id', Number(search)).select(LIGHT_SELECT));
  }
  jobs.push(
    base
      .select('id, created_at, order_items!inner(product_name)')
      .filter('order_items.product_name', 'ilike', `%${search}%`),
    base
      .select('id, created_at, profiles!inner(email)')
      .filter('profiles.email', 'ilike', `%${search}%`),
    base
      .select('id, created_at, profiles!inner(first_name)')
      .filter('profiles.first_name', 'ilike', `%${search}%`),
    base
      .select('id, created_at, profiles!inner(last_name)')
      .filter('profiles.last_name', 'ilike', `%${search}%`),
    base.select(LIGHT_SELECT).or(`coupon_code.ilike.*${search}*`)
  );

  const results = await Promise.all(jobs);
  const byId = new Map<number, string | null>();
  for (const r of results) {
    for (const row of (r.data || []) as { id: number; created_at: string | null }[]) {
      if (!byId.has(row.id)) byId.set(row.id, row.created_at);
    }
  }
  return [...byId.keys()].sort((a, b) =>
    String(byId.get(b) || '').localeCompare(String(byId.get(a) || ''))
  );
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; range?: string; page?: string }>;
}) {
  const { adminClient } = await requireAdmin();
  const params = await searchParams;
  const filters = buildFilters(params);

  const pageParam = Number(params.page);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const buildHref = (overrides: { status?: string; range?: string; page?: number }) => {
    const next = new URLSearchParams();
    const status = overrides.status ?? filters.status;
    const range = overrides.range ?? filters.range;
    if (status !== 'all') next.set('status', status);
    if (range !== 'all') next.set('range', range);
    if (filters.search) next.set('q', filters.search);
    const p = overrides.page ?? page;
    if (p > 1) next.set('page', String(p));
    const s = next.toString();
    return s ? `/admin/orders?${s}` : '/admin/orders';
  };

  const base = buildBase(adminClient, filters);

  // Full filtered set (light columns) for stats + total count
  const { data: lightData } = await base.select(LIGHT_SELECT).order('created_at', {
    ascending: false,
  });
  const lightOrders = (lightData || []) as {
    id: number;
    created_at: string | null;
    status: string | null;
    total: number | null;
  }[];

  const ids =
    filters.search.length > 0
      ? await searchOrderIds(base, filters.search)
      : lightOrders.map((o) => o.id);

  const total = ids.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageIds = ids.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const { data: pageRows } =
    pageIds.length > 0
      ? await adminClient.from('orders').select(ORDER_SELECT).in('id', pageIds)
      : { data: [] as unknown[] };
  const orders = ((pageRows || []) as Order[]).sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  );

  // Stats over the full filtered set (search included)
  const statsOrders =
    filters.search.length > 0 ? lightOrders.filter((o) => ids.includes(o.id)) : lightOrders;
  const totalRevenue = statsOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const processing = statsOrders.filter((o) => o.status === 'processing').length;
  const completed = statsOrders.filter((o) => o.status === 'completed').length;

  // Export dataset: full filtered set (capped)
  const exportQuery = base.order('created_at', { ascending: false });
  const { data: exportData } = filters.search.length
    ? await adminClient
        .from('orders')
        .select(ORDER_SELECT)
        .in('id', ids.length ? ids.slice(0, EXPORT_LIMIT) : [0])
    : await exportQuery.limit(EXPORT_LIMIT);
  const exportOrders = (exportData || []) as Order[];

  return (
    <div>
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Package size={14} className="text-foreground" />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
            Admin Panel
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">Orders</h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Orders', value: total.toLocaleString(), icon: ShoppingBag },
          { label: 'Processing', value: String(processing), icon: Package },
          { label: 'Completed', value: String(completed), icon: TrendingUp },
          { label: 'Total Revenue', value: formatPrice(totalRevenue), icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-secondary rounded-3xl p-6">
            <Icon size={16} className="text-primary-on-dark mb-3" />
            <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">
              {label}
            </p>
            <p className="text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <nav className="flex items-center gap-2 overflow-x-auto" aria-label="Order status filter">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={buildHref({ status: s })}
              className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${
                filters.status === s
                  ? 'bg-primary text-secondary'
                  : 'bg-surface-muted text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              {s}
            </Link>
          ))}
        </nav>
        <nav className="flex items-center gap-2" aria-label="Order date range">
          {RANGE_FILTERS.map((r) => (
            <Link
              key={r}
              href={buildHref({ range: r })}
              className={`px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${
                filters.range === r
                  ? 'bg-secondary text-primary dark:text-primary-on-dark'
                  : 'bg-surface-muted text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              {r === 'all' ? 'All time' : `Last ${r}`}
            </Link>
          ))}
        </nav>
        <form
          action="/admin/orders"
          method="get"
          className="flex items-center gap-2 bg-surface-muted rounded-full px-4 py-2 ml-auto"
        >
          <Search size={13} className="text-muted-foreground" />
          <input
            name="q"
            defaultValue={filters.search}
            placeholder="Search order, customer, item, coupon…"
            className="bg-transparent text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground w-56"
          />
          {filters.status !== 'all' && <input type="hidden" name="status" value={filters.status} />}
          {filters.range !== 'all' && <input type="hidden" name="range" value={filters.range} />}
        </form>
        <OrdersExport
          orders={exportOrders.map((order) => {
            const customer = order.profiles;
            return {
              id: order.id,
              created_at: order.created_at,
              status: order.status,
              customer: customer
                ? [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
                  customer.email ||
                  'Guest'
                : 'Guest',
              email: customer?.email || null,
              shipping: formatAddress(order.shipping_address),
              items: order.order_items
                .map((i) => `${i.product_name || 'Item'} x${i.quantity || 1}`)
                .join('; '),
              total: order.total,
              coupon: order.coupon_code ?? null,
            };
          })}
        />
      </div>

      {/* Pagination (top) */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
          {total.toLocaleString()} order{total === 1 ? '' : 's'}
          {total > PAGE_SIZE && ` · showing ${PAGE_SIZE} per page`}
        </p>
        {totalPages > 1 && (
          <nav className="flex items-center gap-3" aria-label="Pagination">
            {safePage > 1 ? (
              <Link
                href={buildHref({ page: safePage - 1 })}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-surface-muted text-muted-foreground hover:bg-surface-muted hover:text-foreground text-[11px] font-black uppercase tracking-widest transition-colors"
              >
                <ChevronLeft size={12} /> Prev
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-surface-muted text-muted-foreground text-[11px] font-black uppercase tracking-widest cursor-not-allowed">
                <ChevronLeft size={12} /> Prev
              </span>
            )}
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
              Page {safePage} of {totalPages}
            </span>
            {safePage < totalPages ? (
              <Link
                href={buildHref({ page: safePage + 1 })}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-surface-muted text-muted-foreground hover:bg-surface-muted hover:text-foreground text-[11px] font-black uppercase tracking-widest transition-colors"
              >
                Next <ChevronRight size={12} />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-surface-muted text-muted-foreground text-[11px] font-black uppercase tracking-widest cursor-not-allowed">
                Next <ChevronRight size={12} />
              </span>
            )}
          </nav>
        )}
      </div>

      {/* Orders */}
      <BulkOrderProvider>
        <div className="flex items-start gap-2 mb-6">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <BulkOrderBar orderIds={orders.map((o) => o.id)} />
          </div>
        </div>
        <div className="space-y-6">
          {orders.length === 0 ? (
            <div className="bg-surface-muted p-16 rounded-3xl border border-dashed border-border text-center">
              <p className="text-muted-foreground font-black uppercase tracking-widest text-sm">
                {total === 0 ? 'No orders yet.' : 'No orders match the filter.'}
              </p>
              {total === 0 && (
                <p className="mt-2 text-xs font-bold text-muted-foreground">
                  Orders will appear here once a store is connected.
                </p>
              )}
            </div>
          ) : (
            orders.map((order) => {
              const customer = order.profiles;
              const name = customer
                ? [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
                  customer.email
                : 'Guest';
              const shippingAddr = formatAddress(order.shipping_address);
              const stripeUrl = order.stripe_session_id
                ? `https://dashboard.stripe.com/payments/${order.stripe_session_id}`
                : null;

              return (
                <div
                  key={order.id}
                  className="bg-surface-card border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Order header */}
                  <div className="bg-surface-muted px-8 py-6 border-b border-border grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                    <div className="flex items-center gap-3">
                      <OrderCheckbox orderId={order.id} />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                          Order
                        </p>
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-sm text-foreground font-black hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors"
                        >
                          #{order.id}{' '}
                          <ExternalLink size={10} className="inline text-muted-foreground" />
                        </Link>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDate(order.created_at, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        {order.coupon_code && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 bg-primary/20 text-foreground">
                            <BadgePercent size={9} /> {order.coupon_code}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                        Customer
                      </p>
                      <div className="flex items-center gap-1.5">
                        <User size={11} className="text-muted-foreground shrink-0" />
                        <p className="text-sm text-foreground font-black truncate">{name}</p>
                      </div>
                      {customer?.email && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {customer.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                        Ship To
                      </p>
                      <div className="flex items-start gap-1.5">
                        <MapPin size={11} className="text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-[11px] text-muted-foreground font-bold leading-tight">
                          {shippingAddr}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                        Total
                      </p>
                      <p className="text-lg text-primary dark:text-primary-on-dark font-black">
                        {formatPrice(order.total)}
                        <span className="text-[10px] text-muted-foreground font-bold ml-1">
                          {(order.currency || CURRENCY_CODE).toUpperCase()}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                      <OrderStatusSelect
                        orderId={order.id}
                        currentStatus={order.status || 'processing'}
                      />
                      {stripeUrl && (
                        <a
                          href={stripeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors"
                        >
                          <ExternalLink size={11} /> Stripe
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Line items */}
                  <div className="px-8 py-5">
                    <ul className="divide-y divide-border">
                      {order.order_items.map((item) => (
                        <li key={item.id} className="py-3 flex justify-between items-center group">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full group-hover:scale-150 transition-transform" />
                            <div>
                              <p className="text-sm font-black text-foreground uppercase tracking-wider">
                                {item.product_name}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                                Qty: {item.quantity}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-black text-foreground">
                            {formatPrice(item.unit_price)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </BulkOrderProvider>

      {/* Pagination (bottom) */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3 mt-10" aria-label="Pagination">
          {safePage > 1 ? (
            <Link
              href={buildHref({ page: safePage - 1 })}
              className="inline-flex items-center gap-1 px-5 py-2.5 rounded-full bg-surface-muted text-muted-foreground hover:bg-surface-muted hover:text-foreground text-[11px] font-black uppercase tracking-widest transition-colors"
            >
              <ChevronLeft size={12} /> Prev
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 px-5 py-2.5 rounded-full bg-surface-muted text-muted-foreground text-[11px] font-black uppercase tracking-widest cursor-not-allowed">
              <ChevronLeft size={12} /> Prev
            </span>
          )}
          <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
            Page {safePage} of {totalPages}
          </span>
          {safePage < totalPages ? (
            <Link
              href={buildHref({ page: safePage + 1 })}
              className="inline-flex items-center gap-1 px-5 py-2.5 rounded-full bg-surface-muted text-muted-foreground hover:bg-surface-muted hover:text-foreground text-[11px] font-black uppercase tracking-widest transition-colors"
            >
              Next <ChevronRight size={12} />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 px-5 py-2.5 rounded-full bg-surface-muted text-muted-foreground text-[11px] font-black uppercase tracking-widest cursor-not-allowed">
              Next <ChevronRight size={12} />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
