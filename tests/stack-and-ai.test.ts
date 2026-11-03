import type { LookupAddress } from "node:dns";
import { describe, expect, it } from "vitest";
import { auditResources, buildFixRequest, fixUserPrompt } from "@/domain/ai/fix-request";
import { cleanSuggestions, fixSuggestionsJsonSchema, type FixSuggestions } from "@/domain/ai/fix-schema";
import { parsePsiResponse } from "@/domain/psi/parse";
import { detectStack, stackPacksFromRaw } from "@/domain/stack/detect";
import { isBlockedAddress } from "@/domain/url/ip";
import { createSafeLookup, fetchPublicPage } from "@/integrations/site-fetcher";
import { withAudits } from "./fixtures/psi-response";

const names = (signals: Parameters<typeof detectStack>[0]) => detectStack(signals).map((t) => t.name);
const empty = { headers: {}, html: null, stackPacks: [] };

describe("detectStack", () => {
  it("finds Next.js from HTML, header and stack pack, with high confidence", () => {
    const [next] = detectStack({
      headers: { "X-Powered-By": "Next.js" },
      html: '<script id="__NEXT_DATA__">',
      stackPacks: [{ id: "next.js", title: "Next.js" }],
    });
    expect(next).toMatchObject({ name: "Next.js", category: "framework", confidence: "high" });
    expect(next.evidence).toHaveLength(3);
  });

  it("marks a single signal as medium confidence", () => {
    const [found] = detectStack({ ...empty, html: '<link href="/wp-content/themes/x.css">' });
    expect(found).toMatchObject({ name: "WordPress", confidence: "medium" });
  });

  it("treats Lighthouse's own detection alone as high confidence", () => {
    const [found] = detectStack({ ...empty, stackPacks: [{ id: "wordpress", title: "WordPress" }] });
    expect(found).toMatchObject({ name: "WordPress", confidence: "high" });
  });

  it.each([
    ["Shopify", { headers: { "x-shopid": "123" } }],
    ["Vercel", { headers: { "x-vercel-id": "cdg1::abc" } }],
    ["Cloudflare", { headers: { "cf-ray": "8a-CDG" } }],
    ["Nginx", { headers: { server: "nginx/1.25" } }],
    ["Laravel", { headers: { "set-cookie": "laravel_session=abc; path=/" } }],
    ["Nuxt", { html: "<script>window.__NUXT__={}</script>" }],
    ["Astro", { html: "<astro-island uid=1>" }],
    ["Angular", { html: '<app-root ng-version="18.0.0">' }],
    ["Webflow", { html: '<html data-wf-page="abc">' }],
    ["Wix", { html: '<img src="https://static.wixstatic.com/media/a.jpg">' }],
    ["jQuery", { html: '<script src="/js/jquery-3.7.1.min.js">' }],
    ["Google Tag Manager", { html: '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-1">' }],
  ])("finds %s", (name, signals) => {
    expect(names({ ...empty, ...signals })).toContain(name);
  });

  it("finds a stack in layers", () => {
    expect(
      names({
        headers: { server: "Vercel", "x-vercel-id": "x" },
        html: '<script src="/_next/static/chunks/main.js">',
        stackPacks: [],
      }),
    ).toEqual(["Next.js", "Vercel"]);
  });

  it("doesn't guess from generic words", () => {
    expect(names({ ...empty, html: "<p>We love react and vue and wordpress tips</p>" })).toEqual([]);
    expect(names({ ...empty, headers: { server: "cloudflare-but-not" } })).toEqual([]);
  });

  it("finds nothing in an empty page", () => {
    expect(detectStack(empty)).toEqual([]);
  });

  it("shortens long header values in the evidence", () => {
    const [found] = detectStack({ ...empty, headers: { server: `nginx ${"x".repeat(200)}` } });
    expect(found.evidence[0].length).toBeLessThan(90);
  });

  it("reads stack packs from stored JSON and ignores junk", () => {
    expect(stackPacksFromRaw({ lighthouseResult: { stackPacks: [{ id: "react", title: "React" }, { id: 5 }] } })).toEqual([
      { id: "react", title: "React" },
    ]);
    expect(stackPacksFromRaw(null)).toEqual([]);
  });
});

describe("blocked addresses", () => {
  it.each(["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "0.0.0.0"])(
    "blocks %s",
    (address) => expect(isBlockedAddress(address)).toBe(true),
  );

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

describe("safe lookup", () => {
  function lookupWith(addresses: LookupAddress[]) {
    const lookup = createSafeLookup((_host, callback) => callback(null, addresses));
    return new Promise<{ error: Error | null; address: unknown }>((resolve) =>
      lookup("example.com", {}, (error, address) => resolve({ error, address })),
    );
  }

  it("lets public addresses through", async () => {
    expect(await lookupWith([{ address: "93.184.216.34", family: 4 }])).toEqual({ error: null, address: "93.184.216.34" });
  });

  it("refuses a hostname that resolves to a private address", async () => {
    const { error } = await lookupWith([{ address: "169.254.169.254", family: 4 }]);
    expect(error?.message).toBe("Blocked address");
  });

  it("refuses when any of several addresses is private", async () => {
    const { error } = await lookupWith([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    expect(error).not.toBeNull();
  });

  it("refuses an empty answer", async () => {
    expect((await lookupWith([])).error).not.toBeNull();
  });
});

describe("fetchPublicPage", () => {
  it("never requests private URLs", async () => {
    expect(await fetchPublicPage("http://127.0.0.1/")).toBeNull();
    expect(await fetchPublicPage("http://localhost:3000/")).toBeNull();
    expect(await fetchPublicPage("http://169.254.169.254/latest/meta-data")).toBeNull();
  });

  it("returns null instead of throwing when DNS points somewhere private", async () => {
    const lookup = createSafeLookup((_host, callback) => callback(null, [{ address: "127.0.0.1", family: 4 }]));
    expect(await fetchPublicPage("https://rebinding.example/", lookup)).toBeNull();
  });
});

describe("buildFixRequest", () => {
  const raw = withAudits({
    "render-blocking": {
      title: "Eliminate render-blocking resources",
      score: 0,
      metricSavings: { LCP: 900 },
      displayValue: "Est savings of 900 ms",
      details: {
        items: [
          { url: "https://cdn.example.com/app.css?session=secret123" },
          { url: "javascript:alert(1)" },
          { url: "https://cdn.example.com/b.css" },
          { url: "https://cdn.example.com/c.css" },
          { url: "https://cdn.example.com/d.css" },
        ],
      },
    },
  });
  const result = parsePsiResponse(raw, "mobile", "https://shop.example.com/private-page?token=abc");
  const request = buildFixRequest(result, raw, [
    { name: "Next.js", category: "framework", confidence: "high", evidence: ["Header x-powered-by: Next.js"] },
  ]);
  const prompt = fixUserPrompt(request);

  it("includes audits, savings and stack names", () => {
    expect(request.audits[0]).toMatchObject({ id: "render-blocking", savingsMs: 900 });
    expect(request.stack).toEqual(["Next.js"]);
    expect(request.score).toBe(73);
  });

  it("keeps resource URLs to origin and path, at most three, web only", () => {
    expect(request.audits[0].resources).toEqual([
      "https://cdn.example.com/app.css",
      "https://cdn.example.com/b.css",
      "https://cdn.example.com/c.css",
    ]);
  });

  it("never sends query strings, the page URL, evidence or HTML", () => {
    expect(prompt).not.toContain("secret123");
    expect(prompt).not.toContain("private-page");
    expect(prompt).not.toContain("token=abc");
    expect(prompt).not.toContain("x-powered-by");
    expect(prompt).not.toContain("javascript:");
  });

  it("handles missing details", () => {
    expect(auditResources(null, "x")).toEqual([]);
    expect(auditResources({ lighthouseResult: { audits: { x: { details: {} } } } }, "x")).toEqual([]);
  });
});

describe("cleanSuggestions", () => {
  const fix = (priority: number, auditIds: string[] = ["render-blocking"]) => ({
    title: `Fix ${priority}`,
    priority,
    impact: "high" as const,
    difficulty: "easy" as const,
    auditIds,
    why: "Because",
    steps: ["Do it"],
    code: null,
  });

  it("orders by priority and renumbers", () => {
    const cleaned = cleanSuggestions({ summary: "s", fixes: [fix(3), fix(1), fix(2)] }, ["render-blocking"]);
    expect(cleaned.fixes.map((f) => [f.title, f.priority])).toEqual([["Fix 1", 1], ["Fix 2", 2], ["Fix 3", 3]]);
  });

  it("drops audit IDs the model made up", () => {
    const cleaned = cleanSuggestions({ summary: "s", fixes: [fix(1, ["render-blocking", "invented"])] }, ["render-blocking"]);
    expect(cleaned.fixes[0].auditIds).toEqual(["render-blocking"]);
  });

  it("caps the number and length of fixes", () => {
    const long: FixSuggestions = {
      summary: "x".repeat(1000),
      fixes: Array.from({ length: 10 }, (_, i) => ({ ...fix(i + 1), steps: Array(10).fill("step") })),
    };
    const cleaned = cleanSuggestions(long, []);
    expect(cleaned.fixes).toHaveLength(6);
    expect(cleaned.fixes[0].steps).toHaveLength(6);
    expect(cleaned.summary.length).toBeLessThanOrEqual(400);
  });

  it("produces a JSON schema without the $schema marker", () => {
    const schema = fixSuggestionsJsonSchema();
    expect(schema).not.toHaveProperty("$schema");
    expect(schema).toMatchObject({ type: "object", required: ["summary", "fixes"] });
  });
});
