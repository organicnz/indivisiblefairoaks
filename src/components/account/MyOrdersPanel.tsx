import { formatDate, formatNZD, type MyOrder, statusStyle } from '@/types/orders';

export function MyOrdersPanel({ orders }: { orders: MyOrder[] }) {
  if (orders.length === 0) {
    return (
      <div className="bg-slate-50 p-16 rounded-3xl border border-dashed border-slate-200 text-center">
        <p className="text-slate-400 font-black uppercase tracking-widest text-sm">
          No past orders found.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="My orders">
      <div className="space-y-6">
        {orders.map((order) => (
          <article
            key={order.id}
            aria-label={`Order #${order.id}`}
            className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            {/* Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-6 items-start">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mb-1">
                  Order Placed
                </p>
                <time
                  dateTime={order.created_at ?? ''}
                  className="text-sm text-secondary font-black"
                >
                  {formatDate(order.created_at)}
                </time>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mb-1">
                  Total
                </p>
                <p className="text-sm text-primary font-black tabular-nums">
                  {formatNZD(order.total_amount)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mb-1">
                  Status
                </p>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusStyle(order.status)}`}
                >
                  {order.status ?? 'processing'}
                </span>
              </div>
              <div className="flex justify-end items-start">
                <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">
                  #{order.id}
                </p>
              </div>
            </div>

            {/* Line items */}
            <ul className="divide-y divide-slate-50 px-6 py-2" aria-label="Order items">
              {order.order_items.map((item, i) => (
                <li
                  key={item.product_name ?? `${order.id}-${i}`}
                  className="py-4 flex justify-between items-center group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-1.5 h-1.5 bg-primary rounded-full group-hover:scale-150 transition-transform"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-black text-secondary uppercase tracking-wider">
                        {item.product_name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        Qty: {item.quantity}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-secondary tabular-nums">
                    {formatNZD(item.total)}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
