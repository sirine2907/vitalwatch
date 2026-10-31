/**
 * Without a verified sending domain, Resend can only reach the account owner. When
 * an owner address is set, email is limited to it. Removing it opens email to all.
 */
export function canReceiveEmail(email: string, ownerAddress: string | undefined): boolean {
  if (!ownerAddress) return true;
  return email.trim().toLowerCase() === ownerAddress.trim().toLowerCase();
}
