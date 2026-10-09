import { CURRENCY_CODE } from '@/config/commerce';

/**
 * Provider seam for the orders table.
 *
 * There are no live orders, so this module is a contract waiting for its first
 * caller rather than a refactor of a hot path: when a WooCommerce store is
 * linked, its fetcher calls `mapWooOrderToRow()` and inserts the result, and
 * nothing else changes. Stripe keeps flowing through the webhook/reconcile
 * scripts, whose inline shaping this module mirrors (not imports — the webhook
 * is Deno and the scripts are standalone, so neither can share it; the tests
 * pin the behaviours to agree).
 *
 * Two rules hold for every provider:
 *
 * - Currency is the stored code uppercased, or `CURRENCY_CODE` when the payload
 *   predates currency capture. A fallback to any other currency is how the
 *   storefront once charged NZD beside USD structured data.
 * - Addresses are stored with the provider's own keys. WooCommerce writes
 *   `address_1`/`postcode`; `formatAddress()` in `src/types/orders.ts` already
 *   reads both spellings, so the mapper does not translate them.
 */

export const ORDER_SOURCES = ['stripe', 'woocommerce', 'manual'] as const;

export type OrderSource = (typeof ORDER_SOURCES)[number];

/** The `orders_source_check` constraint, as a predicate. */
export function isOrderSource(value: unknown): value is OrderSource {
  return typeof value === 'string' && (ORDER_SOURCES as readonly string[]).includes(value);
}

/**
 * A stored currency code, uppercased, defaulting to the storefront currency.
 *
 * Accepts whatever a provider hands over (string, null, absent) because both
 * Stripe sessions and Woo payloads leave it out on older records.
 */
export function normalizeOrderCurrency(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim().toUpperCase();
  return CURRENCY_CODE;
}

export interface OrderAddressInput {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  [key: string]: unknown;
}

/** The row shape every provider mapper returns (columns of `orders`). */
export interface MappedOrderRow {
  source: OrderSource;
  external_id: string | null;
  currency: string;
  total: number;
  status: string;
  billing_address: Record<string, unknown> | null;
  shipping_address: Record<string, unknown> | null;
}

function splitName(fullName: string | null | undefined): {
  first_name: string | null;
  last_name: string | null;
} {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: null, last_name: null };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') || null };
}

function compact<T extends Record<string, unknown>>(obj: T): T | null {
  const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '');
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : null;
}

function toDollars(cents: number | null | undefined): number {
  return (cents ?? 0) / 100;
}

/** Minimal Stripe Checkout Session shape — only what the mapping reads. */
export interface StripeSessionLike {
  id: string;
  currency?: string | null;
  amount_total?: number | null;
  customer_details?: {
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    address?: Record<string, unknown> | null;
  } | null;
  shipping_details?: {
    name?: string | null;
    address?: Record<string, unknown> | null;
  } | null;
}

/**
 * A paid Stripe session into an `orders` row.
 *
 * Mirrors `buildAddresses()` in the webhook edge function and
 * `reconcile_orders.mjs`: guest orders carry email, name and phone on the
 * billing payload so fulfilment never loses the buyer.
 */
export function mapStripeSessionToRow(session: StripeSessionLike): MappedOrderRow {
  const cust = session.customer_details ?? {};
  const ship = session.shipping_details ?? {};
  const billing: OrderAddressInput = {
    ...cust.address,
    ...splitName(cust.name ?? ship.name),
    ...(cust.phone ? { phone: cust.phone } : {}),
    ...(cust.email ? { email: cust.email } : {}),
  };
  const shipping: OrderAddressInput = {
    ...ship.address,
    ...splitName(ship.name),
    ...(cust.email && !cust.name && !ship.name ? { email: cust.email } : {}),
  };
  return {
    source: 'stripe',
    external_id: null,
    currency: normalizeOrderCurrency(session.currency),
    total: toDollars(session.amount_total),
    status: 'processing',
    billing_address: compact(billing),
    shipping_address: compact(shipping),
  };
}

/** WooCommerce REST API v3 address shape — stored verbatim (see module note). */
export interface WooAddressLike {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

/** Minimal WooCommerce REST API v3 order shape — only what the mapping reads. */
export interface WooOrderLike {
  id: number;
  status?: string;
  currency?: string;
  /** Decimal string in store currency, e.g. `"42.50"`. */
  total?: string;
  billing?: WooAddressLike | null;
  shipping?: WooAddressLike | null;
  line_items?: { name?: string; quantity?: number; total?: string }[] | null;
}

/**
 * WooCommerce statuses onto the chapter's order statuses. The column is
 * unconstrained TEXT, so known-overlapping values pass through; only the two
 * with no local meaning are folded.
 */
export function mapWooStatus(status: string | null | undefined): string {
  if (status === 'failed' || status === 'trash') return 'cancelled';
  return status?.trim() || 'pending';
}

/**
 * A WooCommerce order into an `orders` row.
 *
 * Totals arrive as decimal strings in store currency (already dollars, unlike
 * Stripe's cents). A non-numeric total maps to zero rather than NaN — a NaN
 * total renders as "NaN" and sorts unpredictably, while zero is visibly wrong
 * in a way an organiser reports.
 */
export function mapWooOrderToRow(order: WooOrderLike): MappedOrderRow {
  const total = Number(order.total ?? 0);
  return {
    source: 'woocommerce',
    external_id: String(order.id),
    currency: normalizeOrderCurrency(order.currency),
    total: Number.isFinite(total) ? total : 0,
    status: mapWooStatus(order.status),
    billing_address: order.billing ? { ...order.billing } : null,
    shipping_address: order.shipping ? { ...order.shipping } : null,
  };
}
