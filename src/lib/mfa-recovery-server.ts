import { createHash, randomInt } from 'node:crypto';
import {
  normalizeRecoveryCode,
  RECOVERY_CODE_ALPHABET,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_LENGTH,
} from '@/lib/mfa-recovery';

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    let code = '';
    for (let index = 0; index < RECOVERY_CODE_LENGTH; index += 1) {
      code += RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)];
    }
    return code;
  });
}

/**
 * Hash a code before it touches the database.
 *
 * SHA-256 is enough because the input is 80 bits of uniformly random data, not
 * a human password: there is no dictionary to attack. The hash also makes the
 * service-role-only table useless to anyone who later gains read access.
 */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code), 'utf8').digest('hex');
}
