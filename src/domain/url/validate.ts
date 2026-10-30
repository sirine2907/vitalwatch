export const MAX_URL_LENGTH = 2048;

export type UrlValidation =
  | { ok: true; url: string }
  | { ok: false; error: string };

const fail = (error: string): UrlValidation => ({ ok: false, error });

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home.arpa"];
const TRACKING_PARAM = /^(utm_.+|gclid|fbclid|msclkid)$/i;

const PRIVATE_ADDRESS_MESSAGE = "Private and local addresses can't be tested.";

function isPrivateIpv4(host: string): boolean | null {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!match) return null;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && Number(match[3]) === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function isBlockedIpv6(host: string): boolean {
  const address = host.slice(1, -1);
  return (
    address === "::" ||
    address === "::1" ||
    address.startsWith("::ffff:") ||
    /^f[cd]/.test(address) ||
    /^fe[89ab]/.test(address) ||
    address.startsWith("ff")
  );
}

/** Removes the parts of a URL that don't change the page being tested. */
function normalize(parsed: URL): string {
  parsed.hash = "";

  const params = [...parsed.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAM.test(key))
    .sort(([a], [b]) => a.localeCompare(b));
  parsed.search = new URLSearchParams(params).toString();

  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString();
}

/**
 * Validates a user-supplied URL and returns its normalized form, which also
 * serves as the cache key. Runs in the browser and on the server.
 */
export function validateUrl(input: string): UrlValidation {
  const trimmed = input.trim();
  if (!trimmed) return fail("Enter a URL to test.");
  if (trimmed.length > MAX_URL_LENGTH) {
    return fail(`URLs can be at most ${MAX_URL_LENGTH} characters.`);
  }

  const schemed = SCHEME.test(trimmed);
  if (schemed && !/^https?:\/\//i.test(trimmed)) {
    return fail("Only http and https URLs can be tested.");
  }

  let parsed: URL;
  try {
    parsed = new URL(schemed ? trimmed : `https://${trimmed}`);
  } catch {
    return fail("That doesn't look like a valid URL.");
  }

  if (parsed.username || parsed.password) {
    return fail("URLs can't include a username or password.");
  }
  if (parsed.port) {
    return fail("Only the standard web ports can be tested.");
  }

  const host = parsed.hostname.toLowerCase();

  if (host.startsWith("[")) {
    if (isBlockedIpv6(host)) return fail(PRIVATE_ADDRESS_MESSAGE);
    return { ok: true, url: normalize(parsed) };
  }

  const privateIpv4 = isPrivateIpv4(host);
  if (privateIpv4 === true) return fail(PRIVATE_ADDRESS_MESSAGE);

  if (privateIpv4 === null) {
    if (host === "localhost" || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
      return fail(PRIVATE_ADDRESS_MESSAGE);
    }
    if (!host.includes(".") || host.endsWith(".")) {
      return fail("Enter a full domain, like example.com.");
    }
  }

  return { ok: true, url: normalize(parsed) };
}
