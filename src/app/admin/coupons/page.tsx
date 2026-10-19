import { BadgePercent } from 'lucide-react';
import { CouponCreator, CouponDelete } from '@/components/admin/CouponCreator';
import { CouponEditor } from '@/components/admin/CouponEditor';
import { DataPoint } from '@/components/ui/DataPoint';
import { formatPrice } from '@/config/commerce';
import { requireAdmin } from '@/lib/admin-auth';
import { getDataPoints } from '@/lib/queries/civic';
import { formatDate } from '@/types/orders';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export const metadata = {
  title: 'Coupons / Discounts — Admin · Indivisible Fair Oaks',
  robots: { index: false, follow: false },
};

type Coupon = {
  id: number;
  code: string;
  discount_type: string | null;
  amount: number | null;
  expiry_date: string | null;
};

type CouponUsage = {
  coupon_code: string;
  total: number | null;
};

export default async function AdminCouponsPage() {
  const { adminClient } = await requireAdmin();

  const [{ data: coupons }, { data: couponUsage }, dataPoints] = await Promise.all([
    adminClient
      .from('coupons')
      .select('id, code, discount_type, amount, expiry_date')
      .order('code'),
    adminClient
      .from('orders')
      .select('coupon_code, total')
      .not('coupon_code', 'is', null)
      .limit(500),
    getDataPoints('admin'),
  ]);

  const rows = (coupons || []) as Coupon[];
  const usage = (couponUsage || []) as CouponUsage[];
  // oxlint-disable-next-line react/purity -- async RSC: evaluated once per server request, never re-rendered
  const now = Date.now();

  const usageByCode = new Map<string, { uses: number; revenue: number }>();
  for (const u of usage) {
    const stat = usageByCode.get(u.coupon_code) || { uses: 0, revenue: 0 };
    stat.uses += 1;
    stat.revenue += Number(u.total) || 0;
    usageByCode.set(u.coupon_code, stat);
  }
  const maxUses = Math.max(0, ...[...usageByCode.values()].map((s) => s.uses));
  const expiryNeverLabel = dataPoints['admin.coupons.expiry_never'] || 'Never';

  return (
    <div>
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <BadgePercent size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
            <DataPoint as="span" name="admin.panel.eyebrow" initialData={dataPoints}>
              Admin Panel
            </DataPoint>
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">
          <DataPoint as="span" name="admin.coupons.title" initialData={dataPoints}>
            Coupons
          </DataPoint>
        </h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
        <p className="mt-4 text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
          {rows.length} promo codes
        </p>
      </div>

      <CouponCreator />

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="bg-surface-muted p-16 rounded-3xl border border-dashed border-border text-center">
            <p className="text-muted-foreground font-black uppercase tracking-widest text-sm">
              <DataPoint as="span" name="admin.coupons.empty" initialData={dataPoints}>
                No coupons yet. Create one above.
              </DataPoint>
            </p>
          </div>
        ) : (
          rows.map((c) => {
            const expired = c.expiry_date && new Date(c.expiry_date).getTime() < now;
            return (
              <div
                key={c.id}
                className="bg-surface-card border border-border rounded-3xl overflow-hidden shadow-sm"
              >
                <div className="px-8 py-5 grid grid-cols-2 md:grid-cols-6 gap-4 items-center">
                  <div>
                    <p className="text-sm font-black text-foreground uppercase tracking-wider">
                      {c.code}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-bold mt-0.5">
                      #{c.id}
                      {expired && (
                        <span className="ml-2 text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                          <DataPoint
                            as="span"
                            name="admin.coupons.expired_badge"
                            initialData={dataPoints}
                          >
                            Expired
                          </DataPoint>
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                      <DataPoint
                        as="span"
                        name="admin.coupons.discount_label"
                        initialData={dataPoints}
                      >
                        Discount
                      </DataPoint>
                    </p>
                    <p className="text-lg text-primary dark:text-primary-on-dark font-black">
                      {c.discount_type === 'percent' ? `${c.amount}%` : formatPrice(c.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                      <DataPoint
                        as="span"
                        name="admin.coupons.expiry_label"
                        initialData={dataPoints}
                      >
                        Expiry
                      </DataPoint>
                    </p>
                    <p
                      className={`text-sm font-black ${
                        expired ? 'text-rose-500' : 'text-foreground'
                      }`}
                    >
                      {c.expiry_date ? formatDate(c.expiry_date) : expiryNeverLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                      <DataPoint as="span" name="admin.coupons.used_label" initialData={dataPoints}>
                        Used
                      </DataPoint>
                    </p>
                    <p className="text-sm font-black text-foreground">
                      {usageByCode.get(c.code)?.uses ?? 0}×
                    </p>
                    <div className="mt-1.5 h-1 w-20 bg-surface-muted dark:bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary dark:bg-primary-on-dark rounded-full"
                        style={{
                          width: `${Math.round(((usageByCode.get(c.code)?.uses ?? 0) / Math.max(maxUses, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                      <DataPoint
                        as="span"
                        name="admin.coupons.revenue_label"
                        initialData={dataPoints}
                      >
                        Order revenue
                      </DataPoint>
                    </p>
                    <p className="text-sm font-black text-foreground">
                      {formatPrice(usageByCode.get(c.code)?.revenue ?? 0)}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <CouponDelete id={c.id} code={c.code} />
                  </div>
                </div>
                <CouponEditor
                  id={c.id}
                  code={c.code}
                  discountType={c.discount_type}
                  amount={c.amount}
                  expiryDate={c.expiry_date}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
