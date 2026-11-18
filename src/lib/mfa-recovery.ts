/**
 * Client-safe recovery-code helpers.
 *
 * The generator and hasher live in `mfa-recovery-server.ts` because they use
 * Node's crypto module. Keeping those imports out of this file lets the account
 * panel format a code without pulling `node:crypto` into the browser bundle.
 *
 * The alphabet excludes `I`, `O`, `0` and `1`, which are the characters people
 * most often transcribe as each other from a printed sheet. Sixteen characters
 * from this 32-symbol alphabet carry 80 bits of entropy.
 */
export const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RECOVERY_CODE_COUNT = 10;
export const RECOVERY_CODE_LENGTH = 16;

/** Accept the code as a person would type it: case, spaces and dashes ignored. */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatRecoveryCode(code: string): string {
  return (normalizeRecoveryCode(code).match(/.{1,4}/g) ?? []).join('-');
}

export function isRecoveryCodeShape(code: string): boolean {
  return normalizeRecoveryCode(code).length === RECOVERY_CODE_LENGTH;
}

/** The exact text used for copy, download and print, so all three agree. */
export function recoveryCodesText(codes: readonly string[]): string {
  return `${codes.map(formatRecoveryCode).join('\n')}\n`;
}
