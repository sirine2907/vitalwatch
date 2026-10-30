// Saves real PSI responses as test fixtures, without the screenshots that make
// up most of their size.
// Usage: npm run fixtures:capture -- https://web.dev https://example.com
import { mkdirSync, writeFileSync } from "node:fs";

const SCREENSHOT_AUDITS = ["final-screenshot", "full-page-screenshot", "screenshot-thumbnails"];
const OUTPUT_DIRECTORY = new URL("../tests/fixtures/real/", import.meta.url);

const key = process.env.PAGESPEED_API_KEY;
const urls = process.argv.slice(2);

if (!key) {
  console.error("PAGESPEED_API_KEY is missing from .env.local");
  process.exit(1);
}
if (urls.length === 0) {
  console.error("Pass at least one URL to capture.");
  process.exit(1);
}

mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

for (const url of urls) {
  for (const strategy of ["mobile", "desktop"]) {
    const request = new URL("https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed");
    request.searchParams.set("url", url);
    request.searchParams.set("strategy", strategy.toUpperCase());
    request.searchParams.set("category", "PERFORMANCE");
    request.searchParams.set("key", key);

    const response = await fetch(request, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) {
      console.error(`${url} (${strategy}) failed with status ${response.status}`);
      continue;
    }

    const body = await response.json();
    for (const audit of SCREENSHOT_AUDITS) delete body.lighthouseResult?.audits?.[audit];
    delete body.lighthouseResult?.fullPageScreenshot;
    delete body.lighthouseResult?.i18n;

    const name = `${new URL(url).hostname}-${strategy}.json`;
    writeFileSync(new URL(name, OUTPUT_DIRECTORY), JSON.stringify(body, null, 2));
    console.log(`Saved ${name}`);
  }
}
