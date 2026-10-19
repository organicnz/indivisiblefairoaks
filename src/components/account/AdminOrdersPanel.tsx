import { ExternalLink, MapPin, Package, ShoppingBag, TrendingUp, User } from 'lucide-react';
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect';
import { DataPoint } from '@/components/ui/DataPoint';
import { CURRENCY_CODE, formatPrice } from '@/config/commerce';
import { type AdminOrder, formatAddress, formatDate } from '@/types/orders';

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: React.ReactNode;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-secondary rounded-3xl p-6 border border-white/10 shadow-xs">
      <Icon size={16} className="text-primary-on-dark mb-3" aria-hidden="true" />
      <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">
        {label}
      </p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order row
// ---------------------------------------------------------------------------
function OrderCard({ order }: { order: AdminOrder }) {
  const cust = order.profiles;
  const billing = (order.billing_address ?? {}) as Record<string, string>;
  const addrName = [billing.first_name, billing.last_name].filter(Boolean).join(' ');
  const name = cust
    ? [cust.first_name, cust.last_name].filter(Boolean).join(' ') || cust.email
    : addrName || 'Guest';
  const email = cust?.email ?? billing.email ?? null;
  const stripeUrl = order.stripe_session_id
    ? `https://dashboard.stripe.com/payments/${order.stripe_session_id}`
    : null;

  return (
    <article
      aria-label={`Order #${order.id}`}
      className="bg-surface-card border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
    >
      {/* Header grid */}
      <div className="bg-surface-muted px-6 py-5 border-b border-border grid grid-cols-2 md:grid-cols-5 gap-4 items-start">
        {/* Order # */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
            <DataPoint as="span" name="account.admin.orders_title">
              Order
            </DataPoint>
          </p>
          <p className="text-sm text-foreground font-black">#{order.id}</p>
          <time
            dateTime={order.created_at ?? ''}
            className="text-[10px] text-muted-foreground mt-0.5 block"
          >
            {formatDate(order.created_at, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </div>

        {/* Customer */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
            <DataPoint as="span" name="account.admin.customer">
              Customer
            </DataPoint>
          </p>
          <div className="flex items-center gap-1.5">
            <User size={11} className="text-muted-foreground shrink-0" aria-hidden="true" />
            <p className="text-sm text-foreground font-black truncate">{name}</p>
          </div>
          {email && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{email}</p>}
        </div>

        {/* Ship to */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
            <DataPoint as="span" name="account.admin.ship_to">
              Ship To
            </DataPoint>
          </p>
          <div className="flex items-start gap-1.5">
            <MapPin
              size={11}
              className="text-muted-foreground shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <address className="text-[11px] text-muted-foreground font-bold leading-tight not-italic">
              {formatAddress(order.shipping_address)}
            </address>
          </div>
        </div>

        {/* Total */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
            <DataPoint as="span" name="account.admin.total">
              Total
            </DataPoint>
          </p>
          <p className="text-lg text-primary dark:text-primary-on-dark font-black">
            {formatPrice(order.total)}
            <span className="text-[10px] text-muted-foreground font-bold ml-1">
              {(order.currency ?? CURRENCY_CODE).toUpperCase()}
            </span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 items-end">
          <OrderStatusSelect orderId={order.id} currentStatus={order.status ?? 'processing'} />
          {stripeUrl && (
            <a
              href={stripeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary dark:hover:text-primary-on-dark transition-colors"
            >
              <ExternalLink size={11} aria-hidden="true" />
              Stripe
            </a>
          )}
        </div>
      </div>

      {/* Line items */}
      <ul className="divide-y divide-border px-6 py-2" aria-label="Order items">
        {order.order_items.map((item, i) => (
          <li
            key={item.id ?? `${order.id}-${i}`}
            className="py-3 flex justify-between items-center group"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-1.5 h-1.5 bg-primary dark:bg-primary-on-dark rounded-full group-hover:scale-150 transition-transform"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-black text-foreground uppercase tracking-wider">
                  {item.product_name}
                </p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase">
                  Qty: {item.quantity}
                </p>
              </div>
            </div>
            <p className="text-sm font-black text-foreground tabular-nums">
              {formatPrice(item.unit_price)}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
export function AdminOrdersPanel({ orders }: { orders: AdminOrder[] }) {
  const totalRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const processing = orders.filter((o) => o.status === 'processing').length;
  const completed = orders.filter((o) => o.status === 'completed').length;

  return (
    <section aria-label="All orders">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard
          label={
            <DataPoint as="span" name="account.admin.stat_total">
              Total Orders
            </DataPoint>
          }
          value={orders.length}
          icon={ShoppingBag}
        />
        <StatCard
          label={
            <DataPoint as="span" name="account.admin.stat_processing">
              Processing
            </DataPoint>
          }
          value={processing}
          icon={Package}
        />
        <StatCard
          label={
            <DataPoint as="span" name="account.admin.stat_completed">
              Completed
            </DataPoint>
          }
          value={completed}
          icon={TrendingUp}
        />
        <StatCard
          label={
            <DataPoint as="span" name="account.admin.stat_revenue">
              Revenue
            </DataPoint>
          }
          value={formatPrice(totalRevenue)}
          icon={TrendingUp}
        />
      </div>

      {/* Orders */}
      {orders.length === 0 ? (
        <EmptyState
          message={
            <DataPoint as="span" name="account.admin.empty_msg">
              No orders yet.
            </DataPoint>
          }
          hint={
            <DataPoint as="span" name="account.admin.empty_hint">
              Orders will appear here once a store is connected.
            </DataPoint>
          }
        />
      ) : (
        <ul className="space-y-6">
          {orders.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyState({ message, hint }: { message: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="bg-surface-muted p-16 rounded-3xl border border-dashed border-border text-center">
      <Package size={32} className="mx-auto mb-3 text-muted-foreground/60" aria-hidden="true" />
      <p className="text-muted-foreground font-black uppercase tracking-widest text-sm">
        {message}
      </p>
      {hint && <p className="mt-2 text-xs font-bold text-muted-foreground">{hint}</p>}
    </div>
  );
}
