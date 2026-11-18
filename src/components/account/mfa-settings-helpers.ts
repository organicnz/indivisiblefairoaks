export interface Factor {
  id: string;
  status: string;
  factor_type: string;
  friendly_name?: string;
}

/**
 * Grouped base32 → four-character chunks, for reading a secret aloud or typing
 * it into an app by hand. The canonical encoding omits padding; Supabase returns
 * an unpadded secret, but a hand-typed one is often written in blocks.
 */
export function groupSecret(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? []).join(' ');
}

/**
 * Pick a label for a new factor from the ones already enrolled.
 *
 * Derived from existing labels rather than counted, because the labels are what
 * the user chose and a factor the user cannot name is a factor they cannot
 * identify when deciding which to remove.
 */
export function nextFactorLabel(existing: Factor[]): string {
  const taken = new Set(
    existing
      .filter((f) => f.friendly_name)
      .map((f) => (f.friendly_name as string).trim().toLowerCase())
  );
  const suggestions = ['Phone', 'Authy', '1Password', 'Backup device'];
  const free = suggestions.find((s) => !taken.has(s.toLowerCase()));
  if (free) return free;
  let n = 2;
  while (taken.has(`authenticator ${n}`)) n += 1;
  return `Authenticator ${n}`;
}

/**
 * The base32 secret out of an `otpauth://` URI.
 *
 * Parsed from the URI rather than carried alongside it, because
 * `getTotpEnrollmentUri` returns only the URI — the secret inside it was
 * available and discarded, which is what the manual-entry path needs.
 */
export function totpSecretFromUri(uri: string): string {
  if (!uri) return '';
  const match = /[?&]secret=([^&]+)/i.exec(uri);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
}
