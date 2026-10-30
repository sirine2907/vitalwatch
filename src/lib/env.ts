import { z } from "zod";

const envSchema = z.object({
  PAGESPEED_API_KEY: z.string().min(1).optional(),
  PAGESPEED_API_URL: z.url().optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

const REQUIRED_IN_PRODUCTION = [
  "PAGESPEED_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  // An empty line in .env.local means "not set", not "set to an empty string".
  const cleaned = Object.fromEntries(
    Object.keys(envSchema.shape).map((key) => [key, source[key] || undefined]),
  );
  return envSchema.parse(cleaned);
}

/** Lists required variables that are missing. Called once at server startup. */
export function missingProductionEnv(env: Env): string[] {
  return REQUIRED_IN_PRODUCTION.filter((key) => !env[key]);
}
