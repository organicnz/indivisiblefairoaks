'use client';

import { Download } from 'lucide-react';

type ExportOrder = {
  id: number;
  created_at: string | null;
  status: string | null;
  customer: string;
  email: string | null;
  shipping: string;
  items: string;
  total: number | null;
  coupon: string | null;
};

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function OrdersExport({ orders }: { orders: ExportOrder[] }) {
  const handleExport = () => {
    const header = [
      'Order ID',
      'Date',
      'Status',
      'Customer',
      'Email',
      'Ship To',
      'Items',
      'Coupon',
      'Total (NZD)',
    ];
    const lines = orders.map((o) =>
      [
        String(o.id),
        o.created_at ? new Date(o.created_at).toISOString() : '',
        o.status || '',
        o.customer,
        o.email || '',
        o.shipping,
        o.items,
        o.coupon || '',
        Number(o.total || 0).toFixed(2),
      ]
        .map(escapeCell)
        .join(',')
    );

    const csv = [header.map(escapeCell).join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `indivisible-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:border-primary hover:text-secondary transition-colors"
    >
      <Download size={12} /> Export CSV ({orders.length})
    </button>
  );
}
