export type OrderItem = {
  id?: number;
  product_name: string | null;
  quantity: number | null;
  unit_price: number | null;
};

export type ShippingAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export type AdminOrder = {
  id: number;
  created_at: string | null;
  status: string | null;
  total: number | null;
  currency: string | null;
  stripe_session_id: string | null;
  shipping_address: ShippingAddress | null;
  billing_address: ShippingAddress | null;
  order_items: OrderItem[];
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
};

export type MyOrder = {
  id: number;
  created_at: string | null;
  status: string | null;
  total: number | null;
  order_items: OrderItem[];
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function formatNZD(amount: number | string | null): string {
  return `$${Number(amount ?? 0).toFixed(2)}`;
}

export function formatAddress(addr: ShippingAddress | Record<string, string> | null): string {
  if (!addr) return 'No address';
  const a = addr as Record<string, string>;
  const line1 = a.line1 ?? a.address_1;
  const line2 = a.line2 ?? a.address_2;
  const postal = a.postal_code ?? a.postcode;
  return [line1, line2, a.city, postal, a.country].filter(Boolean).join(', ');
}

export function formatDate(
  iso: string | null,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-US', opts);
}

export const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100   text-rose-800',
  refunded: 'bg-slate-100  text-slate-600',
  'on-hold': 'bg-blue-100   text-blue-800',
  processing: 'bg-amber-100  text-amber-800',
};

export function statusStyle(status: string | null): string {
  return STATUS_STYLES[status ?? ''] ?? STATUS_STYLES.processing;
}
