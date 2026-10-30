import { missingProductionEnv, readEnv } from "@/lib/env";

/** Runs once when the server boots, so bad production config fails immediately. */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;

  const missing = missingProductionEnv(readEnv());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
