import { redirect } from 'next/navigation';
import { AccountTabShell } from '@/components/account/AccountTabShell';
import { AdminOrdersPanel } from '@/components/account/AdminOrdersPanel';
import { LogoutButton } from '@/components/account/LogoutButton';
import { MfaSettings } from '@/components/account/MfaSettings';
import { MyOrdersPanel } from '@/components/account/MyOrdersPanel';
import { UserSettings } from '@/components/account/UserSettings';
import { createAdminClient, createServerClient } from '@/lib/supabase-server';
import type { AdminOrder, MyOrder } from '@/types/orders';

// Deliberate Cache Components opt-out (Block): per-user auth + MFA state, entire surface is request-time.
export const instant = false;

export const metadata = {
  title: 'Account — Catch-22',
  robots: { index: false, follow: false },
};

export default async function AccountPage(props: {
  searchParams: Promise<Record<string, string>>;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // MFA gate
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.nextLevel !== aalData?.currentLevel && aalData?.nextLevel === 'aal2') {
    redirect('/auth/mfa');
  }

  // Profile via admin client (bypasses RLS)
  let profile: { id: number; user_id: string | null; is_admin: boolean } | null = null;
  try {
    const ac = await createAdminClient();
    const { data } = await ac
      .from('profiles')
      .select('id, user_id, is_admin')
      .or(`email.eq.${user.email},user_id.eq.${user.id}`)
      .single();
    profile = data;
    if (profile && !profile.user_id) {
      await ac.from('profiles').update({ user_id: user.id }).eq('id', profile.id);
    }
  } catch (e) {
    console.error('[Account] profile fetch error:', e);
  }

  const isAdmin = profile?.is_admin === true;

  // Active tab from URL
  const sp = await props.searchParams;
  const activeTab = sp.tab ?? (isAdmin ? 'admin' : 'orders');

  // Fetch data
  const [allOrdersResult, myOrdersResult] = await Promise.all([
    isAdmin
      ? createAdminClient().then((ac) =>
          ac
            .from('orders')
            .select(`id, created_at, status, total_amount, currency, payment_method,
              stripe_session_id, shipping_address, billing_address,
              order_items ( id, product_name, quantity, total ),
              profiles ( first_name, last_name, email )`)
            .order('created_at', { ascending: false })
            .limit(200)
        )
      : Promise.resolve({ data: [] as AdminOrder[] }),
    profile
      ? supabase
          .from('orders')
          .select(
            'id, created_at, status, total_amount, order_items(product_name, quantity, total)'
          )
          .eq('customer_id', profile.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as MyOrder[] }),
  ]);

  const allOrders = (allOrdersResult.data ?? []) as AdminOrder[];
  const myOrders = (myOrdersResult.data ?? []) as MyOrder[];
  const processing = allOrders.filter((o) => o.status === 'processing').length;

  const tabs = [
    ...(isAdmin ? [{ id: 'admin', label: 'All Orders', badge: processing }] : []),
    { id: 'orders', label: isAdmin ? 'My Orders' : 'Orders' },
    { id: 'settings', label: 'Settings' },
  ];

  let panel: React.ReactNode;
  if (activeTab === 'admin' && isAdmin) {
    panel = <AdminOrdersPanel orders={allOrders} />;
  } else if (activeTab === 'settings') {
    panel = (
      <div className="max-w-2xl space-y-12">
        <UserSettings />
        <MfaSettings />
        <div className="pt-8 border-t border-slate-100">
          <h3 className="text-sm font-black text-secondary uppercase tracking-widest mb-1">
            Session Control
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">
            Signed in as <span className="text-secondary">{user.email}</span>
          </p>
          <LogoutButton />
        </div>
      </div>
    );
  } else {
    panel = <MyOrdersPanel orders={myOrders} />;
  }

  return (
    <div className="bg-white min-h-screen pt-(--header-h) pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col mb-10">
          <h1 className="text-4xl font-black tracking-tight text-secondary uppercase">
            {isAdmin ? 'Dashboard' : 'My Account'}
          </h1>
          <div className="h-1.5 w-24 bg-primary mt-3" />
        </div>
        <AccountTabShell tabs={tabs} activeTab={activeTab}>
          {panel}
        </AccountTabShell>
      </div>
    </div>
  );
}
