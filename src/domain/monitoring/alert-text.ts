import type { Strategy } from "@/domain/psi/types";
import { formatVital, VITAL_LABELS } from "@/domain/vitals/thresholds";
import type { AlertMetric, AlertSource, AlertType } from "./regression";

export interface AlertDescription {
  type: AlertType;
  metric: AlertMetric;
  source: AlertSource;
  strategy: Strategy;
  baselineValue: number;
  currentValue: number;
  threshold: number;
}

const DEVICE: Record<Strategy, string> = { mobile: "Mobile", desktop: "Desktop" };

function formatValue(metric: AlertMetric, value: number): string {
  return metric === "score" ? String(Math.round(value)) : formatVital(metric, value);
}

/** A one-line summary used in the alerts feed and in email subjects. */
export function alertTitle(alert: AlertDescription): string {
  const device = DEVICE[alert.strategy];
  if (alert.type === "score_drop") {
    return `${device} score dropped from ${formatValue("score", alert.baselineValue)} to ${formatValue("score", alert.currentValue)}`;
  }
  const label = VITAL_LABELS[alert.metric as Exclude<AlertMetric, "score">].short;
  const source = alert.source === "field" ? "real-user" : "lab";
  return `${device} ${source} ${label} is now poor: ${formatValue(alert.metric, alert.currentValue)}`;
}

export function alertDetail(alert: AlertDescription): string {
  const usual = formatValue(alert.metric, alert.baselineValue);
  if (alert.type === "score_drop") {
    return `The usual score (the median of recent tests) is ${usual}, and this project alerts on drops of more than ${alert.threshold} points. A second test confirmed the drop.`;
  }
  const limit = formatValue(alert.metric, alert.threshold);
  const confirmed = alert.source === "lab" ? " A second test confirmed it." : "";
  return `It's usually ${usual}. Google rates anything over ${limit} as poor.${confirmed}`;
}
