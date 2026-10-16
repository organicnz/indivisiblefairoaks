import { AlertTriangle, ArrowRight, Shield, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccountTabShell } from '@/components/account/AccountTabShell';
import { AdminOrdersPanel } from '@/components/account/AdminOrdersPanel';
import { LogoutButton } from '@/components/account/LogoutButton';
import { MfaSettings } from '@/components/account/MfaSettings';
import { MyOrdersPanel } from '@/components/account/MyOrdersPanel';
import { UserSettings } from '@/components/account/UserSettings';
import { DataPoint } from '@/components/ui/DataPoint';
import { getDataPoints } from '@/lib/queries/civic';
import { createAdminClient, createServerClient } from '@/lib/supabase-server';
import type { AdminOrder, MyOrder } from '@/types/orders';

// Deliberate Cache Components opt-out (Block): per-user auth + MFA state, entire surface is request-time.
export const instant = false;

export const metadata = {
  title: 'Account — Indivisible Fair Oaks-Carmichael',
  robots: { index: false, follow: false },
};

/** The real tabs. Used to bound what the MFA gate reflects back as `?next=`. */
const ALLOWED_TABS = new Set(['admin', 'orders', 'settings']);

export default async function AccountPage(props: {
  searchParams: Promise<Record<string, string>>;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read before the gate: the challenge has to be able to send the user back to
  // the tab they were on. `?tab=settings` is how someone reaches the 2FA panel
  // at all, so bouncing to `/account` unqualified drops them on Orders.
  const sp = await props.searchParams;

  // MFA gate — only send the user to the TOTP challenge when a verified factor
  // that this site can actually answer for exists.
  //
  // Why `listFactors()` and not AAL alone: `getAuthenticatorAssuranceLevel()`
  // reads `session.user.factors` out of the **cookie snapshot**, and
  // `listFactors()` reads **live** `/user` factors. When they disagree — 2FA
  // unenrolled from another browser after this session was issued — the old
  // AAL-only gate redirected to a challenge the user could not pass, producing
  // an endless "Invalid TOTP code". (A commit message on this gate claimed AAL
  // reports `aal2` for an *unfinished* enrollment; that is not reachable on
  // @supabase/auth-js 2.115, which filters `status === 'verified'` before
  // returning `aal2`. The snapshot-vs-live divergence is the real cause.)
  //
  // Why the TOTP filter: `all` mixes totp, phone and webauthn. A verified phone
  // factor cannot be answered by a 6-digit code from an authenticator app, so
  // redirecting there shows a form that can never succeed.
  //
  // Why this fails **closed** on an unreadable factor list, unlike the previous
  // version which ignored the error and let an AAL1 session through: an
  // unreadable state is a fault, and the fault must not become a bypass. The
  // cost is that a Supabase blip locks a user out of /account until it clears;
  // that is the correct trade for a surface that displays other people's data.
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.nextLevel === 'aal2' && aalData.nextLevel !== aalData.currentLevel) {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      // Surface it. A silent `/account` render here looked like a working page
      // while the mutation panels below it refused every write.
      console.error('[Account] could not read MFA factors:', factorsError);
      redirect('/auth/mfa');
    }
    const answerable = factors?.all?.some(
      (f) => f.status === 'verified' && f.factor_type === 'totp'
    );
    if (answerable) {
      // An allowlist, not `sp.tab` echoed back: `?next` is read by the challenge
      // page through `getSafeNextPath`, and the value here originates in the URL
      // a third party can hand a user. Restricting it to the three real tabs
      // means a crafted `?tab=…` cannot smuggle anything into the return path.
      const tab = ALLOWED_TABS.has(sp.tab) ? sp.tab : 'orders';
      redirect(`/auth/mfa?next=${encodeURIComponent(`/account?tab=${tab}`)}`);
    }
  }

  // Profile via admin client (bypasses RLS)
  let profile: { id: string; user_id: string | null; is_admin: boolean | null } | null = null;
  try {
    const ac = await createAdminClient();
    const { data } = await ac
      .from('profiles')
      .select('id, user_id, is_admin')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .single();
    profile = data;
    if (profile && !profile.user_id) {
      await ac.from('profiles').update({ user_id: user.id }).eq('id', profile.id);
    }
  } catch (e) {
    console.error('[Account] profile fetch error:', e);
  }

  const isAdmin = profile?.is_admin === true;

  // Unchanged semantics — an unknown or absent `?tab` still falls back to the
  // admin/orders default, and a non-admin asking for `?tab=admin` still renders
  // the orders panel (the `panel` branch below requires `isAdmin`). The
  // allowlist exists for the *return path* through /auth/mfa, not for this.
  const activeTab = sp.tab ?? (isAdmin ? 'admin' : 'orders');

  // Fetch data
  const [allOrdersResult, myOrdersResult, dataPoints] = await Promise.all([
    isAdmin
      ? createAdminClient().then((ac) =>
          ac
            .from('orders')
            .select(`id, created_at, status, total, currency,
              stripe_session_id, shipping_address, billing_address,
              order_items ( id, product_name, quantity, unit_price ),
              profiles ( first_name, last_name, email )`)
            .order('created_at', { ascending: false })
            .limit(200)
        )
      : Promise.resolve({ data: [] as AdminOrder[] }),
    profile
      ? supabase
          .from('orders')
          .select('id, created_at, status, total, order_items(product_name, quantity, unit_price)')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as MyOrder[] }),
    getDataPoints('account'),
  ]);

  const allOrders = (allOrdersResult.data ?? []) as AdminOrder[];
  const myOrders = (myOrdersResult.data ?? []) as MyOrder[];
  const processing = allOrders.filter((o) => o.status === 'processing').length;

  const tabs = [
    ...(isAdmin
      ? [
          {
            id: 'admin',
            label: dataPoints['account.tabs.all_orders'] || 'All Orders',
            badge: processing,
          },
        ]
      : []),
    {
      id: 'orders',
      label: isAdmin
        ? dataPoints['account.tabs.my_orders'] || 'My Orders'
        : dataPoints['account.tabs.orders'] || 'Orders',
    },
    {
      id: 'settings',
      label: dataPoints['account.tabs.settings'] || 'Settings',
    },
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
            <DataPoint name="account.session.title" initialData={dataPoints}>
              Session Control
            </DataPoint>
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">
            <DataPoint name="account.session.signed_in_as" as="span" initialData={dataPoints}>
              Signed in as
            </DataPoint>{' '}
            <span className="text-secondary">{user.email}</span>
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
        {/* Admin Restricted Notice */}
        {sp.error === 'admin_required' && (
          <div className="mb-8 p-5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-4 text-amber-950 animate-in fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-900 mb-1">
                <DataPoint name="account.admin_required.title" initialData={dataPoints}>
                  Administrator Privileges Required
                </DataPoint>
              </h3>
              <DataPoint
                name="account.admin_required.desc"
                as="p"
                initialData={dataPoints}
                className="text-xs text-amber-800"
              >
                The administrative panel is strictly restricted to verified chapter organizers. If
                you are a chapter lead, please ensure you are signed in with your authorized
                administrator email.
              </DataPoint>
            </div>
          </div>
        )}

        {/* Administrator Portal Bridge */}
        {isAdmin && (
          <div className="mb-10 p-6 rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 animate-in fade-in">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">
                    <DataPoint name="account.admin_bridge.badge" initialData={dataPoints}>
                      Chapter Leadership
                    </DataPoint>
                  </span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <h2 className="text-lg font-black uppercase tracking-tight text-white">
                  <DataPoint name="account.admin_bridge.title" initialData={dataPoints}>
                    Admin Control & Civic CRM
                  </DataPoint>
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  <DataPoint name="account.admin_bridge.desc" initialData={dataPoints}>
                    Manage chapter constituents, target volunteer rings, and dispatch Resend
                    broadcasts.
                  </DataPoint>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <Link
                href="/admin/crm"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-blue-500/25 transition-all"
              >
                <Users className="w-4 h-4" />
                <span>
                  <DataPoint name="account.admin_bridge.crm_btn" initialData={dataPoints}>
                    Open CRM
                  </DataPoint>
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider border border-slate-700 transition-all"
              >
                <span>
                  <DataPoint name="account.admin_bridge.control_btn" initialData={dataPoints}>
                    Control Center
                  </DataPoint>
                </span>
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-col mb-10">
          <h1 className="text-4xl font-black tracking-tight text-secondary uppercase">
            <DataPoint
              name={isAdmin ? 'account.title.dashboard' : 'account.title.my_account'}
              initialData={dataPoints}
            >
              {isAdmin ? 'Dashboard' : 'My Account'}
            </DataPoint>
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
