import { Search, Users } from 'lucide-react';
import Link from 'next/link';
import { CustomerAdminToggle } from '@/components/admin/CustomerAdminToggle';
import { requireAdmin } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export const metadata = {
  title: 'Community Members — Admin · Indivisible Fair Oaks',
  robots: { index: false, follow: false },
};

type Customer = {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean;
  created_at: string | null;
  orders: {
    id: number;
    total_amount: number | null;
    created_at: string | null;
    status: string | null;
  }[];
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { adminClient } = await requireAdmin();
  const { q } = await searchParams;
  const query = (q || '').trim().toLowerCase();

  const { data: customers } = await adminClient
    .from('profiles')
    .select(`id, email, first_name, last_name, is_admin, created_at,
      orders ( id, total_amount, created_at, status )`)
    .order('created_at', { ascending: false })
    .limit(500);

  const rows = ((customers || []) as unknown as Customer[]).filter((c) => {
    if (!query) return true;
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ').toLowerCase();
    return name.includes(query) || c.email.toLowerCase().includes(query) || String(c.id) === query;
  });

  return (
    <div>
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Users size={14} className="text-secondary" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Admin Panel
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-secondary uppercase">Customers</h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
        <p className="mt-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
          {rows.length} profiles
        </p>
      </div>

      <form className="flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 mb-8 max-w-md">
        <Search size={13} className="text-slate-400" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search customers…"
          className="bg-transparent text-sm font-bold text-secondary outline-none focus:ring-2 focus:ring-primary rounded-md placeholder:text-slate-400"
        />
      </form>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="bg-slate-50 p-16 rounded-3xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-black uppercase tracking-widest text-sm">
              No customers yet.
            </p>
          </div>
        ) : (
          rows.map((c) => {
            const spent = c.orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
            const lastOrder = [...c.orders].sort((a, b) =>
              String(b.created_at || '').localeCompare(String(a.created_at || ''))
            )[0];
            return (
              <div
                key={c.id}
                className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm"
              >
                <div className="px-8 py-5 grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                  <div className="col-span-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="text-sm font-black text-secondary uppercase tracking-wider hover:text-primary transition-colors"
                      >
                        {[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Guest'}
                      </Link>
                      {c.is_admin && (
                        <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 bg-primary text-secondary">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-bold mt-0.5">{c.email}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Joined{' '}
                      {c.created_at
                        ? new Date(c.created_at).toLocaleDateString('en-NZ', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mb-1">
                      Orders
                    </p>
                    <p className="text-sm text-secondary font-black">{c.orders.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mb-1">
                      Lifetime Spend
                    </p>
                    <p className="text-lg text-primary font-black">${spent.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mb-1">
                      Last Order
                    </p>
                    <p className="text-sm text-secondary font-black">
                      {lastOrder
                        ? new Date(lastOrder.created_at || '').toLocaleDateString('en-NZ', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {lastOrder ? lastOrder.status : 'Never ordered'}
                    </p>
                  </div>
                </div>
                <div className="px-8 py-3 bg-slate-50 border-t border-slate-100">
                  <CustomerAdminToggle profileId={c.id} isAdmin={c.is_admin} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
