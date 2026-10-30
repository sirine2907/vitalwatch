/**
 * Hand-built responses following the PSI v5 reference. Real responses saved by
 * `npm run fixtures:capture` are checked separately in psi-real-fixtures.test.ts.
 */
export function buildPsiResponse(overrides: Record<string, unknown> = {}) {
  return {
    loadingExperience: {
      id: "https://example.com/",
      origin_fallback: false,
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: {
          percentile: 2100,
          category: "FAST",
          distributions: [
            { min: 0, max: 2500, proportion: 0.8 },
            { min: 2500, max: 4000, proportion: 0.15 },
            { min: 4000, proportion: 0.05 },
          ],
        },
        INTERACTION_TO_NEXT_PAINT: {
          percentile: 150,
          category: "FAST",
          distributions: [
            { min: 0, max: 200, proportion: 0.9 },
            { min: 200, max: 500, proportion: 0.07 },
            { min: 500, proportion: 0.03 },
          ],
        },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: {
          percentile: 5,
          category: "FAST",
          distributions: [
            { min: 0, max: 10, proportion: 0.92 },
            { min: 10, max: 25, proportion: 0.05 },
            { min: 25, proportion: 0.03 },
          ],
        },
      },
    },
    lighthouseResult: {
      requestedUrl: "https://example.com/",
      finalUrl: "https://www.example.com/",
      fetchTime: "2026-10-30T12:00:00.000Z",
      lighthouseVersion: "12.0.0",
      runWarnings: [],
      categories: { performance: { score: 0.73 } },
      audits: {
        "largest-contentful-paint": { title: "LCP", numericValue: 3200.4, score: 0.5 },
        "first-contentful-paint": { title: "FCP", numericValue: 1400, score: 0.8 },
        "total-blocking-time": { title: "TBT", numericValue: 310, score: 0.6 },
        "speed-index": { title: "SI", numericValue: 2900, score: 0.7 },
        "server-response-time": { title: "TTFB", numericValue: 420, score: 1 },
        "cumulative-layout-shift": { title: "CLS", numericValue: 0.04, score: 1 },
      },
      ...overrides,
    },
  };
}

export function withAudits(audits: Record<string, unknown>) {
  const response = buildPsiResponse();
  return {
    ...response,
    lighthouseResult: {
      ...response.lighthouseResult,
      audits: { ...response.lighthouseResult.audits, ...audits },
    },
  };
}

/** A real 429 returned by PSI when called without an API key (trimmed). */
export const REAL_DAILY_QUOTA_BODY = JSON.stringify({
  error: {
    code: 429,
    message:
      "Quota exceeded for quota metric 'Queries' and limit 'Queries per day' of service 'pagespeedonline.googleapis.com'.",
    status: "RESOURCE_EXHAUSTED",
    details: [{ reason: "RATE_LIMIT_EXCEEDED", metadata: { quota_unit: "1/d/{project}" } }],
  },
});
