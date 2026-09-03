/**
 * Bug Condition Smoke Test: /account/update-password returns 404
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * This test confirms the bug condition: `src/app/account/update-password/page.tsx`
 * must exist for the route to work. On unfixed code (missing page.tsx), the import
 * below will throw "Cannot find module", proving the bug exists.
 *
 * EXPECTED OUTCOME on unfixed code: FAIL with "Cannot find module"
 * EXPECTED OUTCOME after fix: PASS (module resolves successfully)
 */

import { describe, expect, it } from 'vitest';

describe('Bug Condition: /account/update-password returns 404', () => {
  it('UpdatePasswordPage module exists', async () => {
    // This dynamic import will throw "Cannot find module" if page.tsx is missing.
    // That failure IS the expected outcome on unfixed code — it proves the bug exists.
    // After the fix (page.tsx created), this import resolves and the test passes.
    const mod = await import('../../app/account/update-password/page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

/**
 * Preservation Smoke Tests: Existing auth routes unaffected
 *
 * **Validates: Requirements 3.1, 3.3, 3.4, 3.5**
 *
 * These tests confirm baseline behavior that must not regress after the fix.
 * They run on unfixed code and MUST PASS — the fix is purely additive.
 */

describe('Preservation: Existing auth routes unaffected', () => {
  it('auth callback route exports a GET handler', async () => {
    // Requirement 3.3: /auth/callback must continue to exchange codes for sessions
    const mod = await import('../../app/auth/callback/route');
    expect(typeof mod.GET).toBe('function');
  });

  it('MFA page module is importable', async () => {
    // Requirement 3.4: /auth/mfa must continue to render without disruption
    const mod = await import('../../app/auth/mfa/page');
    expect(mod.default).toBeDefined();
  });

  it('login page module is importable', async () => {
    // Requirement 3.1: Normal login flow must continue to work
    const mod = await import('../../app/login/page');
    expect(mod.default).toBeDefined();
  });
});
