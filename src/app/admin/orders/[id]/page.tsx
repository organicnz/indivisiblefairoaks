import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Package,
  ShoppingBag,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmailActions } from '@/components/admin/EmailActions';
import { FulfilmentEditor } from '@/components/admin/FulfilmentEditor';
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect';
import { requireAdmin } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Order #${id} — Admin · Indivisible Fair Oaks`,
    robots: { index: false, follow: false },
  };
}

const statusColours: Record<string, string> = {
  processing: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
  refunded: 'bg-slate-100 text-slate-600',
  'on-hold': 'bg-blue-100 text-blue-800',
};

const statusLabels: Record<string, string> = {
  processing: 'Processing',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  'on-hold': 'On Hold',
};

type Order = {
  id: number;
  created_at: string | null;
  status: string | null;
  total: number | null;
  currency: string | null;
  stripe_session_id: string | null;
  coupon_code: string | null;
  shipping_address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
  tracking_number: string | null;
  admin_notes: string | null;
  order_items: {
    id: number;
    product_name: string | null;
    quantity: number | null;
    unit_price: number | null;
  }[];
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { adminClient } = await requireAdmin();
  const { id } = await params;
  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const { data } = await adminClient
    .from('orders')
    .select(
      `id, created_at, status, total, currency, tracking_number, admin_notes,
       stripe_session_id, coupon_code,
       shipping_address,
       order_items ( id, product_name, quantity, unit_price ),
       profiles ( first_name, last_name, email )`
    )
    .eq('id', orderId)
    .single();

  if (!data) notFound();
  const order = data as unknown as Order;

  const customer = order.profiles;
  const name = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email
    : 'Guest';
  const addr = order.shipping_address as Record<string, string> | null;

  const stripeUrl = order.stripe_session_id
    ? `https://dashboard.stripe.com/payments/${order.stripe_session_id}`
    : null;
  const status = order.status || 'processing';

  return (
    <div>
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-secondary transition-colors mb-6"
      >
        <ArrowLeft size={12} /> Back to Orders
      </Link>

      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Package size={14} className="text-secondary" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Admin Panel
          </span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-secondary uppercase">
              Order #{order.id}
            </h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1.5">
              {order.created_at
                ? new Date(order.created_at).toLocaleString('en-NZ', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'N/A'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 ${statusColours[status] || statusColours.processing}`}
            >
              {statusLabels[status] || status}
            </span>
            <OrderStatusSelect orderId={order.id} currentStatus={status} />
          </div>
        </div>
        <div className="h-1.5 w-24 bg-primary mt-3" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Grand total */}
        <div className="bg-secondary rounded-3xl p-6 lg:col-span-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center">
              <ShoppingBag size={16} className="text-secondary" />
            </div>
            <div>
              <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">
                Order total
              </p>
              <p className="text-3xl font-black text-white mt-0.5">
                ${Number(order.total).toFixed(2)}
                <span className="text-xs text-white/40 font-bold ml-2">
                  {(order.currency || 'NZD').toUpperCase()}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">
                Payment method
              </p>
              <p className="text-sm text-white font-black mt-1 flex items-center gap-1.5">
                <CreditCard size={13} className="text-primary" />
                {order.stripe_session_id ? 'Stripe' : 'Unknown'}
              </p>
            </div>
            {stripeUrl && (
              <a
                href={stripeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-primary transition-colors"
              >
                <ExternalLink size={11} /> Stripe Dashboard
              </a>
            )}
          </div>
        </div>

        {/* Customer */}
        <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <User size={14} className="text-primary" />
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
              Customer
            </h2>
          </div>
          <p className="text-lg font-black text-secondary uppercase tracking-tight">{name}</p>
          {customer?.email && (
            <p className="text-sm text-slate-500 font-bold mt-1 flex items-center gap-2">
              <Mail size={12} className="text-slate-300" /> {customer.email}
            </p>
          )}
          <EmailActions email={customer?.email ?? null} />
          <span
            className={`inline-block mt-3 text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1 ${customer ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}
          >
            {customer ? 'Registered' : 'Guest checkout'}
          </span>
        </section>

        {/* Shipping */}
        <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={14} className="text-primary" />
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
              Shipping address
            </h2>
          </div>
          {addr && Object.keys(addr).length > 0 ? (
            <address className="not-italic text-sm text-slate-600 font-bold leading-relaxed">
              {addr.line1 ?? addr.address_1}
              {(addr.line2 ?? addr.address_2) && (
                <span className="block">{addr.line2 ?? addr.address_2}</span>
              )}
              <span className="block">
                {[addr.city, addr.state].filter(Boolean).join(', ')}
                {(addr.postal_code ?? addr.postcode) ? ` ${addr.postal_code ?? addr.postcode}` : ''}
              </span>
              <span className="flex items-center gap-2 mt-1">
                <Globe size={12} className="text-slate-300" /> {addr.country}
              </span>
            </address>
          ) : (
            <p className="not-italic text-sm text-slate-400 font-bold">No shipping address.</p>
          )}
        </section>

        {/* Order reference */}
        <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={14} className="text-primary" />
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
              Order reference
            </h2>
          </div>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400 font-bold uppercase tracking-wider text-[10px] pt-0.5">
                ID
              </dt>
              <dd className="text-secondary font-black">#{order.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400 font-bold uppercase tracking-wider text-[10px] pt-0.5">
                Session
              </dt>
              <dd className="text-secondary font-black text-[11px] truncate max-w-[180px]">
                {order.stripe_session_id ?? '—'}
              </dd>
            </div>
            {order.coupon_code && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400 font-bold uppercase tracking-wider text-[10px] pt-0.5">
                  Coupon
                </dt>
                <dd className="text-secondary font-black text-[11px]">{order.coupon_code}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      {/* Line items */}
      <section className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
            Items ({order.order_items.length})
          </h2>
        </div>
        <ul className="px-8 py-4 divide-y divide-slate-50">
          {order.order_items.map((item) => (
            <li key={item.id} className="py-4 flex justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                  <ShoppingBag size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-black text-secondary uppercase tracking-wider">
                    {item.product_name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                    Quantity: {item.quantity}
                  </p>
                </div>
              </div>
              <p className="text-sm font-black text-secondary">
                ${Number(item.unit_price).toFixed(2)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Fulfilment */}
      <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Package size={14} className="text-primary" />
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
            Fulfilment
          </h2>
          {order.tracking_number && (
            <span className="ml-2 text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1 bg-emerald-100 text-emerald-800">
              Shipped
            </span>
          )}
        </div>
        <FulfilmentEditor
          orderId={order.id}
          trackingNumber={order.tracking_number}
          adminNotes={order.admin_notes}
        />
      </section>
    </div>
  );
}
