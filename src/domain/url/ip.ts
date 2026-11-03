/**
 * Address checks shared by URL validation and the server-side page fetcher.
 * Blocks loopback, private, link-local (including cloud metadata), carrier NAT,
 * benchmarking, multicast and reserved ranges.
 */

/** True or false for an IPv4 address, null if `address` isn't one. */
export function isBlockedIpv4(address: string): boolean | null {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(address);
  if (!match) return null;
  const [a, b, c] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** For an IPv6 address without brackets. */
export function isBlockedIpv6(address: string): boolean {
  const lower = address.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return isBlockedIpv4(mapped[1]) !== false;
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("::ffff:") ||
    /^f[cd]/.test(lower) ||
    /^fe[89ab]/.test(lower) ||
    lower.startsWith("ff")
  );
}

export function isBlockedAddress(address: string): boolean {
  const v4 = isBlockedIpv4(address);
  return v4 === null ? isBlockedIpv6(address) : v4;
}
