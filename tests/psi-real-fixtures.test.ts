import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePsiResponse } from "@/domain/psi/parse";
import type { Strategy } from "@/domain/psi/types";

const DIRECTORY = join(__dirname, "fixtures", "real");
const files = existsSync(DIRECTORY)
  ? readdirSync(DIRECTORY).filter((file) => file.endsWith(".json"))
  : [];

// Fixtures come from `npm run fixtures:capture`, which needs an API key.
describe.skipIf(files.length === 0)("real PSI responses", () => {
  it.each(files)("%s parses into sensible values", (file) => {
    const raw = JSON.parse(readFileSync(join(DIRECTORY, file), "utf8"));
    const strategy: Strategy = file.includes("desktop") ? "desktop" : "mobile";
    const result = parsePsiResponse(raw, strategy, "https://example.com/");

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.lab.lcp).toBeGreaterThan(0);
    expect(result.lab.cls).not.toBeNull();
    expect(result.lighthouseVersion).toBeTruthy();

    for (const vital of Object.values(result.field.vitals)) {
      if (vital) expect(vital.value).toBeGreaterThanOrEqual(0);
    }
    const savings = result.opportunities.map((item) => item.savingsMs);
    expect(savings).toEqual([...savings].sort((a, b) => b - a));
  });
});
