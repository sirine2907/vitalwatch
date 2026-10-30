const UNKNOWN_CLIENT = "unknown";

/**
 * Finds the client IP for rate limiting. Forwarding headers can be forged, so
 * they are only trusted on Vercel, which sets them itself. Anywhere else, all
 * clients share one bucket: stricter, but it can't be dodged.
 */
export function getClientIp(headers: Headers, isVercel: boolean): string {
  if (!isVercel) return UNKNOWN_CLIENT;

  const forwarded =
    headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || UNKNOWN_CLIENT;
}
