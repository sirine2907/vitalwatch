import { describe, expect, it } from "vitest";
import { MAX_URL_LENGTH, validateUrl } from "@/domain/url/validate";

function accepted(input: string): string {
  const result = validateUrl(input);
  if (!result.ok) throw new Error(`Expected "${input}" to pass: ${result.error}`);
  return result.url;
}

describe("validateUrl accepts", () => {
  it.each([
    ["example.com", "https://example.com/"],
    ["  example.com  ", "https://example.com/"],
    ["http://example.com", "http://example.com/"],
    ["HTTPS://EXAMPLE.COM/Path", "https://example.com/Path"],
    ["https://example.com:443/", "https://example.com/"],
    ["sub.domain.example.co.uk/a/b", "https://sub.domain.example.co.uk/a/b"],
    ["https://8.8.8.8/", "https://8.8.8.8/"],
    ["https://[2606:4700:4700::1111]/", "https://[2606:4700:4700::1111]/"],
  ])("%s", (input, expected) => {
    expect(accepted(input)).toBe(expected);
  });

  it("converts international domains to punycode", () => {
    expect(accepted("https://bücher.example/")).toBe("https://xn--bcher-kva.example/");
  });
});

describe("validateUrl normalizes", () => {
  it("removes fragments", () => {
    expect(accepted("example.com/page#top")).toBe("https://example.com/page");
  });

  it("removes a trailing slash except on the root", () => {
    expect(accepted("example.com/page/")).toBe("https://example.com/page");
    expect(accepted("example.com/")).toBe("https://example.com/");
  });

  it("removes tracking parameters and keeps real ones", () => {
    expect(accepted("example.com/?utm_source=x&id=7&gclid=y&fbclid=z")).toBe(
      "https://example.com/?id=7",
    );
  });

  it("gives the same result for reordered query parameters", () => {
    expect(accepted("example.com/?b=2&a=1")).toBe(accepted("example.com/?a=1&b=2"));
  });
});

describe("validateUrl rejects", () => {
  it.each([
    ["empty input", ""],
    ["only spaces", "   "],
    ["ftp", "ftp://example.com"],
    ["file", "file:///etc/passwd"],
    ["javascript", "javascript:alert(1)"],
    ["credentials", "https://user:pass@example.com"],
    ["a username", "https://user@example.com"],
    ["a custom port", "https://example.com:8080"],
    ["a single label", "https://intranet"],
    ["spaces in the host", "https://exa mple.com"],
    ["localhost", "http://localhost"],
    ["localhost with a port", "localhost:3000"],
    ["a localhost subdomain", "https://foo.localhost"],
    [".local", "https://printer.local"],
    [".internal", "https://metadata.google.internal"],
    ["loopback", "http://127.0.0.1"],
    ["private 10.x", "http://10.0.0.1"],
    ["private 172.16.x", "http://172.16.0.1"],
    ["private 172.31.x", "http://172.31.255.255"],
    ["private 192.168.x", "http://192.168.1.1"],
    ["cloud metadata", "http://169.254.169.254/latest/meta-data"],
    ["carrier NAT", "http://100.64.0.1"],
    ["0.0.0.0", "http://0.0.0.0"],
    ["multicast", "http://224.0.0.1"],
    ["IPv6 loopback", "http://[::1]/"],
    ["IPv6 unspecified", "http://[::]/"],
    ["IPv6 unique local", "http://[fd00::1]/"],
    ["IPv6 link local", "http://[fe80::1]/"],
    ["IPv4 mapped IPv6", "http://[::ffff:127.0.0.1]/"],
    ["decimal-encoded loopback", "http://2130706433/"],
    ["hex-encoded loopback", "http://0x7f.0.0.1/"],
    ["octal-encoded loopback", "http://0177.0.0.1/"],
  ])("%s", (_name, input) => {
    expect(validateUrl(input).ok).toBe(false);
  });

  it("URLs over the length limit", () => {
    const url = `https://example.com/${"a".repeat(MAX_URL_LENGTH)}`;
    expect(validateUrl(url).ok).toBe(false);
  });

  it("does not reject public ranges next to private ones", () => {
    expect(validateUrl("http://172.32.0.1").ok).toBe(true);
    expect(validateUrl("http://100.128.0.1").ok).toBe(true);
    expect(validateUrl("http://11.0.0.1").ok).toBe(true);
  });
});
