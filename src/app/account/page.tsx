import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { AccountAdminBridge } from '@/components/account/AccountAdminBridge';
import { AccountAdminNotice } from '@/components/account/AccountAdminNotice';
import { AccountHeading } from '@/components/account/AccountHeading';
import { AccountPanel } from '@/components/account/AccountPanel';
import { AccountTabShell } from '@/components/account/AccountTabShell';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { getDataPoints } from '@/lib/queries/civic';
import { getSafeNextPath } from '@/lib/safe-redirect';
import { createAdminClient, createServerClient } from '@/lib/supabase-server';

// Deliberate Cache Components opt-out (Block): per-user auth + MFA state, entire surface is request-time.
export const instant = false;

export const metadata = {
  title: 'Account — Indivisible Fair Oaks-Carmichael',
  robots: { index: false, follow: false },
};

/** The real tabs. Used to bound what the MFA gate reflects back as `?next=`. */
const ALLOWED_TABS = new Set(['settings']);

export default async function AccountPage(props: {
  searchParams: Promise<Record<string, string>>;
}) {
  // Per-user auth and MFA state are request-time. Keep prefetch and partial
  // prerender from reaching Supabase's session clock before this read.
  await connection();
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read before the gate: the challenge has to be able to send the user back to
  // the tab they were on. `?tab=settings` is how someone reaches the 2FA panel
  // at all, so bouncing to `/account` unqualified drops them on the first tab.
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
      const tab = ALLOWED_TABS.has(sp.tab) ? sp.tab : 'settings';
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

  const activeTab = sp.tab ?? 'settings';
  const enrollmentReturnTo =
    getSafeNextPath(sp.next, '/account?tab=settings') ?? '/account?tab=settings';

  const dataPoints = await getDataPoints('account');

  const tabs = [
    {
      id: 'settings',
      label: dataPoints['account.tab.settings'] || 'Settings',
    },
  ];

  return (
    <div className="civic-page relative overflow-hidden bg-background min-h-screen pt-(--header-clearance) pb-16 text-foreground transition-colors duration-300">
      <VgpuCivicConstellation className="pointer-events-none opacity-20" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {sp.error === 'admin_required' && (
          <AccountAdminNotice email={user.email} dataPoints={dataPoints} />
        )}

        {isAdmin && <AccountAdminBridge dataPoints={dataPoints} />}

        <AccountHeading isAdmin={isAdmin} dataPoints={dataPoints} />

        <AccountTabShell tabs={tabs} activeTab={activeTab}>
          <AccountPanel
            email={user.email}
            autoEnroll={sp.mfa === 'enroll'}
            returnTo={enrollmentReturnTo}
            dataPoints={dataPoints}
          />
        </AccountTabShell>
      </div>
    </div>
  );
}
