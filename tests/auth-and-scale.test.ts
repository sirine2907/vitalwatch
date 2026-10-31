import { describe, expect, it } from "vitest";
import { canReceiveEmail } from "@/domain/auth/email-policy";
import { buildChartScale, formatMetricValue } from "@/domain/history/chart-scale";
import type { TrendRow } from "@/domain/history/trend";

describe("canReceiveEmail", () => {
  it("allows everyone when no owner is set", () => {
    expect(canReceiveEmail("anyone@example.com", undefined)).toBe(true);
  });

  it("allows only the owner when one is set", () => {
    expect(canReceiveEmail("me@example.com", "me@example.com")).toBe(true);
    expect(canReceiveEmail("other@example.com", "me@example.com")).toBe(false);
  });

  it("ignores case and spaces", () => {
    expect(canReceiveEmail(" Me@Example.com ", "me@example.com")).toBe(true);
  });

  it("isn't fooled by an address that only contains the owner's", () => {
    expect(canReceiveEmail("me@example.com.evil.com", "me@example.com")).toBe(false);
  });
});

describe("buildChartScale", () => {
  const rows = (...values: (number | null)[]): TrendRow[] =>
    values.map((mobile, time) => ({ time, mobile, desktop: null }));
  const labels = (scale: ReturnType<typeof buildChartScale>) =>
    scale.thresholds.map((line) => line.label);

  it("always uses 0 to 100 for the score", () => {
    const scale = buildChartScale(rows(40), "performanceScore");
    expect(scale.max).toBe(100);
    expect(labels(scale)).toEqual(["Good from 90", "Poor below 50"]);
  });

  it("keeps the good line in view when values are far below it", () => {
    const scale = buildChartScale(rows(500), "fieldLcpMs");
    expect(scale.max).toBeGreaterThan(2500);
    expect(labels(scale)).toEqual(["Good up to 2.5 s"]);
  });

  it("shows the poor line once values reach it", () => {
    const scale = buildChartScale(rows(5000), "fieldLcpMs");
    expect(scale.max).toBeGreaterThan(5000);
    expect(labels(scale)).toEqual(["Good up to 2.5 s", "Poor above 4.0 s"]);
  });

  it("draws no lines for metrics without published thresholds", () => {
    expect(buildChartScale(rows(300), "labTbtMs").thresholds).toEqual([]);
  });

  it("never produces a zero-height axis", () => {
    expect(buildChartScale(rows(0), "labTbtMs").max).toBeGreaterThan(0);
    expect(buildChartScale(rows(null), "labTbtMs").max).toBeGreaterThan(0);
  });

  it("formats each unit", () => {
    expect(formatMetricValue("score", 73.4)).toBe("73");
    expect(formatMetricValue("ms", 450)).toBe("450 ms");
    expect(formatMetricValue("ms", 2500)).toBe("2.5 s");
    expect(formatMetricValue("unitless", 0.1)).toBe("0.10");
  });
});
