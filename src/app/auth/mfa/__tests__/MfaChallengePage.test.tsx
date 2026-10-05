import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MfaChallengePage from '@/app/auth/mfa/page';

const push = vi.hoisted(() => vi.fn());
const getAAL = vi.hoisted(() => vi.fn());
const listFactors = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: getAAL,
        listFactors,
        challenge: vi.fn(),
        verify: vi.fn(),
      },
    },
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The Security Check page must not render the TOTP form when no verified
 * factor exists — that page's form is unanswerable and every verify call
 * fails with "Invalid TOTP code" on a user who never enrolled 2FA. The gate
 * used to check AAL alone; a verified-factor check is now the guard.
 */
describe('MfaChallengePage enrollment gate', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    push.mockClear();
    getAAL.mockReset();
    listFactors.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('redirects to /account and never shows the form when AAL2 is required but no verified factor exists', async () => {
    getAAL.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null });
    listFactors.mockResolvedValue({
      data: { all: [{ id: 'f1', status: 'unverified' }] },
      error: null,
    });

    await act(async () => {
      root.render(<MfaChallengePage />);
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(push).toHaveBeenCalledWith('/account');
    expect(document.body.textContent).not.toContain('Security Check');
  });

  it('renders the TOTP challenge when a verified factor exists', async () => {
    getAAL.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null });
    listFactors.mockResolvedValue({
      data: { all: [{ id: 'f1', status: 'verified' }] },
      error: null,
    });

    await act(async () => {
      root.render(<MfaChallengePage />);
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(push).not.toHaveBeenCalledWith('/account');
    expect(document.body.textContent).toContain('Security Check');
  });
});
