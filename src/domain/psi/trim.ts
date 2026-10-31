// Audits that are large and never read back: images and raw network or task logs.
const DROPPED_AUDITS = new Set([
  "final-screenshot",
  "full-page-screenshot",
  "screenshot-thumbnails",
  "network-requests",
  "network-rtt",
  "network-server-latency",
  "main-thread-tasks",
  "script-treemap-data",
  "metrics",
]);

const DROPPED_RESULT_KEYS = ["fullPageScreenshot", "i18n", "categoryGroups", "entities", "timing"];
const MAX_DETAIL_ITEMS = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Removes embedded images anywhere in a value, however deep. */
function stripDataUris(value: unknown): unknown {
  if (typeof value === "string") return value.startsWith("data:") ? undefined : value;
  if (Array.isArray(value)) {
    return value.map(stripDataUris).filter((item) => item !== undefined);
  }
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, stripDataUris(item)] as const)
      .filter(([, item]) => item !== undefined);
    return Object.fromEntries(entries);
  }
  return value;
}

function trimAudit(audit: unknown): unknown {
  if (!isRecord(audit) || !isRecord(audit.details)) return audit;
  const { details } = audit;
  if (!Array.isArray(details.items)) return audit;
  return { ...audit, details: { ...details, items: details.items.slice(0, MAX_DETAIL_ITEMS) } };
}

/**
 * Shrinks a PSI response for storage. Keeps everything the parser reads, so a
 * stored run can be rendered again later. Returns anything unexpected untouched.
 */
export function trimPsiResponse(raw: unknown): unknown {
  if (!isRecord(raw) || !isRecord(raw.lighthouseResult)) return raw;

  const lighthouse = { ...raw.lighthouseResult };
  for (const key of DROPPED_RESULT_KEYS) delete lighthouse[key];

  if (isRecord(lighthouse.audits)) {
    lighthouse.audits = Object.fromEntries(
      Object.entries(lighthouse.audits)
        .filter(([id]) => !DROPPED_AUDITS.has(id))
        .map(([id, audit]) => [id, trimAudit(audit)]),
    );
  }

  return stripDataUris({ ...raw, lighthouseResult: lighthouse });
}
