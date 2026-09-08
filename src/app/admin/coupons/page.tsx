import { BadgePercent } from 'lucide-react';
import { CouponCreator, CouponDelete } from '@/components/admin/CouponCreator';
import { CouponEditor } from '@/components/admin/CouponEditor';
import { requireAdmin } from '@/lib/admin-auth';

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

  const [{ data: coupons }, { data: couponUsage }] = await Promise.all([
    adminClient
      .from('coupons')
      .select('id, code, discount_type, amount, expiry_date')
      .order('code'),
    adminClient
      .from('orders')
      .select('coupon_code, total')
      .not('coupon_code', 'is', null)
      .limit(500),
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

  return (
    <div>
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <BadgePercent size={14} className="text-secondary" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Admin Panel
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-secondary uppercase">Coupons</h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
        <p className="mt-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
          {rows.length} promo codes
        </p>
      </div>

      <CouponCreator />

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="bg-slate-50 p-16 rounded-3xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-black uppercase tracking-widest text-sm">
              No coupons yet. Create one above.
            </p>
          </div>
        ) : (
          rows.map((c) => {
            const expired = c.expiry_date && new Date(c.expiry_date).getTime() < now;
            return (
              <div
                key={c.id}
                className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm"
              >
                <div className="px-8 py-5 grid grid-cols-2 md:grid-cols-6 gap-4 items-center">
                  <div>
                    <p className="text-sm font-black text-secondary uppercase tracking-wider">
                      {c.code}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                      #{c.id}
                      {expired && (
                        <span className="ml-2 text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 bg-rose-100 text-rose-700">
                          Expired
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mb-1">
                      Discount
                    </p>
                    <p className="text-lg text-primary font-black">
                      {c.discount_type === 'percent'
                        ? `${c.amount}%`
                        : `$${Number(c.amount).toFixed(2)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mb-1">
                      Expiry
                    </p>
                    <p
                      className={`text-sm font-black ${
                        expired ? 'text-rose-500' : 'text-secondary'
                      }`}
                    >
                      {c.expiry_date
                        ? new Date(c.expiry_date).toLocaleDateString('en-NZ', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mb-1">
                      Used
                    </p>
                    <p className="text-sm font-black text-secondary">
                      {usageByCode.get(c.code)?.uses ?? 0}×
                    </p>
                    <div className="mt-1.5 h-1 w-20 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${Math.round(((usageByCode.get(c.code)?.uses ?? 0) / Math.max(maxUses, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mb-1">
                      Order revenue
                    </p>
                    <p className="text-sm font-black text-secondary">
                      ${(usageByCode.get(c.code)?.revenue ?? 0).toFixed(2)}
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
