// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  formatRecoveryCode,
  isRecoveryCodeShape,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_LENGTH,
  recoveryCodesText,
} from '@/lib/mfa-recovery';
import { generateRecoveryCodes, hashRecoveryCode } from '@/lib/mfa-recovery-server';

describe('MFA recovery codes', () => {
  it('generates a full set of distinct, high-entropy codes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      expect(code).toHaveLength(RECOVERY_CODE_LENGTH);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
      expect(isRecoveryCodeShape(code)).toBe(true);
    }
  });

  it('normalizes case, spaces and dashes before hashing', () => {
    const canonical = 'ABCDEFGHJKLMNPQR';
    expect(normalizeRecoveryCode('abcd-efgh jklm npqr')).toBe(canonical);
    expect(formatRecoveryCode(canonical)).toBe('ABCD-EFGH-JKLM-NPQR');
    expect(hashRecoveryCode('abcd-efgh jklm npqr')).toBe(hashRecoveryCode(canonical));
  });

  it('rejects a code that is not the generated length', () => {
    expect(isRecoveryCodeShape('ABCD')).toBe(false);
    expect(isRecoveryCodeShape('ABCD-EFGH-JKLM-NPQR')).toBe(true);
  });

  it('renders one formatted code per line for copy, download and print', () => {
    expect(recoveryCodesText(['ABCDEFGHJKLMNPQR', '23456789ABCDEFGH'])).toBe(
      'ABCD-EFGH-JKLM-NPQR\n2345-6789-ABCD-EFGH\n'
    );
  });
});
