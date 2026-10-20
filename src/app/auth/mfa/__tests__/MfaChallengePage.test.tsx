// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MfaChallengePage } from '@/app/auth/mfa/page';

const replace = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const getAAL = vi.hoisted(() => vi.fn());
const listFactors = vi.hoisted(() => vi.fn());
const challenge = vi.hoisted(() => vi.fn());
const verify = vi.hoisted(() => vi.fn());
const searchParams = vi.hoisted(() => new URLSearchParams());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn() }),
  useSearchParams: () => searchParams,
}));
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: getAAL,
        listFactors,
        challenge,
        verify,
      },
    },
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TOTP = { id: 'totp-1', status: 'verified', factor_type: 'totp', friendly_name: 'Phone' };
const PHONE = { id: 'ph-1', status: 'verified', factor_type: 'phone', friendly_name: 'SMS' };

/** AAL that says a step-up is possible and not yet done. */
const stepUpNeeded = { data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  replace.mockClear();
  refresh.mockClear();
  getAAL.mockReset();
  listFactors.mockReset();
  challenge.mockReset();
  verify.mockReset();
  searchParams.delete('next');
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => {
    root.render(<MfaChallengePage />);
    await new Promise((r) => setTimeout(r, 20));
  });
}

/**
 * Type a code and submit the form, the way a person would.
 *
 * The native value setter is used because React tracks the last value it wrote
 * to the node and skips an `input` event whose value it already knows. Assigning
 * `.value` directly is a no-op from React's point of view, which is why a
 * hand-rolled `input.value = code; dispatchEvent(...)` leaves a controlled input
 * at its previous value.
 */
async function submitCode(code: string) {
  const form = document.querySelector('form');
  const input = document.querySelector('#code');
  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
    throw new Error('no code form is rendered, so nothing can be submitted');
  }
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      input,
      code
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));
  });
}

describe('MfaChallengePage gate', () => {
  /**
   * The load-bearing case: AAL says `aal2` is reachable, but the only verified
   * factor is a phone one. The page used to take `factors.all.find(verified)` —
   * first verified factor of *any* type — and render a 6-digit box. `challenge()`
   * on a phone factor sends an SMS, and the digits the user then types fail
   * verification permanently. It must instead name what the account has.
   */
  it('refuses to render a code box when the only verified factor is not a TOTP factor', async () => {
    getAAL.mockResolvedValue(stepUpNeeded);
    listFactors.mockResolvedValue({ data: { all: [PHONE] }, error: null });

    await render();

    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining('challenge'));
    expect(document.body.textContent).toContain('No authenticator app is set up');
    expect(document.body.textContent).toContain('PHONE');
    expect(document.querySelector('#code')).toBeNull();
  });

  it('renders the challenge when a verified TOTP factor exists', async () => {
    getAAL.mockResolvedValue(stepUpNeeded);
    listFactors.mockResolvedValue({ data: { all: [TOTP] }, error: null });

    await render();

    expect(document.body.textContent).toContain('Security Check');
    expect(document.querySelector('#code')).not.toBeNull();
  });

  /**
   * A mixed account must pick the TOTP factor, not merely *a* verified one.
   * With the phone factor first, `find(verified)` returned the phone.
   */
  it('uses the TOTP factor when a phone factor is listed first', async () => {
    getAAL.mockResolvedValue(stepUpNeeded);
    listFactors.mockResolvedValue({ data: { all: [PHONE, TOTP] }, error: null });

    await render();

    expect(document.body.textContent).toContain('Security Check');
  });

  /**
   * No answerable factor: explain, do not bounce.
   *
   * This used to assert `router.replace('/account?tab=settings')`, and the shell
   * below it was unreachable in a browser — a redirect fires in an effect in the
   * same commit that renders the page, so jsdom's inert router was the only
   * reason the shell's own text could be asserted on. The assertion passed and
   * the page could never be seen.
   *
   * The bounce was also the loop. For an account whose only verified factor is a
   * phone factor, the guard said `step_up_required` and this page said
   * `no-factor`, so the redirect sent the user to `/account`, whose gate
   * declines to redirect precisely because there is no TOTP factor to answer
   * with, and retrying the write returned them to the guard. The guard now asks
   * the same question this page does, so the loop is closed at its source; this
   * asserts the half that is left — that the outcome is *shown*.
   */
  it('explains an unanswerable factor instead of bouncing to /account', async () => {
    getAAL.mockResolvedValue(stepUpNeeded);
    listFactors.mockResolvedValue({
      data: { all: [{ id: 'f1', status: 'unverified', factor_type: 'totp' }] },
      error: null,
    });

    await render();

    expect(replace).not.toHaveBeenCalledWith('/account?tab=settings');
    expect(document.body.textContent).toContain('No authenticator app is set up');
    expect(document.querySelector('#code')).toBeNull();
  });

  /**
   * The loop's own case, on the page that closes it: a verified phone factor and
   * nothing else. The guard no longer demands a step-up for this (see
   * `mfa-guard.test.ts`), so arriving here means something sent the user
   * deliberately — and the page must say what is wrong rather than hand them a
   * six-digit box that will never verify.
   */
  it('names the factor type it cannot answer for a phone-only account', async () => {
    getAAL.mockResolvedValue(stepUpNeeded);
    listFactors.mockResolvedValue({ data: { all: [PHONE] }, error: null });

    await render();

    expect(document.body.textContent).toContain('No authenticator app is set up');
    expect(document.body.textContent).toContain('PHONE');
    expect(document.querySelector('#code')).toBeNull();
  });

  it('leaves when the session is already at its maximum assurance level', async () => {
    getAAL.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2' },
      error: null,
    });

    await render();

    expect(replace).toHaveBeenCalledWith('/account');
    expect(document.querySelector('#code')).toBeNull();
  });

  /**
   * The loop breaker. `getAuthenticatorAssuranceLevel` failing used to
   * `router.push('/login')`, and middleware bounces a still-signed-in user off
   * /login to /account, whose gate sends them straight back here. Four silent
   * hops. A readable fault is now rendered with the underlying message and a
   * retry, and nothing redirects.
   */
  it('renders a retryable fault instead of redirecting when assurance level is unreadable', async () => {
    getAAL.mockResolvedValue({ data: null, error: { message: 'network down' } });

    await render();

    expect(replace).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('could not check your security status');
    expect(document.body.textContent).toContain('network down');
  });

  it('renders the same fault when listFactors fails, with no redirect', async () => {
    getAAL.mockResolvedValue(stepUpNeeded);
    listFactors.mockResolvedValue({ data: null, error: { message: 'factor service unavailable' } });

    await render();

    expect(replace).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('factor service unavailable');
  });

  it('honours ?next= for the post-step-up destination', async () => {
    searchParams.set('next', '/account?tab=settings');
    getAAL.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null });

    await render();

    expect(replace).toHaveBeenCalledWith('/account?tab=settings');
  });

  it('rejects an off-site ?next= and falls back to /account', async () => {
    searchParams.set('next', 'https://evil.example/steal');
    getAAL.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null });

    await render();

    expect(replace).toHaveBeenCalledWith('/account');
  });

  /**
   * This page is the one consumer in the app that validates `?next=` a single
   * time and then navigates: `middleware.ts` → `login/page.tsx` validates twice,
   * and `auth/callback/route.ts` concatenates the origin in front of the value.
   * So a `getSafeNextPath` that returns a protocol-relative string is reachable
   * *only* here, and it needs no interaction to fire — an AAL2 visitor is
   * redirected off-site on arrival, and an AAL1 visitor the instant they submit a
   * correct code.
   *
   * The value is asserted through `router.replace`, because that is the call
   * whose argument a browser resolves against `location.href`.
   */
  it.each([
    ['a literal traversal', '/..//evil.example'],
    ['an encoded traversal', '/%2e%2e//evil.example'],
    ['a traversal behind a real path', '/account/%2e%2e//evil.example'],
  ])('rejects ?next= carrying %s rather than navigating off-origin', async (_label, next) => {
    searchParams.set('next', next);
    getAAL.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null });

    await render();

    expect(replace).toHaveBeenCalledWith('/account');
  });
});

describe('MfaChallengePage submit', () => {
  /**
   * The submit path re-reads and re-filters factors rather than trusting the
   * mount gate. This is the branch that actually calls `verify()`, so a factor
   * appearing or disappearing between the two reads has to be caught here.
   */
  it('challenges the TOTP factor and does not verify against a phone factor', async () => {
    getAAL.mockResolvedValue(stepUpNeeded);
    // TOTP at mount so the form renders, then the factor is replaced by a phone
    // one before submit — the second read is the one that calls `verify()`.
    listFactors
      .mockResolvedValueOnce({ data: { all: [TOTP] }, error: null })
      .mockResolvedValue({ data: { all: [PHONE] }, error: null });
    challenge.mockResolvedValue({ data: { id: 'c1' }, error: null });
    verify.mockResolvedValue({ data: {}, error: null });

    await render();
    await submitCode('123456');

    expect(challenge).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('no authenticator app enrolled');
  });

  it('challenges and verifies a verified TOTP factor, then navigates on success', async () => {
    getAAL.mockResolvedValue(stepUpNeeded);
    listFactors.mockResolvedValue({ data: { all: [TOTP] }, error: null });
    challenge.mockResolvedValue({ data: { id: 'c1' }, error: null });
    verify.mockResolvedValue({ data: {}, error: null });

    await render();
    await submitCode('123456');

    expect(challenge).toHaveBeenCalledWith({ factorId: 'totp-1' });
    expect(verify).toHaveBeenCalledWith({ factorId: 'totp-1', challengeId: 'c1', code: '123456' });
    expect(replace).toHaveBeenCalledWith('/account');
    // The AAL2 session is written to cookies by GoTrue; the destination gate
    // reads it, so the page must re-render server-side rather than keep the
    // AAL1 client state.
    expect(refresh).toHaveBeenCalled();
  });

  it('surfaces a rejected code instead of navigating', async () => {
    getAAL.mockResolvedValue(stepUpNeeded);
    listFactors.mockResolvedValue({ data: { all: [TOTP] }, error: null });
    challenge.mockResolvedValue({ data: { id: 'c1' }, error: null });
    verify.mockResolvedValue({ data: null, error: { message: 'Invalid TOTP code' } });

    await render();
    await submitCode('000000');

    expect(replace).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Invalid TOTP code');
    // The error is wired to the input, not just rendered beside it.
    expect(document.querySelector('#code')?.getAttribute('aria-describedby')).toBe('mfa-error');
  });
});
