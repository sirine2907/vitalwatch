import { z } from "zod";

const envSchema = z.object({
  PAGESPEED_API_KEY: z.string().min(1).optional(),
  PAGESPEED_API_URL: z.url().optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_GITHUB_ID: z.string().min(1).optional(),
  AUTH_GITHUB_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_OWNER_ADDRESS: z.email().optional(),
  APP_URL: z.url().optional(),
  QSTASH_TOKEN: z.string().min(1).optional(),
  QSTASH_URL: z.url().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  GEMINI_API_URL: z.url().optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).optional(),
  AI_DAILY_LIMIT_PER_USER: z.coerce.number().int().positive().optional(),
});

export type Env = z.infer<typeof envSchema>;

const REQUIRED_IN_PRODUCTION = [
  "PAGESPEED_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "APP_URL",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
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

/** The public base URL without a trailing slash. Used in emails, links and job callbacks. */
export function appUrl(env: Env): string {
  return (env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
