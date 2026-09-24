type TotpEnrollmentData = {
  uri?: string | null;
};

export function getTotpEnrollmentUri(data: TotpEnrollmentData | null | undefined): string {
  const uri = data?.uri?.trim();
  if (!uri?.toLowerCase().startsWith('otpauth://totp/')) return '';
  return uri;
}
