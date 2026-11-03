export type TechCategory = "framework" | "cms" | "platform" | "hosting" | "server" | "library" | "analytics";

export interface DetectedTech {
  name: string;
  category: TechCategory;
  confidence: "high" | "medium";
  evidence: string[];
}

export interface StackSignals {
  headers: Record<string, string>;
  html: string | null;
  /** Lighthouse's own detection, from `lighthouseResult.stackPacks`. */
  stackPacks: { id: string; title: string }[];
}

interface Rule {
  name: string;
  category: TechCategory;
  headers?: [header: string, pattern: RegExp][];
  html?: [label: string, pattern: RegExp][];
  stackPacks?: string[];
}

// Each rule needs a specific signal. Generic ones like "react" in a script name
// are avoided, because they match far too many unrelated sites.
const RULES: Rule[] = [
  {
    name: "Next.js",
    category: "framework",
    headers: [["x-powered-by", /next\.js/i], ["x-nextjs-cache", /./]],
    html: [["__NEXT_DATA__", /__NEXT_DATA__/], ["/_next/static/", /\/_next\/static\//]],
    stackPacks: ["next.js"],
  },
  {
    name: "Nuxt",
    category: "framework",
    html: [["window.__NUXT__", /window\.__NUXT__/], ["/_nuxt/", /\/_nuxt\//]],
    stackPacks: ["nuxt"],
  },
  {
    name: "Gatsby",
    category: "framework",
    html: [["___gatsby", /id="___gatsby"/]],
    stackPacks: ["gatsby"],
  },
  {
    name: "Astro",
    category: "framework",
    html: [["astro-island", /<astro-island/], ["/_astro/", /\/_astro\//]],
  },
  {
    name: "SvelteKit",
    category: "framework",
    html: [["__sveltekit", /__sveltekit_/]],
  },
  {
    name: "Angular",
    category: "framework",
    html: [["ng-version", /ng-version="/]],
    stackPacks: ["angular"],
  },
  {
    name: "React",
    category: "library",
    html: [["data-reactroot", /data-reactroot/]],
    stackPacks: ["react"],
  },
  {
    name: "Vue",
    category: "library",
    html: [["data-v- attributes", /\sdata-v-[0-9a-f]{8}/], ["data-server-rendered", /data-server-rendered="true"/]],
  },
  {
    name: "WordPress",
    category: "cms",
    headers: [["link", /api\.w\.org/], ["x-powered-by", /wp engine/i]],
    html: [["/wp-content/", /\/wp-content\//], ["/wp-includes/", /\/wp-includes\//], ["generator WordPress", /<meta[^>]+generator[^>]+WordPress/i]],
    stackPacks: ["wordpress"],
  },
  {
    name: "Drupal",
    category: "cms",
    headers: [["x-drupal-cache", /./], ["x-generator", /drupal/i]],
    html: [["drupal-settings-json", /drupal-settings-json/]],
    stackPacks: ["drupal"],
  },
  {
    name: "Joomla",
    category: "cms",
    html: [["generator Joomla", /<meta[^>]+generator[^>]+Joomla/i]],
    stackPacks: ["joomla"],
  },
  {
    name: "Ghost",
    category: "cms",
    html: [["generator Ghost", /<meta[^>]+generator[^>]+Ghost/i]],
  },
  {
    name: "Shopify",
    category: "platform",
    headers: [["x-shopid", /./], ["x-shopify-stage", /./]],
    html: [["cdn.shopify.com", /cdn\.shopify\.com/], ["Shopify.theme", /Shopify\.theme/]],
  },
  {
    name: "Magento",
    category: "platform",
    headers: [["x-magento-cache-debug", /./]],
    html: [["Magento_", /Magento_[A-Z]/]],
    stackPacks: ["magento"],
  },
  {
    name: "Wix",
    category: "platform",
    headers: [["x-wix-request-id", /./]],
    html: [["static.wixstatic.com", /static\.wixstatic\.com/]],
    stackPacks: ["wix"],
  },
  {
    name: "Squarespace",
    category: "platform",
    html: [["static1.squarespace.com", /static1\.squarespace\.com/]],
  },
  {
    name: "Webflow",
    category: "platform",
    html: [["data-wf-page", /data-wf-page=/]],
  },
  {
    name: "Vercel",
    category: "hosting",
    headers: [["x-vercel-id", /./], ["server", /^vercel$/i]],
  },
  {
    name: "Netlify",
    category: "hosting",
    headers: [["x-nf-request-id", /./], ["server", /^netlify$/i]],
  },
  {
    name: "Cloudflare",
    category: "hosting",
    headers: [["cf-ray", /./]],
  },
  {
    name: "Nginx",
    category: "server",
    headers: [["server", /^nginx/i]],
  },
  {
    name: "Apache",
    category: "server",
    headers: [["server", /^apache/i]],
  },
  {
    name: "Express",
    category: "server",
    headers: [["x-powered-by", /^express$/i]],
  },
  {
    name: "PHP",
    category: "server",
    headers: [["x-powered-by", /^php/i]],
  },
  {
    name: "Laravel",
    category: "framework",
    headers: [["set-cookie", /laravel_session=/]],
  },
  {
    name: "jQuery",
    category: "library",
    html: [["jquery script", /jquery[.-]?(\d[\d.]*)?(\.min)?\.js/i]],
  },
  {
    name: "Bootstrap",
    category: "library",
    html: [["bootstrap stylesheet", /bootstrap(\.min)?\.css/i]],
  },
  {
    name: "Google Tag Manager",
    category: "analytics",
    html: [["gtm.js", /googletagmanager\.com\/gtm\.js/]],
  },
];

/** Shortens text that came from the site, so evidence stays readable. */
const clip = (value: string) => (value.length > 60 ? `${value.slice(0, 57)}...` : value);

/**
 * Works out a site's stack from three independent signals. Two or more signals
 * (or Lighthouse's own detection) make a finding high confidence.
 */
export function detectStack(signals: StackSignals): DetectedTech[] {
  const headers = Object.fromEntries(
    Object.entries(signals.headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const packIds = new Set(signals.stackPacks.map((pack) => pack.id.toLowerCase()));

  const found: DetectedTech[] = [];
  for (const rule of RULES) {
    const evidence: string[] = [];

    for (const [header, pattern] of rule.headers ?? []) {
      const value = headers[header];
      if (value && pattern.test(value)) evidence.push(`Header ${header}: ${clip(value)}`);
    }
    if (signals.html) {
      for (const [label, pattern] of rule.html ?? []) {
        if (pattern.test(signals.html)) evidence.push(`Page HTML has ${label}`);
      }
    }
    const pack = rule.stackPacks?.find((id) => packIds.has(id));
    if (pack) evidence.push(`Lighthouse detected ${rule.name}`);

    if (evidence.length > 0) {
      found.push({
        name: rule.name,
        category: rule.category,
        confidence: pack || evidence.length >= 2 ? "high" : "medium",
        evidence,
      });
    }
  }
  return found;
}

/** Reads stack packs from stored PSI JSON, which keeps them without icons. */
export function stackPacksFromRaw(raw: unknown): StackSignals["stackPacks"] {
  const packs = (raw as { lighthouseResult?: { stackPacks?: unknown } })?.lighthouseResult?.stackPacks;
  if (!Array.isArray(packs)) return [];
  return packs
    .filter((pack): pack is { id: string; title: string } =>
      typeof pack?.id === "string" && typeof pack?.title === "string",
    )
    .map(({ id, title }) => ({ id, title }));
}
